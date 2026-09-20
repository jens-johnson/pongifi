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
 * ██████████████████████████████████ #server/api/internal/transaction-probe.post.ts ███████████████████████████████████
 *
 * Measures the deployed transaction wrapper from inside a deployed function, against a disposable fixture database.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/internal/transaction-probe. Absent unless SPIKE_PROBE_SECRET and SPIKE_PROBE_DATABASE_URL are configured;
 * requires that secret as a bearer token. Body: { samples?: 1-5 }.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { randomUUID, timingSafeEqual } from 'node:crypto';

import type { IResultSubmission } from '#shared/results';
import { ResultEnding, Seat } from '#shared/results';
import { withInteractiveTransaction } from '#utils/db/transaction';
import type { ITransactionPhases } from '#utils/db/types';
import { recordResult } from '#utils/results';

/**
 * What one probed operation cost, and what it was
 * @public
 */
export interface IProbeSample {
  /* Where the operation's time went, as the transaction helper measured it */
  phases: ITransactionPhases;

  /* Whether the service accepted the submission, or what it refused it with */
  outcome: string;
}

/**
 * What the probe answers with
 * @public
 */
export interface IProbeReport {
  /* The hostname the probe itself dialled, and whether it is Neon's pooled route */
  fixture: { host: string; pooled: boolean };

  /* The hostname the deployed application is configured to dial, and whether that is the pooled route. Never the
     credential: a hostname says which route the function takes and nothing about who may take it */
  configured: { host: string; pooled: boolean } | null;

  /* Where this function ran */
  runtime: { region: string | null; url: string | null };

  /* One entry per sample, in the order they ran */
  samples: IProbeSample[];
}

/**
 * How many samples one request may ask for. Bounded, because a probe that accepted any number would be a way to
 * spend a function's budget from outside
 * @internal
 * @constant
 */
const MAX_SAMPLES: number = 5;

/**
 * Compares two secrets without leaking their difference through how long it took
 * @internal
 * @function
 * @param offered - What the caller sent
 * @param expected - What this deployment was armed with
 * @returns Whether they are the same
 */
function matches(offered: string, expected: string): boolean {
  const left: Buffer = Buffer.from(offered);
  const right: Buffer = Buffer.from(expected);

  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Describes a connection string by its route alone
 * @internal
 * @function
 * @param connectionString - The string to describe
 * @returns Its hostname and whether that hostname is Neon's pooled route
 */
function route(connectionString: string): { host: string; pooled: boolean } {
  const host: string = new URL(connectionString).hostname;

  return { host, pooled: host.includes('-pooler.') };
}

/**
 * A submission the fixture league can always accept: two seats it already carries, played an hour before the
 * database's own clock decides anything about it
 * @internal
 * @function
 * @param seats - The two seated accounts
 * @returns The submission
 */
function submission(seats: [string, string]): IResultSubmission {
  return {
    ending: ResultEnding.COMPLETED,
    gameType: 'SINGLES' as IResultSubmission['gameType'],
    games: [
      {
        a: 11,
        b: 4,
        gameNumber: 1,
      },
    ],
    playedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    retiredSeat: null,
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: seats[0],
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: seats[1],
      },
    ],
  };
}

/**
 * Measures the deployed transaction wrapper from inside a deployed function, against a disposable fixture database.
 *
 * Everything this route does is bounded and armed from outside: it is absent unless the deployment carries both a
 * probe secret and a fixture connection string, it never reads `DATABASE_URL`, it runs at most five prepared
 * transitions, and it has no path that creates, resets or drops anything. A deployment that was never armed answers
 * every request the way it answers a request for a route that does not exist.
 *
 * It exists to answer one question the laptop cannot: what a result transition costs when the caller is a Vercel
 * function beside the database rather than a developer 72 ms away
 * @public
 */
export default defineEventHandler(async (event): Promise<IProbeReport> => {
  const secret: string | undefined = process.env.SPIKE_PROBE_SECRET;
  const fixture: string | undefined = process.env.SPIKE_PROBE_DATABASE_URL;

  // Unarmed deployments do not have this route. Not 401: a 401 would tell an unauthenticated caller that a probe
  // exists here at all, and this endpoint has nothing to say to anybody who was not given its secret
  if (!secret || !fixture) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const offered: string = (getRequestHeader(event, 'authorization') ?? '').replace(/^Bearer /, '');

  if (!matches(offered, secret)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const body = await readBody<{ samples?: number }>(event).catch((): Record<string, never> => ({}));
  const samples: number = Math.min(Math.max(Number(body?.samples ?? 1), 1), MAX_SAMPLES);
  const league: string = process.env.SPIKE_PROBE_LEAGUE_ID ?? '';
  const seats: string[] = (process.env.SPIKE_PROBE_SEATS ?? '').split(',').filter(Boolean);

  if (!league || seats.length < 2) {
    throw createError({ statusCode: 409, statusMessage: 'the fixture identifiers are not configured' });
  }

  const taken: IProbeSample[] = [];

  for (let sample: number = 0; sample < samples; sample += 1) {
    let phases: ITransactionPhases | undefined = undefined;
    let outcome: string = 'unknown';

    try {
      await withInteractiveTransaction(
        async (transaction): Promise<void> => {
          const result = await recordResult(transaction, seats[0]!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: Number(process.env.SPIKE_PROBE_LEAGUE_REVISION ?? '1'),
            leagueId: league,
            submission: submission([seats[0]!, seats[1]!]),
          });

          outcome = result.ok ? 'recorded' : result.refusal;
        },
        {
          connectionString: fixture,
          onPhases: (observed: ITransactionPhases): void => {
            phases = observed;
          },
        },
      );
    } catch (error: unknown) {
      outcome = error instanceof Error ? error.name : 'failed';
    }

    taken.push({ outcome, phases: phases ?? ({} as ITransactionPhases) });
  }

  return {
    configured: process.env.DATABASE_URL ? route(process.env.DATABASE_URL) : null,
    fixture: route(fixture),
    runtime: { region: process.env.VERCEL_REGION ?? null, url: process.env.VERCEL_URL ?? null },
    samples: taken,
  };
});
