/**
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 *
 *                                  ██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗███████╗██╗
 *                                  ██╔══██╗██╔═══██╗████╗  ██║██╔════╝ ██║██╔════╝██║
 *                                  ██████╔╝██║   ██║██╔██╗ ██║██║  ███╗██║█████╗  ██║
 *                                  ██╔═══╝ ██║   ██║██║╚██╗██║██║   ██║██║██╔══╝  ██║
 *                                  ██║     ╚██████╔╝██║ ╚████║╚██████╔╝██║██║     ██║
 *                                  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝     ╚═╝
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 * ███████████████████████████████████████ scripts/spike/result-entry/measure.ts ███████████████████████████████████████
 *
 * Samples what one result transition costs, against whatever database it is pointed at.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import type { QueryResult, QueryResultRow } from '@neondatabase/serverless';

import type { IResultSubmission } from '#shared/results';
import { Seat } from '#shared/results';
import { GameType } from '#shared/rules-engine';
import { DEFAULT_TRANSACTION_LIMITS } from '#utils/db/constants';
import { TransactionBudgetError, withInteractiveTransaction } from '#utils/db/transaction';
import type { IInteractiveTransaction, ITransactionPhases } from '#utils/db/types';
import { settleDueResults } from '#utils/results';

import { LEAGUE_ID, read, resetDatabase, seedLeague, settingsFixture, useLocalProxy } from './harness';
import { recordOrThrow, singles } from './scenarios-schema';

/**
 * How many accounts the seeded ladder rotates between, so the ladder is a chain of transitive opponents rather than
 * one pair playing itself
 * @internal
 * @constant
 */
const PLAYERS: readonly string[] = ['Ada', 'Ben', 'Cara', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal'];

/**
 * The statement each measured transaction is attributed against, by a fragment of the statement itself.
 *
 * Matching on the text the service actually sends keeps the attribution honest: a statement nobody named here is
 * counted as one of the operation's other statements rather than silently folded into a phase it does not belong to
 * @internal
 * @constant
 */
const STATEMENTS = {
  LADDER_READ: 'JOIN "result_revision_games" rg',
  LEAGUE_LOCK: 'FROM "leagues" WHERE "id" = $1 FOR UPDATE',
  POINTER_WRITE: 'INSERT INTO "active_rating_generations"',
  SNAPSHOT_WRITE: 'INSERT INTO "rating_snapshots"',
} as const;

/**
 * What one operation's statements cost, split by the ones the budget argument turns on
 * @internal
 */
interface IStatementTotals {
  /* Reading the league's whole eligible ladder */
  ladderReadMs: number;

  /* Taking the league's row lock, which is where a second writer waits */
  lockMs: number;

  /* Every other statement the operation sent */
  otherMs: number;

  /* Moving the active pointer to the new generation */
  pointerMs: number;

  /* Writing the generation's snapshots */
  snapshotWriteMs: number;

  /* How many statements the operation sent, the preamble and the commit excluded */
  statements: number;
}

/**
 * One measured operation: where the helper says its time went, and what the statements inside it cost
 * @internal
 */
interface ISample {
  /* The engine and everything else the body computed rather than waited on */
  computeMs: number;

  /* What the statements cost */
  statements: IStatementTotals;

  /* Where the operation's own phases went */
  phases: ITransactionPhases;
}

/**
 * A summary of several observations of the same thing
 * @internal
 */
interface IDistribution {
  /* How many observations */
  count: number;

  /* The largest */
  max: number;

  /* The middle one */
  median: number;

  /* The smallest */
  min: number;

  /* Every observation, so a reader can disagree with the summary */
  samples: number[];
}

/**
 * Builds a fresh set of statement totals
 * @internal
 * @function
 * @returns Totals with nothing attributed to them yet
 */
function newTotals(): IStatementTotals {
  return {
    ladderReadMs: 0,
    lockMs: 0,
    otherMs: 0,
    pointerMs: 0,
    snapshotWriteMs: 0,
    statements: 0,
  };
}

/**
 * Attributes one statement's time to the part of the operation it belongs to
 * @internal
 * @function
 * @param totals - What to attribute it against
 * @param text - The statement
 * @param elapsed - How long it took, including the round trip that carried it
 */
function attribute(totals: IStatementTotals, text: string, elapsed: number): void {
  totals.statements += 1;

  if (text.includes(STATEMENTS.LEAGUE_LOCK)) {
    totals.lockMs += elapsed;
  } else if (text.includes(STATEMENTS.LADDER_READ)) {
    totals.ladderReadMs += elapsed;
  } else if (text.includes(STATEMENTS.SNAPSHOT_WRITE)) {
    totals.snapshotWriteMs += elapsed;
  } else if (text.includes(STATEMENTS.POINTER_WRITE)) {
    totals.pointerMs += elapsed;
  } else {
    totals.otherMs += elapsed;
  }
}

/**
 * Wraps the transaction the helper hands a body, timing every statement without changing what is sent.
 *
 * This is the only way a breakdown belongs to the same operation as the total above it: the service is called exactly
 * as it is deployed, and the measurement happens on the connection it was given
 * @internal
 * @function
 * @param transaction - The transaction the body was handed
 * @param totals - What to attribute its statements against
 * @returns The same transaction, timed
 */
function instrumented(transaction: IInteractiveTransaction, totals: IStatementTotals): IInteractiveTransaction {
  return {
    query: async <TRow extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<TRow>> => {
      const started: number = performance.now();

      try {
        return await transaction.query<TRow>(text, values);
      } finally {
        attribute(totals, text, performance.now() - started);
      }
    },
  };
}

/**
 * Runs one operation under measurement
 * @internal
 * @async
 * @function
 * @param connectionString - The database to run it against
 * @param body - What the operation does, given the timed transaction
 * @returns What it cost
 */
async function measured(
  connectionString: string,
  body: (transaction: IInteractiveTransaction) => Promise<unknown>,
): Promise<ISample> {
  const totals: IStatementTotals = newTotals();
  let phases: ITransactionPhases | undefined = undefined;

  await withInteractiveTransaction((transaction) => body(instrumented(transaction, totals)), {
    connectionString,
    onPhases: (observed: ITransactionPhases): void => {
      phases = observed;
    },
  });

  const observed: ITransactionPhases = phases!;
  const waited: number =
    totals.ladderReadMs + totals.lockMs + totals.otherMs + totals.pointerMs + totals.snapshotWriteMs;

  return {
    // What the body spent computing rather than waiting for the database: the rating engine, the reconstruction and
    // the JSON the snapshot write is handed
    computeMs: observed.bodyMs - waited,
    phases: observed,
    statements: totals,
  };
}

/**
 * A doubles submission, seating four accounts
 * @internal
 * @function
 * @param seats - The four accounts, A1, A2, B1, B2
 * @returns The submission
 */
function doubles(seats: [string, string, string, string]): IResultSubmission {
  return {
    ...singles([[11, 4]], [seats[0], seats[2]]),
    gameType: GameType.DOUBLES,
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: seats[0],
      },
      {
        guestName: null,
        seat: Seat.A2,
        userId: seats[1],
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: seats[2],
      },
      {
        guestName: null,
        seat: Seat.B2,
        userId: seats[3],
      },
    ],
  };
}

/**
 * Seeds a league with settled singles results, written directly rather than through the service.
 *
 * Recording ten thousand results one at a time would spend its whole time replaying the ladder after each, which is
 * the cost being measured rather than the fixture
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @param count - How many matches to write
 * @returns The seeded accounts
 */
async function seedLadder(connectionString: string, count: number): Promise<Record<string, string>> {
  await resetDatabase(connectionString);

  const ids: Record<string, string> = await seedLeague(
    connectionString,
    [...PLAYERS],
    settingsFixture({ requireConfirmation: false }),
  );
  const players: string[] = PLAYERS.map((name: string): string => ids[name]!);

  await read(
    connectionString,
    `WITH seeded AS (
       SELECT i,
              gen_random_uuid() AS revision_id,
              gen_random_uuid() AS game_id,
              (now() - ((10000 - i) || ' minutes')::interval) AS played_at,
              ($2::uuid[])[(i % ${PLAYERS.length}) + 1] AS winner,
              ($2::uuid[])[((i + 1) % ${PLAYERS.length}) + 1] AS loser
       FROM generate_series(1, $1) AS i
     ),
     revisions AS (
       INSERT INTO "result_revisions" ("id", "canonical_match_id", "league_id", "revision", "is_current", "state",
         "game_type", "settings_snapshot", "policy_snapshot", "league_configuration_revision", "submission",
         "reconstruction", "reconstruction_version", "submission_digest", "played_at", "original_played_at",
         "submitted_at", "settled_at", "settled_reason", "recorded_by")
       SELECT s.revision_id, s.revision_id, $3, 1, true, 'CONFIRMED', 'SINGLES', $4::jsonb, $5::jsonb, 1,
              '{}'::jsonb, '{}'::jsonb, 1, 'seeded', s.played_at, s.played_at, s.played_at, s.played_at,
              'NO_CONFIRMATION_NEEDED', $6
       FROM seeded s
       RETURNING "id"
     ),
     inserted_games AS (
       INSERT INTO "games" ("id", "league_id", "match_id", "game_number", "type", "status", "confirmation_status",
         "confirmed_at", "recording_mode", "settings_snapshot", "created_by", "ended_at", "result_revision_id")
       SELECT s.game_id, $3, s.revision_id, 1, 'SINGLES', 'COMPLETE', 'CONFIRMED', s.played_at, 'RETROACTIVE',
              $4::jsonb, $6, s.played_at, s.revision_id
       FROM seeded s
       RETURNING "id"
     ),
     links AS (
       INSERT INTO "result_revision_games" ("result_revision_id", "game_id", "game_number")
       SELECT s.revision_id, s.game_id, 1 FROM seeded s
       RETURNING "game_id"
     )
     INSERT INTO "game_participants" ("game_id", "user_id", "side", "final_score", "outcome", "result_revision_id", "seat")
     SELECT s.game_id, s.winner, 'A'::participant_side, 11, 'WIN'::participant_outcome, s.revision_id, 'A1' FROM seeded s
     UNION ALL
     SELECT s.game_id, s.loser, 'B'::participant_side, 4, 'LOSS'::participant_outcome, s.revision_id, 'B1' FROM seeded s`,
    [
      count,
      players,
      LEAGUE_ID,
      JSON.stringify({
        cutthroatTimeCap: 0,
        expediteEnabled: false,
        gameType: 'SINGLES',
        matchFormat: 1,
        serviceInterval: 2,
        targetScore: 11,
        winningMargin: 2,
      }),
      JSON.stringify({
        provisionalGames: 5,
        ratingEnabled: true,
        requireConfirmation: false,
        resultAmendmentWindow: 48,
        resultConfirmationWindow: 24,
        version: 1,
        whoCanRecordResults: 'PARTICIPANTS',
      }),
      ids.Ada!,
    ],
  );

  return ids;
}

/**
 * How much space the generation tables take, in bytes
 * @internal
 * @async
 * @function
 * @param connectionString - The database
 * @returns The total size of the snapshot and generation tables
 */
async function generationBytes(connectionString: string): Promise<number> {
  const [row] = await read<{ bytes: string }>(
    connectionString,
    `SELECT (pg_total_relation_size('rating_snapshots') + pg_total_relation_size('rating_generations'))::text AS bytes`,
  );

  return Number(row!.bytes);
}

/**
 * Records one result through the deployed service, under measurement
 * @internal
 * @async
 * @function
 * @param connectionString - The database
 * @param actorId - Who records it
 * @param submission - What they record
 * @returns What the operation cost
 */
async function recordSample(
  connectionString: string,
  actorId: string,
  submission: IResultSubmission,
): Promise<ISample> {
  return measured(connectionString, (transaction) =>
    recordOrThrow(transaction, actorId, {
      clientOperationId: randomUUID(),
      expectedLeagueRevision: 1,
      leagueId: LEAGUE_ID,
      submission,
    }),
  );
}

/**
 * Summarises several observations of the same figure
 * @internal
 * @function
 * @param values - The observations
 * @returns Their distribution
 */
function distribution(values: number[]): IDistribution {
  const sorted: number[] = [...values].sort((left: number, right: number): number => left - right);

  return {
    count: sorted.length,
    max: sorted.at(-1) ?? 0,
    median: sorted[Math.floor((sorted.length - 1) / 2)] ?? 0,
    min: sorted[0] ?? 0,
    samples: values.map((value: number): number => Number(value.toFixed(1))),
  };
}

/**
 * What one configuration of the sweep observed
 * @internal
 */
interface IConfiguration {
  /* What was measured */
  name: string;

  /* How many eligible game rows the league had */
  size: number;

  /* Every sample, in the order they ran */
  samples: ISample[];

  /* Whatever else the configuration observed, for the report */
  notes: Record<string, unknown>;
}

/**
 * Turns a set of samples into the distributions the report is written from
 * @internal
 * @function
 * @param samples - The samples
 * @returns One distribution per figure
 */
function summarise(samples: ISample[]): Record<string, IDistribution> {
  return {
    commit: distribution(samples.map((sample: ISample): number => sample.phases.commitMs)),
    compute: distribution(samples.map((sample: ISample): number => sample.computeMs)),
    connect: distribution(samples.map((sample: ISample): number => sample.phases.connectMs)),
    ladderRead: distribution(samples.map((sample: ISample): number => sample.statements.ladderReadMs)),
    lock: distribution(samples.map((sample: ISample): number => sample.statements.lockMs)),
    operation: distribution(samples.map((sample: ISample): number => sample.phases.operationMs)),
    other: distribution(samples.map((sample: ISample): number => sample.statements.otherMs)),
    preamble: distribution(samples.map((sample: ISample): number => sample.phases.preambleMs)),
    snapshotWrite: distribution(samples.map((sample: ISample): number => sample.statements.snapshotWriteMs)),
    cleanup: distribution(samples.map((sample: ISample): number => sample.phases.cleanupMs)),
    statements: distribution(samples.map((sample: ISample): number => sample.statements.statements)),
  };
}

/**
 * Measures what one round trip to this database costs on a connection that is already open, and what opening one
 * costs.
 *
 * Every statement time in the sweep carries one round trip, so this figure and the count of statements an operation
 * sends together say how much of a measured operation is distance rather than work. It is taken inside a real
 * transaction rather than around a fresh pool, because a pool per statement would measure the dial every time
 * @internal
 * @async
 * @function
 * @param connectionString - The database
 * @param count - How many round trips to take per transaction
 * @returns The round trip and dial distributions, and what the server says it is
 */
async function probe(
  connectionString: string,
  count: number,
): Promise<{ connect: IDistribution; roundTrip: IDistribution; server: string }> {
  const connects: number[] = [];
  const roundTrips: number[] = [];
  let version: string = 'unknown';

  for (let attempt: number = 0; attempt < 3; attempt += 1) {
    await withInteractiveTransaction(
      async (transaction): Promise<void> => {
        const { rows } = await transaction.query<{ version: string }>('SELECT version() AS version');

        version = rows[0]!.version;

        for (let trip: number = 0; trip < count; trip += 1) {
          const started: number = performance.now();

          await transaction.query('SELECT 1');
          roundTrips.push(performance.now() - started);
        }
      },
      {
        connectionString,
        onPhases: (phases: ITransactionPhases): void => {
          connects.push(phases.connectMs);
        },
      },
    );
  }

  return {
    connect: distribution(connects),
    roundTrip: distribution(roundTrips),
    server: version,
  };
}

/**
 * Opens a configuration and records it before it is filled, so a refusal keeps whatever was measured before it
 * @internal
 * @function
 * @param into - Where the sweep's configurations are collected
 * @param name - What is being measured
 * @param size - How many eligible game rows the league has
 * @returns The configuration, ready to be filled
 */
function opened(into: IConfiguration[], name: string, size: number): IConfiguration {
  const configuration: IConfiguration = {
    name,
    notes: {},
    samples: [],
    size,
  };

  into.push(configuration);

  return configuration;
}

/**
 * Runs every configuration at one ladder size, collecting them as they are measured.
 *
 * A refusal propagates, which is how the sweep stops at the first size that cannot fit the budget. What was measured
 * before it is already in `into` and is reported rather than thrown away with the size that refused
 * @internal
 * @async
 * @function
 * @param connectionString - The database
 * @param size - How many eligible game rows the league has
 * @param samples - How many observations each configuration takes
 * @param into - Where to collect what is measured
 */
async function atSize(connectionString: string, size: number, samples: number, into: IConfiguration[]): Promise<void> {
  const singlesRun: IConfiguration = opened(into, 'singles transition', size);

  for (let attempt: number = 0; attempt < samples; attempt += 1) {
    const ids: Record<string, string> = await seedLadder(connectionString, size);
    const before: number = await generationBytes(connectionString);

    singlesRun.samples.push(await recordSample(connectionString, ids.Ada!, singles([[11, 4]], [ids.Ada!, ids.Ben!])));

    const [written] = await read<{ snapshots: number }>(
      connectionString,
      `SELECT count(*)::int AS snapshots FROM "rating_snapshots"`,
    );

    singlesRun.notes = {
      generationBytes: (await generationBytes(connectionString)) - before,
      snapshots: written!.snapshots,
    };
  }

  const doublesRun: IConfiguration = opened(into, 'doubles transition', size);

  for (let attempt: number = 0; attempt < samples; attempt += 1) {
    const ids: Record<string, string> = await seedLadder(connectionString, size);

    doublesRun.samples.push(
      await recordSample(connectionString, ids.Ada!, doubles([ids.Ada!, ids.Ben!, ids.Cara!, ids.Dan!])),
    );
  }

  /* Three transitions in a row on one league, which is what a busy evening looks like and what storage grows by */
  const repeatedRun: IConfiguration = opened(into, 'three consecutive generations on one league', size);
  const repeatedIds: Record<string, string> = await seedLadder(connectionString, size);
  const repeatedBytes: number[] = [];

  for (let generation: number = 0; generation < 3; generation += 1) {
    const before: number = await generationBytes(connectionString);

    repeatedRun.samples.push(
      await recordSample(connectionString, repeatedIds.Ada!, singles([[11, 4]], [repeatedIds.Ada!, repeatedIds.Ben!])),
    );
    repeatedBytes.push((await generationBytes(connectionString)) - before);
    repeatedRun.notes = { generationBytes: repeatedBytes };
  }

  /* The worst backdated case: the oldest result in the league settling, which replays everything after it */
  const backdatedRun: IConfiguration = opened(into, 'settling the oldest result in the league', size);

  await seedLadder(connectionString, size);

  const [oldest] = await read<{ id: string }>(
    connectionString,
    `SELECT "canonical_match_id" AS id FROM "result_revisions" ORDER BY "played_at" LIMIT 1`,
  );

  await read(
    connectionString,
    `UPDATE "result_revisions" SET "state" = 'UNCONFIRMED', "settled_at" = NULL, "settled_reason" = NULL,
       "confirmation_deadline" = now() - interval '1 minute' WHERE "canonical_match_id" = $1`,
    [oldest!.id],
  );

  let settled: number = 0;

  backdatedRun.samples.push(
    await measured(connectionString, async (transaction): Promise<number> => {
      settled = await settleDueResults(transaction, LEAGUE_ID);

      return settled;
    }),
  );
  backdatedRun.notes = { settled };

  /* Two writers meeting on the league's row, which is where the lock wait in the breakdown comes from */
  const contendedRun: IConfiguration = opened(into, 'two writers on one league', size);
  const contendedIds: Record<string, string> = await seedLadder(connectionString, size);

  contendedRun.samples.push(
    ...(await Promise.all([
      recordSample(connectionString, contendedIds.Ada!, singles([[11, 4]], [contendedIds.Ada!, contendedIds.Ben!])),
      recordSample(connectionString, contendedIds.Cara!, singles([[11, 4]], [contendedIds.Cara!, contendedIds.Dan!])),
    ])),
  );

  const [counts] = await read<{ generations: number; pointers: number }>(
    connectionString,
    `SELECT (SELECT count(*)::int FROM "rating_generations") AS generations,
            (SELECT count(*)::int FROM "active_rating_generations") AS pointers`,
  );

  contendedRun.notes = { generations: counts!.generations, pointers: counts!.pointers };
}

/**
 * Prints one configuration's distributions as a line of the report
 * @internal
 * @function
 * @param configuration - What was measured
 * @returns The line
 */
function line(configuration: IConfiguration): string {
  const summary: Record<string, IDistribution> = summarise(configuration.samples);
  const figure = (name: string): string =>
    `${summary[name]!.min.toFixed(0)}/${summary[name]!.median.toFixed(0)}/${summary[name]!.max.toFixed(0)}`;

  return [
    `| ${configuration.size} | ${configuration.name} | ${figure('operation')} | ${figure('connect')} `,
    `| ${figure('preamble')} | ${figure('lock')} | ${figure('ladderRead')} | ${figure('compute')} `,
    `| ${figure('snapshotWrite')} | ${figure('other')} | ${figure('commit')} | ${figure('cleanup')} `,
    `| ${summary.statements!.median.toFixed(0)} |`,
  ].join('');
}

/**
 * Runs the sweep and writes down what it observed.
 *
 * The target comes from `SPIKE_DATABASE_URL` and the optional local proxy from `SPIKE_WS_PROXY`, exactly as the rest
 * of the spike takes them. `SPIKE_ORIGIN` is the label that goes on the results, because the same numbers mean
 * different things from a laptop and from inside the region the database is in
 * @internal
 * @async
 * @function
 */
async function main(): Promise<void> {
  const connectionString: string | undefined = process.env.SPIKE_DATABASE_URL;
  const proxy: string | undefined = process.env.SPIKE_WS_PROXY;
  const origin: string = process.env.SPIKE_ORIGIN ?? 'unlabelled';
  const samples: number = Number(process.env.SPIKE_SAMPLES ?? '5');
  const sizes: number[] = (process.env.SPIKE_SIZES ?? '100,1000,10000')
    .split(',')
    .map((size: string): number => Number(size.trim()));

  if (!connectionString) {
    throw new Error('SPIKE_DATABASE_URL is not set; the sweep refuses to guess which database it may rebuild.');
  }

  if (proxy) {
    useLocalProxy(proxy);
  }

  const environment = await probe(connectionString, 20);
  const measurements: IConfiguration[] = [];
  const stopped: string[] = [];

  process.stdout.write(`origin: ${origin}\nserver: ${environment.server}\n`);
  process.stdout.write(
    `round trip (min/median/max): ${environment.roundTrip.min.toFixed(1)}/${environment.roundTrip.median.toFixed(1)}/${environment.roundTrip.max.toFixed(1)}ms\n`,
  );
  process.stdout.write(
    `dialling a new pool: ${environment.connect.min.toFixed(0)}/${environment.connect.median.toFixed(0)}/${environment.connect.max.toFixed(0)}ms\n`,
  );
  process.stdout.write(`limits: ${JSON.stringify(DEFAULT_TRANSACTION_LIMITS)}\n\n`);

  for (const size of sizes) {
    const observed: IConfiguration[] = [];
    let refused: string = '';

    try {
      await atSize(connectionString, size, samples, observed);
    } catch (error: unknown) {
      refused = error instanceof TransactionBudgetError ? 'the operation budget refused it' : String(error);
    }

    measurements.push(...observed);

    for (const configuration of observed.filter((each: IConfiguration): boolean => each.samples.length > 0)) {
      process.stdout.write(`${line(configuration)}\n`);
    }

    if (refused !== '') {
      stopped.push(`${size} rows: ${refused}; larger sizes not run`);
      break;
    }

    const worst: number = Math.max(
      ...observed.flatMap((configuration: IConfiguration): number[] =>
        configuration.samples.map((sample: ISample): number => sample.phases.operationMs),
      ),
    );

    if (worst >= DEFAULT_TRANSACTION_LIMITS.operationTimeoutMs) {
      stopped.push(`${size} rows reached ${worst.toFixed(0)}ms, the whole operation budget; larger sizes not run`);
      break;
    }
  }

  const report = {
    environment: {
      connect: environment.connect,
      limits: DEFAULT_TRANSACTION_LIMITS,
      origin,
      roundTrip: environment.roundTrip,
      samples,
      server: environment.server,
      sizes,
      takenAt: new Date().toISOString(),
    },
    measurements: measurements.map((configuration: IConfiguration) => ({
      name: configuration.name,
      notes: configuration.notes,
      raw: configuration.samples,
      size: configuration.size,
      summary: summarise(configuration.samples),
    })),
    stopped,
  };
  const out: string = process.env.SPIKE_OUT ?? `measure-${origin}.json`;

  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(`\n${stopped.length === 0 ? 'every size ran' : stopped.join('\n')}\nwritten to ${out}\n`);
}

await main();
