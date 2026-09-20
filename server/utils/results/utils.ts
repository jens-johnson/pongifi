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
 * ██████████████████████████████████████████ #server/utils/results/utils.ts ███████████████████████████████████████████
 *
 * Recording, correcting, answering and settling a result, each in one serialized transaction.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createHash, randomUUID } from 'node:crypto';

import { ConfirmationStatus, GameStatus, ParticipantOutcome, RecordingMode, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type {
  IReconstructedGame,
  IReconstruction,
  IResultPolicySnapshot,
  IResultSubmission,
  SubmissionProblem,
} from '#shared/results';
import {
  canonicalize,
  findNoteProblem,
  findSubmissionProblem,
  normalizeSubmission,
  reconstructResult,
  ResultAction,
  ResultSettleReason,
  ResultState,
  Seat,
} from '#shared/results';
import type { IMatchSettings } from '#shared/rules-engine';
import { GameType, Side } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import type { IInteractiveTransaction } from '../db/types';
import { ADMIN_ROLES, HOUR_MS, SETTLEMENT_BATCH, VOID_ROLE } from './constants';
import { ResultRefusal } from './enums';
import { publishRatingGeneration } from './replay';
import type {
  IAmendResultRequest,
  IAnswerResultRequest,
  IRecordResultRequest,
  IResultCurrentState,
  IResultEffect,
  IRevisionRow,
  TResultOutcome,
} from './types';

/**
 * A refusal carrying the code a handler answers with. Thrown rather than returned so a refusal always unwinds the
 * transaction: there is no path where a write is refused and something it already did survives
 * @public
 */
export class ResultRefusalError extends Error {
  /** The refusal */
  public readonly refusal: ResultRefusal;

  /**
   * Builds a refusal carrying the code a handler answers with
   * @param refusal - Why the write was refused
   */
  public constructor(refusal: ResultRefusal) {
    super(refusal);
    this.name = 'ResultRefusalError';
    this.refusal = refusal;
  }
}

/**
 * The digest a retry is matched against. Taken over the normalized body, so the same facts in another order are the
 * same request rather than a changed one
 * @internal
 * @function
 * @param body - The request body
 * @returns Its digest
 */
function digest(body: unknown): string {
  return createHash('sha256').update(canonicalize(body)).digest('hex');
}

/**
 * Takes the league's lock.
 *
 * Every result write in a league passes through this one row, which is what makes two results settling at the same
 * moment sequential rather than interleaved. It reads no clock: `now()` is fixed when the transaction begins, so a
 * transaction that then waited two seconds for this lock would decide a deadline against a time it has already left
 * behind. The clock is sampled separately, once every lock a write needs is held ({@link sampleClock})
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param leagueId - The league
 * @throws ResultRefusalError when no such league exists
 * @returns The league's settings and its configuration revision
 */
async function lockLeague(
  transaction: IInteractiveTransaction,
  leagueId: string,
): Promise<{ configurationRevision: number; settings: TLeagueSettings }> {
  const { rows } = await transaction.query<{
    configuration_revision: number;
    settings: TLeagueSettings;
  }>(
    `SELECT "configuration_revision", "settings"
     FROM "leagues" WHERE "id" = $1 FOR UPDATE`,
    [leagueId],
  );
  const row = rows[0];

  if (!row) {
    throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
  }

  return {
    configurationRevision: row.configuration_revision,
    settings: row.settings,
  };
}

/**
 * Samples the database's wall clock, after every lock the write needs is already held.
 *
 * `clock_timestamp()` rather than `now()`, and its own statement rather than a column on the locking read, because the
 * two answer different questions: `now()` is the instant the transaction began and never moves, while this is the
 * instant the statement runs. A dispute whose transaction opened a minute before a deadline and reached the front of
 * the lock queue a minute after it has to meet the deadline it actually crossed, and only a clock read taken after the
 * wait can tell it so
 * @see {@link https://www.postgresql.org/docs/current/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT}
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction, already holding every lock the write needs
 * @returns The database's current wall time
 */
async function sampleClock(transaction: IInteractiveTransaction): Promise<Date> {
  const { rows } = await transaction.query<{ now: Date }>(`SELECT clock_timestamp() AS "now"`);

  return rows[0]!.now;
}

/**
 * Reads the access an account has to a league right now: an active membership held by a live account.
 *
 * Read under the league's lock and never taken from the result: a policy freezes at creation, but who may act never
 * does. A demoted manager loses the amendment their old role allowed, a removed member loses every action, and a
 * deleted account is nobody, which is why the membership row alone is not the whole question. This is also the check a
 * receipt is disclosed behind, so the answer has to be current rather than whatever was true when the operation first
 * ran
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param leagueId - The league
 * @param userId - The account
 * @returns Their role, or null when they hold no active membership or the account is gone
 */
async function readRole(
  transaction: IInteractiveTransaction,
  leagueId: string,
  userId: string,
): Promise<string | null> {
  const { rows } = await transaction.query<{ role: string }>(
    `SELECT m."role" FROM "memberships" m
     JOIN "users" u ON u."id" = m."user_id"
     WHERE m."league_id" = $1 AND m."user_id" = $2 AND m."status" = 'ACTIVE' AND u."deleted_at" IS NULL`,
    [leagueId, userId],
  );

  return rows[0]?.role ?? null;
}

/**
 * Whether every account a submission seats is still a live member of the league.
 *
 * A seat naming somebody who has left, or an account that has been deleted, is a body the member picker could not have
 * produced: the entry is refused rather than recorded against a roster it does not belong to
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction, already holding the league's lock
 * @param leagueId - The league
 * @param userIds - The accounts the submission seats
 * @returns Whether every one of them is an active member with a live account
 */
async function areLiveMembers(
  transaction: IInteractiveTransaction,
  leagueId: string,
  userIds: string[],
): Promise<boolean> {
  if (userIds.length === 0) {
    return true;
  }

  const { rows } = await transaction.query<{ live: number }>(
    `SELECT count(*)::int AS "live" FROM "memberships" m
     JOIN "users" u ON u."id" = m."user_id"
     WHERE m."league_id" = $1 AND m."user_id" = ANY($2::uuid[]) AND m."status" = 'ACTIVE' AND u."deleted_at" IS NULL`,
    [leagueId, userIds],
  );

  return (rows[0]?.live ?? 0) === userIds.length;
}

/**
 * Resolves the scoring rules a result is frozen under from the league's settings
 * @internal
 * @function
 * @param settings - The league's settings
 * @param gameType - The format being recorded
 * @returns The frozen scoring rules
 */
function toMatchSettings(settings: TLeagueSettings, gameType: GameType): IMatchSettings {
  return {
    cutthroatTimeCap: settings.cutthroatTimeCap,
    expediteEnabled: settings.expediteEnabled,
    gameType,
    matchFormat: gameType === GameType.CUTTHROAT ? 1 : settings.matchFormat,
    serviceInterval: settings.serviceInterval,
    targetScore: settings.targetScore[gameType],
    winningMargin: settings.winningMargin,
  };
}

/**
 * Resolves the administration policy a result is frozen under.
 *
 * Separate from the scoring rules because they answer different questions and a league can move either without the
 * other: the rules decide whether a score is a legal game, the policy decides who had to accept it and by when
 * @internal
 * @function
 * @param settings - The league's settings
 * @returns The frozen policy
 */
function toPolicySnapshot(settings: TLeagueSettings): IResultPolicySnapshot {
  return {
    provisionalGames: settings.provisionalGames,
    ratingEnabled: settings.ratingEnabled,
    requireConfirmation: settings.requireConfirmation,
    resultAmendmentWindow: settings.resultAmendmentWindow,
    resultConfirmationWindow: settings.resultConfirmationWindow,
    version: 1,
    whoCanRecordResults: settings.whoCanRecordResults,
  };
}

/**
 * The registered participants a revision has to hear from, frozen as it is born.
 *
 * Guests cannot answer, and the recorder does not confirm their own entry. A recorder who was not playing excludes
 * nobody, so a commissioner recording somebody else's match still needs both of them
 * @internal
 * @function
 * @param submission - The normalized submission
 * @param recorderId - Who recorded it
 * @returns The account ids that have to answer
 */
function requiredAnswerers(submission: IResultSubmission, recorderId: string): string[] {
  return submission.seats
    .map((seat): string | null => seat.userId)
    .filter((userId): userId is string => userId !== null && userId !== recorderId);
}

/**
 * The registered accounts a submission seats, guests dropped
 * @internal
 * @function
 * @param submission - The normalized submission
 * @returns The account ids in seat order
 */
function seatedMembers(submission: IResultSubmission): string[] {
  return submission.seats
    .map((seat): string | null => seat.userId)
    .filter((userId): userId is string => userId !== null);
}

/**
 * Writes a revision's game rows, seats and reconstructed events.
 *
 * Each revision owns its own rows outright: a correction that turns two games into three writes three new ones and
 * marks the old two superseded, rather than rewriting rows an earlier revision's audit still points at.
 *
 * The ids are minted by the caller rather than by the column's default, because revision one's first game id is the
 * match's canonical identity and the revision row has to name it before these rows exist. `matchId` groups a best-of-N
 * and is null for a one-game match, which is what the games table means by a standalone game
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param context - The revision these rows belong to
 * @returns The ids of the games written, in game order
 */
async function writeProjection(
  transaction: IInteractiveTransaction,
  context: {
    confirmationStatus: ConfirmationStatus;
    confirmedAt: Date | null;
    gameIds: string[];
    leagueId: string;
    matchId: string | null;
    playedAt: Date;
    reconstruction: IReconstruction;
    recorderId: string;
    revisionId: string;
    settings: IMatchSettings;
    submission: IResultSubmission;
  },
): Promise<string[]> {
  for (const [index, game] of context.reconstruction.games.entries()) {
    const status: GameStatus = game.isComplete ? GameStatus.COMPLETE : GameStatus.RETIRED;
    const gameId: string = context.gameIds[index]!;

    await transaction.query(
      `INSERT INTO "games" ("id", "league_id", "match_id", "game_number", "type", "status", "confirmation_status",
         "confirmed_at", "recording_mode", "settings_snapshot", "created_by", "recorder_user_id", "ended_at",
         "result_revision_id")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13)`,
      [
        gameId,
        context.leagueId,
        context.matchId,
        game.gameNumber,
        context.settings.gameType,
        status,
        context.confirmationStatus,
        context.confirmedAt,
        RecordingMode.RETROACTIVE,
        JSON.stringify(context.settings),
        context.recorderId,
        context.playedAt,
        context.revisionId,
      ],
    );
    await writeSeats(transaction, gameId, context.revisionId, context.submission, game);
    await writeEvents(transaction, gameId, context.revisionId, context.playedAt, game);
    await transaction.query(
      `INSERT INTO "result_revision_games" ("result_revision_id", "game_id", "game_number") VALUES ($1, $2, $3)`,
      [context.revisionId, gameId, game.gameNumber],
    );
  }

  return context.gameIds;
}

/**
 * Writes one game's seats, with the score and the outcome that game alone decided
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param gameId - The game
 * @param revisionId - The revision it belongs to
 * @param submission - The normalized submission
 * @param game - The reconstructed game
 */
async function writeSeats(
  transaction: IInteractiveTransaction,
  gameId: string,
  revisionId: string,
  submission: IResultSubmission,
  game: IReconstructedGame,
): Promise<void> {
  for (const seat of submission.seats) {
    const side: Side = seat.seat === Seat.A1 || seat.seat === Seat.A2 ? Side.A : Side.B;
    const outcome: ParticipantOutcome =
      game.winner === null
        ? ParticipantOutcome.NO_RESULT
        : side === game.winner
          ? ParticipantOutcome.WIN
          : ParticipantOutcome.LOSS;

    await transaction.query(
      `INSERT INTO "game_participants" ("game_id", "user_id", "guest_name", "side", "final_score", "outcome",
         "result_revision_id", "seat")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [gameId, seat.userId, seat.guestName, side, game.scores[side], outcome, revisionId, seat.seat],
    );
  }
}

/**
 * Writes one game's reconstructed events.
 *
 * They are stamped with the stated play time rather than with invented per-rally times, and carry no serving or
 * scoring account: a retroactive log reproduces the score and says nothing about how the rallies went (VII.IV)
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param gameId - The game
 * @param revisionId - The revision it belongs to
 * @param occurredAt - The match's stated play time
 * @param game - The reconstructed game
 */
async function writeEvents(
  transaction: IInteractiveTransaction,
  gameId: string,
  revisionId: string,
  occurredAt: Date,
  game: IReconstructedGame,
): Promise<void> {
  if (game.events.length === 0) {
    return;
  }

  await transaction.query(
    `INSERT INTO "game_events" ("game_id", "sequence", "type", "detail", "occurred_at", "result_revision_id")
     SELECT $1, e."sequence", e."type"::game_event_type, e."detail", $2, $3
     FROM json_to_recordset($4::json) AS e("sequence" int, "type" text, "detail" jsonb)`,
    [
      gameId,
      occurredAt,
      revisionId,
      JSON.stringify(
        game.events.map((event, index): Record<string, unknown> => ({
          detail: event,
          sequence: index,
          type: event.type,
        })),
      ),
    ],
  );
}

/**
 * Answers a replayed operation, or refuses one wearing the same key with a different body.
 *
 * A committed operation is answered from its receipt before anything else is checked, including whether the result
 * has since moved on: the person is asking what their action did, not asking to do it again. Only an action that
 * never committed is refused as stale
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param key - The operation's identity and digest
 * @throws ResultRefusalError when the same key arrives with a different body
 * @returns The recorded effect, or null when this operation has not committed
 */
async function replayOperation(
  transaction: IInteractiveTransaction,
  key: { actorId: string; clientOperationId: string; operation: string; requestDigest: string },
): Promise<IResultEffect | null> {
  const { rows } = await transaction.query<{ effect: IResultEffect; request_digest: string }>(
    `SELECT "effect", "request_digest" FROM "result_operations"
     WHERE "actor_user_id" = $1 AND "operation" = $2::result_operation AND "client_operation_id" = $3`,
    [key.actorId, key.operation, key.clientOperationId],
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  if (row.request_digest !== key.requestDigest) {
    throw new ResultRefusalError(ResultRefusal.OPERATION_BODY_CHANGED);
  }

  return row.effect;
}

/**
 * Records the receipt of a committed operation
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param receipt - The operation and what it did
 */
async function writeReceipt(
  transaction: IInteractiveTransaction,
  receipt: {
    actorId: string;
    canonicalMatchId: string;
    clientOperationId: string;
    effect: IResultEffect;
    operation: string;
    requestDigest: string;
    revisionId: string;
  },
): Promise<void> {
  await transaction.query(
    `INSERT INTO "result_operations" ("actor_user_id", "operation", "client_operation_id", "request_digest",
       "canonical_match_id", "result_revision_id", "effect")
     VALUES ($1, $2::result_operation, $3, $4, $5, $6, $7)`,
    [
      receipt.actorId,
      receipt.operation,
      receipt.clientOperationId,
      receipt.requestDigest,
      receipt.canonicalMatchId,
      receipt.revisionId,
      JSON.stringify(receipt.effect),
    ],
  );
}

/**
 * Whether a revision is settled the moment it is born, and why.
 *
 * The same question is asked of a correction as of a first entry: a league with confirmation off, or a match whose
 * only registered player is the person recording it, has nobody left to ask and settles at once. Anything else starts
 * a fresh pending revision with its own deadline
 * @internal
 * @function
 * @param policy - The frozen policy
 * @param answerers - The registered participants who would have to answer
 * @returns The state to be born in, with the deadline or the settlement reason
 */
function birthState(
  policy: IResultPolicySnapshot,
  answerers: string[],
): { reason: ResultSettleReason | null; state: ResultState } {
  if (!policy.requireConfirmation || answerers.length === 0) {
    return { reason: ResultSettleReason.NO_CONFIRMATION_NEEDED, state: ResultState.CONFIRMED };
  }

  return { reason: null, state: ResultState.UNCONFIRMED };
}

/**
 * Whether an account may record this result in this league
 * @internal
 * @function
 * @param policy - The frozen policy
 * @param role - The account's current role, or null when they are not a member
 * @param isSeated - Whether they are playing in the match
 * @returns Whether the recording is theirs to make
 */
function mayRecord(policy: IResultPolicySnapshot, role: string | null, isSeated: boolean): boolean {
  if (role === null) {
    return false;
  }

  return ADMIN_ROLES.includes(role) || (policy.whoCanRecordResults === ResultRecorder.PARTICIPANTS && isSeated);
}

/**
 * Runs the part of a write that may be refused, keeping anything the transaction already committed to.
 *
 * The savepoint is taken after settlement and authority, so a refusal unwinds the action and nothing else. A refusal is
 * then answered as a value, which lets the transaction commit the settlement it did on the way in; only an unexpected
 * failure still unwinds the whole thing.
 *
 * A success reports where the match stands afterwards as well as what the action did. They are read separately rather
 * than assumed equal, because the two differ on every replay and the caller has no way to tell from the effect alone
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param body - The part that may be refused
 * @param state - The state to report alongside a refusal
 * @throws Whatever the body throws that is not a refusal
 * @returns What the body did and where the match stands, or why it was refused
 */
async function refusable(
  transaction: IInteractiveTransaction,
  body: () => Promise<IResultEffect>,
  state: ResultState | null,
): Promise<TResultOutcome> {
  await transaction.query('SAVEPOINT result_action');

  try {
    const value: IResultEffect = await body();

    return {
      current: await readCurrentState(transaction, value.canonicalMatchId),
      ok: true,
      replayed: false,
      value,
    };
  } catch (error: unknown) {
    if (!(error instanceof ResultRefusalError)) {
      throw error;
    }

    await transaction.query('ROLLBACK TO SAVEPOINT result_action');

    return {
      ok: false,
      refusal: error.refusal,
      state,
    };
  }
}

/**
 * Reads where a match stands now: its current revision and that revision's state.
 *
 * Called after the caller's access to the league has been established, never before, and read under the same locks the
 * write holds. It is what a retry is told alongside the receipt it asked for, which is the only way a person whose
 * answer was lost learns both that their confirmation landed and that somebody has amended the result since
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param canonicalMatchId - The match
 * @throws ResultRefusalError when the match has no current revision
 * @returns The current revision and its state
 */
async function readCurrentState(
  transaction: IInteractiveTransaction,
  canonicalMatchId: string,
): Promise<IResultCurrentState> {
  const { rows } = await transaction.query<{
    canonical_match_id: string;
    id: string;
    revision: number;
    state: ResultState;
  }>(
    `SELECT "id", "canonical_match_id", "revision", "state" FROM "result_revisions"
     WHERE "canonical_match_id" = $1 AND "is_current"`,
    [canonicalMatchId],
  );
  const row = rows[0];

  if (!row) {
    throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
  }

  return {
    canonicalMatchId: row.canonical_match_id,
    revision: row.revision,
    resultRevisionId: row.id,
    state: row.state,
  };
}

/**
 * Answers a retry from its receipt, with where the match stands now beside it
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param effect - The effect the committed operation had
 * @returns The receipt and the current state
 */
async function replayed(transaction: IInteractiveTransaction, effect: IResultEffect): Promise<TResultOutcome> {
  return {
    current: await readCurrentState(transaction, effect.canonicalMatchId),
    ok: true,
    replayed: true,
    value: effect,
  };
}

/**
 * Writes the result, its rows and the ladder it changes, once access and the operation's identity are established
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account recording it
 * @param request - The submission and the operation's identity
 * @param context - The locked league, the sampled clock, the actor's current role and the normalized submission
 * @throws ResultRefusalError when the recording is refused
 * @returns What the operation did
 */
async function applyRecordResult(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IRecordResultRequest,
  context: {
    league: { configurationRevision: number; settings: TLeagueSettings };
    now: Date;
    requestDigest: string;
    role: string;
    submission: IResultSubmission;
  },
): Promise<IResultEffect> {
  const policy: IResultPolicySnapshot = toPolicySnapshot(context.league.settings);

  // Checked over the body as it arrived rather than the normalized copy: normalization trims and truncates, and a
  // guest label the form would have had to cut down is one nobody typed
  const problem: SubmissionProblem | null = findSubmissionProblem(request.submission, {
    earliest: context.now.getTime() - policy.resultAmendmentWindow * HOUR_MS,
    now: context.now.getTime(),
  });

  if (problem) {
    throw new ResultRefusalError(ResultRefusal.INVALID_SUBMISSION);
  }

  const submission: IResultSubmission = context.submission;
  const isSeated: boolean = submission.seats.some((seat): boolean => seat.userId === actorId);

  if (!mayRecord(policy, context.role, isSeated)) {
    throw new ResultRefusalError(ResultRefusal.FORBIDDEN);
  }

  if (context.league.configurationRevision !== request.expectedLeagueRevision) {
    throw new ResultRefusalError(ResultRefusal.STALE_LEAGUE_RULES);
  }

  if (!(await areLiveMembers(transaction, request.leagueId, seatedMembers(submission)))) {
    throw new ResultRefusalError(ResultRefusal.SEAT_NOT_A_MEMBER);
  }

  const settings: IMatchSettings = toMatchSettings(context.league.settings, submission.gameType);
  const reconstruction: IReconstruction = reconstruct(settings, submission);
  const answerers: string[] = requiredAnswerers(submission, actorId);
  const birth = birthState(policy, answerers);
  const playedAt: Date = new Date(submission.playedAt);
  const revisionId: string = randomUUID();

  // Minted here so the revision can name its canonical id: the match is addressed by revision one's first game for
  // the whole of its life, which is the URL the game page lives at and the id every later revision keeps
  const gameIds: string[] = reconstruction.games.map((): string => randomUUID());
  const canonicalMatchId: string = gameIds[0]!;
  const settledAt: Date | null = birth.reason ? context.now : null;
  const deadline: Date | null =
    birth.state === ResultState.UNCONFIRMED
      ? new Date(context.now.getTime() + policy.resultConfirmationWindow * HOUR_MS)
      : null;

  await transaction.query(
    `INSERT INTO "result_revisions" ("id", "canonical_match_id", "league_id", "revision", "is_current", "state",
       "game_type", "settings_snapshot", "policy_snapshot", "league_configuration_revision", "submission",
       "reconstruction", "reconstruction_version", "submission_digest", "played_at", "original_played_at",
       "submitted_at", "confirmation_deadline", "settled_at", "settled_reason", "recorded_by")
     VALUES ($1, $2, $3, 1, true, $4::result_state, $5::game_type, $6, $7, $8, $9, $10, $11, $12, $13, $13, $14, $15,
       $16, $17::result_settle_reason, $18)`,
    [
      revisionId,
      canonicalMatchId,
      request.leagueId,
      birth.state,
      submission.gameType,
      JSON.stringify(settings),
      JSON.stringify(policy),
      context.league.configurationRevision,
      JSON.stringify(submission),
      JSON.stringify(reconstruction),
      reconstruction.version,
      digest(submission),
      playedAt,
      context.now,
      deadline,
      settledAt,
      birth.reason,
      actorId,
    ],
  );

  await writeAnswerers(transaction, revisionId, answerers);
  await writeProjection(transaction, {
    confirmationStatus:
      birth.state === ResultState.CONFIRMED ? ConfirmationStatus.CONFIRMED : ConfirmationStatus.UNCONFIRMED,
    // The moment the result was accepted, which is this submission, not the moment the match was played
    confirmedAt: birth.state === ResultState.CONFIRMED ? context.now : null,
    gameIds,
    leagueId: request.leagueId,
    matchId: gameIds.length > 1 ? canonicalMatchId : null,
    playedAt,
    reconstruction,
    recorderId: actorId,
    revisionId,
    settings,
    submission,
  });

  await publishRatingGeneration(transaction, request.leagueId, revisionId);

  const effect: IResultEffect = {
    canonicalMatchId,
    revision: 1,
    resultRevisionId: revisionId,
    state: birth.state,
  };

  await writeReceipt(transaction, {
    actorId,
    canonicalMatchId,
    clientOperationId: request.clientOperationId,
    effect,
    operation: 'CREATE',
    requestDigest: context.requestDigest,
    revisionId,
  });

  return effect;
}

/**
 * Records a result, answering with what it did or why it was refused.
 *
 * The order is fixed and every step of it is load-bearing. The league's lock first, so two results in one league are
 * sequential. The database's clock next, sampled under that lock rather than at the transaction's start. Then the
 * caller's current access to the league, because a receipt is a private fact about a result and belongs only to
 * somebody who may read that result today. Then the receipt, so a retry is answered rather than written twice, and
 * answered before any check about whether the request would be accepted afresh — the person is asking what their
 * action did, not asking to do it again. Only then the bounds, the authority, the league's configuration revision, the
 * reconstruction, and the write
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account recording it
 * @param request - The submission and the operation's identity
 * @returns What the operation did and where the match stands, or the refusal
 */
export async function recordResult(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IRecordResultRequest,
): Promise<TResultOutcome> {
  try {
    const submission: IResultSubmission = normalizeSubmission(request.submission);
    const requestDigest: string = digest({ ...request, submission });
    const league = await lockLeague(transaction, request.leagueId);
    const now: Date = await sampleClock(transaction);
    const role: string | null = await readRole(transaction, request.leagueId, actorId);

    if (role === null) {
      throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
    }

    // Checked under the lock, not before it: two identical creates that arrived together both find no receipt outside
    // it, and the one that waits has to see the other's before it writes a second result
    const receipt: IResultEffect | null = await replayOperation(transaction, {
      actorId,
      clientOperationId: request.clientOperationId,
      operation: 'CREATE',
      requestDigest,
    });

    if (receipt) {
      return await replayed(transaction, receipt);
    }

    return await refusable(
      transaction,
      (): Promise<IResultEffect> =>
        applyRecordResult(transaction, actorId, request, {
          league,
          now,
          requestDigest,
          role,
          submission,
        }),
      null,
    );
  } catch (error: unknown) {
    if (error instanceof ResultRefusalError) {
      return {
        ok: false,
        refusal: error.refusal,
        state: null,
      };
    }

    throw error;
  }
}

/**
 * Runs the reconstruction and turns its refusal into one a handler can answer
 * @internal
 * @function
 * @param settings - The frozen scoring rules
 * @param submission - The normalized submission
 * @throws ResultRefusalError when no legal match under these rules produces the entered scores
 * @returns The reconstruction
 */
function reconstruct(settings: IMatchSettings, submission: IResultSubmission): IReconstruction {
  try {
    return reconstructResult(settings, submission);
  } catch {
    throw new ResultRefusalError(ResultRefusal.UNPLAYABLE);
  }
}

/**
 * Freezes the accounts a revision is waiting on
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param revisionId - The revision
 * @param answerers - The accounts
 */
async function writeAnswerers(
  transaction: IInteractiveTransaction,
  revisionId: string,
  answerers: string[],
): Promise<void> {
  for (const userId of answerers) {
    await transaction.query(
      `INSERT INTO "result_required_answerers" ("result_revision_id", "user_id") VALUES ($1, $2)`,
      [revisionId, userId],
    );
  }
}

/**
 * Reads which league a match belongs to, without locking anything.
 *
 * Taken before the league's lock so the lock order is always league first and result second, whichever way in a
 * caller arrived. A league never moves, so reading it unlocked cannot go stale; anything that could is re-read
 * underneath the locks
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param canonicalMatchId - The match
 * @throws ResultRefusalError when no such match exists
 * @returns The league's id
 */
async function readLeagueOfMatch(transaction: IInteractiveTransaction, canonicalMatchId: string): Promise<string> {
  const { rows } = await transaction.query<{ league_id: string }>(
    `SELECT "league_id" FROM "result_revisions" WHERE "canonical_match_id" = $1 LIMIT 1`,
    [canonicalMatchId],
  );

  if (!rows[0]) {
    throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
  }

  return rows[0].league_id;
}

/**
 * Reads and locks the current revision of a match.
 *
 * Locked as well as read, so two people answering the same result meet each other here rather than both deciding
 * against the same snapshot. The league's lock is taken first and always in that order, which is what keeps two
 * results in one league from deadlocking against each other
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param canonicalMatchId - The match
 * @throws ResultRefusalError when the match has no current revision
 * @returns The current revision
 */
async function lockCurrentRevision(
  transaction: IInteractiveTransaction,
  canonicalMatchId: string,
): Promise<IRevisionRow> {
  const { rows } = await transaction.query<{
    canonical_match_id: string;
    confirmation_deadline: Date | null;
    game_type: string;
    id: string;
    league_id: string;
    original_played_at: Date;
    played_at: Date;
    policy_snapshot: IResultPolicySnapshot;
    recorded_by: string;
    revision: number;
    settings_snapshot: IMatchSettings;
    state: ResultState;
    submission: IResultSubmission;
  }>(
    `SELECT "id", "canonical_match_id", "league_id", "revision", "state", "game_type", "settings_snapshot",
       "policy_snapshot", "submission", "played_at", "original_played_at", "confirmation_deadline", "recorded_by"
     FROM "result_revisions" WHERE "canonical_match_id" = $1 AND "is_current" FOR UPDATE`,
    [canonicalMatchId],
  );
  const row = rows[0];

  if (!row) {
    throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
  }

  return {
    canonicalMatchId: row.canonical_match_id,
    confirmationDeadline: row.confirmation_deadline,
    gameType: row.game_type,
    id: row.id,
    leagueId: row.league_id,
    originalPlayedAt: row.original_played_at,
    playedAt: row.played_at,
    policySnapshot: row.policy_snapshot,
    recordedBy: row.recorded_by,
    revision: row.revision,
    settingsSnapshot: row.settings_snapshot,
    state: row.state,
    submission: row.submission,
  };
}

/**
 * Moves a revision to a settled state and carries its game rows with it
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param revisionId - The revision
 * @param state - The state it settles into
 * @param reason - Why
 * @param at - The database time the transition is stamped with
 */
async function settleRevision(
  transaction: IInteractiveTransaction,
  revisionId: string,
  state: ResultState,
  reason: ResultSettleReason,
  at: Date,
): Promise<void> {
  await transaction.query(
    `UPDATE "result_revisions" SET "state" = $2::result_state, "settled_at" = $3, "settled_reason" = $4::result_settle_reason
     WHERE "id" = $1`,
    [revisionId, state, at, reason],
  );
  await transaction.query(
    `UPDATE "games" SET "confirmation_status" = 'CONFIRMED', "confirmed_at" = $2, "updated_at" = now()
     WHERE "result_revision_id" = $1`,
    [revisionId, at],
  );
}

/**
 * Settles a revision whose confirmation window has already passed, before anything else is decided about it.
 *
 * A dispute arriving after the deadline is late, and a deadline reached while nobody was looking is still reached:
 * the only way to answer both consistently is to settle the overdue revision first, under the same lock, and then
 * let the incoming action meet the state it actually finds. Disputed and void revisions never settle this way
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param revision - The current revision, already locked
 * @param now - The database clock, sampled under the locks
 * @returns Whether the revision settled here
 */
async function settleIfDue(transaction: IInteractiveTransaction, revision: IRevisionRow, now: Date): Promise<boolean> {
  if (
    revision.state !== ResultState.UNCONFIRMED ||
    revision.confirmationDeadline === null ||
    revision.confirmationDeadline.getTime() > now.getTime()
  ) {
    return false;
  }

  await settleRevision(transaction, revision.id, ResultState.CONFIRMED, ResultSettleReason.DEADLINE_PASSED, now);
  await publishRatingGeneration(transaction, revision.leagueId, revision.id);

  return true;
}

/**
 * Settles every result in a league whose window has passed, and republishes the ladder once for all of them.
 *
 * This is the operation both the daily sweep and an authenticated read call. It is bounded to one league and awaited
 * rather than started and forgotten: a page that showed Confirmed while the settlement was still running would be
 * claiming something no reader could verify
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param leagueId - The league to settle
 * @param batch - The most revisions one run will settle, so a neglected league cannot outgrow one transaction
 * @returns How many revisions settled
 */
export async function settleDueResults(
  transaction: IInteractiveTransaction,
  leagueId: string,
  batch: number = SETTLEMENT_BATCH,
): Promise<number> {
  await lockLeague(transaction, leagueId);

  // Sampled under the league's lock, which every result write in the league passes through, so no revision this sweep
  // is about to read can move between the clock read and the row locks
  const now: Date = await sampleClock(transaction);
  const { rows } = await transaction.query<{ id: string }>(
    `SELECT "id" FROM "result_revisions"
     WHERE "league_id" = $1 AND "is_current" AND "state" = 'UNCONFIRMED'
       AND "confirmation_deadline" IS NOT NULL AND "confirmation_deadline" <= $2
     ORDER BY "confirmation_deadline"
     LIMIT $3
     FOR UPDATE`,
    [leagueId, now, batch],
  );

  for (const row of rows) {
    await settleRevision(transaction, row.id, ResultState.CONFIRMED, ResultSettleReason.DEADLINE_PASSED, now);
  }

  if (rows.length > 0) {
    await publishRatingGeneration(transaction, leagueId, rows.at(-1)!.id);
  }

  return rows.length;
}

/**
 * Whether every account a revision was waiting on has now confirmed it
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param revisionId - The revision
 * @returns Whether the revision has its full set
 */
async function isFullyConfirmed(transaction: IInteractiveTransaction, revisionId: string): Promise<boolean> {
  const { rows } = await transaction.query<{ outstanding: number }>(
    `SELECT count(*)::int AS "outstanding"
     FROM "result_required_answerers" r
     WHERE r."result_revision_id" = $1
       AND NOT EXISTS (
         SELECT 1 FROM "result_actions" a
         WHERE a."result_revision_id" = r."result_revision_id"
           AND a."actor_user_id" = r."user_id"
           AND a."type" = 'CONFIRM'
       )`,
    [revisionId],
  );

  return (rows[0]?.outstanding ?? 1) === 0;
}

/**
 * Whether an account is one of the registered participants this revision is waiting on.
 *
 * Confirming is that set's alone: it was frozen when the revision was born, it excludes guests and the recorder, and a
 * confirmation from anybody else would be a vote nobody asked for on a result that does not need it. Disputing is
 * wider by design, and checked separately
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param revisionId - The revision
 * @param userId - The account
 * @returns Whether the revision is waiting on them
 */
async function isRequiredAnswerer(
  transaction: IInteractiveTransaction,
  revisionId: string,
  userId: string,
): Promise<boolean> {
  const { rows } = await transaction.query<{ required: number }>(
    `SELECT count(*)::int AS "required" FROM "result_required_answerers"
     WHERE "result_revision_id" = $1 AND "user_id" = $2`,
    [revisionId, userId],
  );

  return (rows[0]?.required ?? 0) > 0;
}

/**
 * Locks every account the match names, and reports whether any of them is gone.
 *
 * This is one half of the protocol a deletion and a new note share; {@link redactNotesForAccount} is the other. A note
 * can name whoever wrote it and whoever played in any revision of the match it belongs to, so those are the rows a
 * note writer holds while it decides whether words may be stored: a deletion that has already committed is seen here,
 * and a deletion that has not yet run has to wait behind this lock and will find the new note when it scans.
 *
 * The accounts are locked last, after the league and the revision, and read in id order. The league's lock is what
 * actually serializes two note writers in one league; the ordering is there so nothing in a later slice can make a
 * cycle out of these two by accident
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction, already holding the league and revision locks
 * @param canonicalMatchId - The match whose participants a note could name
 * @param actorId - The account writing the note
 * @returns Whether any account the note could identify has been deleted
 */
async function lockAccountsOfMatch(
  transaction: IInteractiveTransaction,
  canonicalMatchId: string,
  actorId: string,
): Promise<boolean> {
  const { rows: participants } = await transaction.query<{ user_id: string }>(
    `SELECT DISTINCT p."user_id" FROM "game_participants" p
     JOIN "result_revisions" r ON r."id" = p."result_revision_id"
     WHERE r."canonical_match_id" = $1 AND p."user_id" IS NOT NULL`,
    [canonicalMatchId],
  );
  const named: string[] = [...new Set([actorId, ...participants.map((row): string => row.user_id)])];
  const { rows: locked } = await transaction.query<{ deleted_at: Date | null }>(
    `SELECT "deleted_at" FROM "users" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR SHARE`,
    [named],
  );

  return locked.some((row): boolean => row.deleted_at !== null);
}

/**
 * Stores a dispute's words, or the fact that there were words, when somebody the note could name has been deleted.
 *
 * A deleted participant does not cost a live player their dispute: the action is recorded either way. What changes is
 * that the words are never written, and the row is born carrying the same redaction stamp a later deletion would have
 * left on it, so the audit reads identically whichever order the two events arrived in
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param context - The action the note hangs off, the match it names, its author, its words and the database clock
 * @returns Whether the note was born redacted
 */
async function writeDisputeNote(
  transaction: IInteractiveTransaction,
  context: { actionId: string; actorId: string; canonicalMatchId: string; note: string; now: Date },
): Promise<boolean> {
  const deleted: boolean = await lockAccountsOfMatch(transaction, context.canonicalMatchId, context.actorId);

  await transaction.query(
    `INSERT INTO "result_dispute_notes" ("result_action_id", "body", "redacted_at") VALUES ($1, $2, $3)`,
    [context.actionId, deleted ? null : context.note, deleted ? context.now : null],
  );

  return deleted;
}

/**
 * Confirms, disputes or voids a revision.
 *
 * Every one of them is the same shape, and the order is the same one every result write uses: the league's lock, the
 * revision's lock, the database's clock sampled underneath both of them, the caller's current access to the league,
 * and only then the receipt. A retry is answered from that receipt before anything is asked about whether the action
 * would be accepted afresh, and the answer carries where the match stands now beside what the action originally did.
 *
 * After that, an overdue revision is settled first, and the action meets the state it actually finds. A confirmation is
 * one row per person per revision, so a repeat is a unique-key conflict rather than a second vote, and only a
 * participant the revision is waiting on may cast one. A seated participant may dispute a pending revision even having
 * confirmed it, or having recorded it. A dispute stops the deadline from settling it; a void is a commissioner's and
 * takes the result out of every count and ladder
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account acting
 * @param request - The action and the operation's identity
 * @returns What the operation did and where the match stands, or the refusal alongside the state the result is in
 */
export async function answerResult(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IAnswerResultRequest,
): Promise<TResultOutcome> {
  try {
    const requestDigest: string = digest(request);

    await lockLeague(transaction, await readLeagueOfMatch(transaction, request.canonicalMatchId));

    const revision: IRevisionRow = await lockCurrentRevision(transaction, request.canonicalMatchId);
    const now: Date = await sampleClock(transaction);
    const role: string | null = await readRole(transaction, revision.leagueId, actorId);

    if (role === null) {
      throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
    }

    // Under the locks, so a retry that raced its own original sees the receipt rather than writing a second action
    const receipt: IResultEffect | null = await replayOperation(transaction, {
      actorId,
      clientOperationId: request.clientOperationId,
      operation: request.action,
      requestDigest,
    });

    if (receipt) {
      return await replayed(transaction, receipt);
    }

    if (findNoteProblem(request.note, request.action === ResultAction.DISPUTE)) {
      throw new ResultRefusalError(ResultRefusal.INVALID_SUBMISSION);
    }

    // Settled before the action is judged, and outside the savepoint the action unwinds to: a result that reached its
    // deadline reached it, whether or not the action that noticed is one this league will accept
    await settleIfDue(transaction, revision, now);

    const current: IRevisionRow = await lockCurrentRevision(transaction, request.canonicalMatchId);

    return await refusable(
      transaction,
      (): Promise<IResultEffect> => applyAnswerAction(transaction, actorId, request, current, now, role, requestDigest),
      current.state,
    );
  } catch (error: unknown) {
    if (error instanceof ResultRefusalError) {
      return {
        ok: false,
        refusal: error.refusal,
        state: null,
      };
    }

    throw error;
  }
}

/**
 * Records the action itself, once settlement and authority have been established
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account acting
 * @param request - The action and the operation's identity
 * @param current - The current revision, locked and settled if it was due
 * @param now - The database clock, sampled under the locks
 * @param role - The actor's current role in the league
 * @param requestDigest - The digest the receipt is keyed by
 * @throws ResultRefusalError when the action is refused
 * @returns What the action did
 */
async function applyAnswerAction(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IAnswerResultRequest,
  current: IRevisionRow,
  now: Date,
  role: string,
  requestDigest: string,
): Promise<IResultEffect> {
  if (current.revision !== request.expectedRevision) {
    throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
  }

  if (request.action === ResultAction.VOID) {
    if (role !== VOID_ROLE) {
      throw new ResultRefusalError(ResultRefusal.FORBIDDEN);
    }

    // A commissioner may void a result in any state but the one it is already in; a second void is not a second ruling
    if (current.state === ResultState.VOID) {
      throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
    }
  } else if (current.state !== ResultState.UNCONFIRMED) {
    throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
  } else if (request.action === ResultAction.CONFIRM) {
    if (!(await isRequiredAnswerer(transaction, current.id, actorId))) {
      throw new ResultRefusalError(ResultRefusal.FORBIDDEN);
    }
  } else if (!current.submission.seats.some((seat): boolean => seat.userId === actorId)) {
    throw new ResultRefusalError(ResultRefusal.FORBIDDEN);
  }

  const { rows: actions } = await transaction.query<{ id: string }>(
    `INSERT INTO "result_actions" ("result_revision_id", "actor_user_id", "type")
     VALUES ($1, $2, $3::result_action)
     ON CONFLICT ("result_revision_id", "actor_user_id", "type") DO NOTHING
     RETURNING "id"`,
    [current.id, actorId, request.action],
  );

  if (actions.length === 0) {
    throw new ResultRefusalError(ResultRefusal.ALREADY_ANSWERED);
  }

  if (request.action === ResultAction.DISPUTE && request.note !== null) {
    await writeDisputeNote(transaction, {
      actionId: actions[0]!.id,
      actorId,
      canonicalMatchId: current.canonicalMatchId,
      note: request.note,
      now,
    });
  }

  const state: ResultState = await applyAnswer(transaction, current, request.action, now);
  const effect: IResultEffect = {
    canonicalMatchId: current.canonicalMatchId,
    revision: current.revision,
    resultRevisionId: current.id,
    state,
  };

  await writeReceipt(transaction, {
    actorId,
    canonicalMatchId: current.canonicalMatchId,
    clientOperationId: request.clientOperationId,
    effect,
    operation: request.action,
    requestDigest,
    revisionId: current.id,
  });

  return effect;
}

/**
 * Moves the revision to whatever the recorded action means for it, and republishes the ladder when that changes what
 * the league's ratings are built from
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param revision - The locked current revision
 * @param action - The action just recorded
 * @param now - The database clock, sampled under the locks
 * @returns The revision's state afterwards
 */
async function applyAnswer(
  transaction: IInteractiveTransaction,
  revision: IRevisionRow,
  action: ResultAction,
  now: Date,
): Promise<ResultState> {
  if (action === ResultAction.VOID) {
    await transaction.query(
      `UPDATE "result_revisions" SET "state" = 'VOID', "settled_at" = $2, "settled_reason" = 'VOIDED'
       WHERE "id" = $1`,
      [revision.id, now],
    );
    // A voided result leaves every count and every ladder on its status alone, and keeps its rows addressable for the
    // audit that follows. It is not stamped superseded: that mark means a later revision replaced these rows, and
    // reading the two as one thing would make a commissioner's ruling indistinguishable from a correction
    await transaction.query(
      `UPDATE "games" SET "status" = 'VOID', "updated_at" = now() WHERE "result_revision_id" = $1`,
      [revision.id],
    );
    await publishRatingGeneration(transaction, revision.leagueId, revision.id);

    return ResultState.VOID;
  }

  if (action === ResultAction.DISPUTE) {
    await transaction.query(`UPDATE "result_revisions" SET "state" = 'DISPUTED' WHERE "id" = $1`, [revision.id]);
    await transaction.query(
      `UPDATE "games" SET "confirmation_status" = 'DISPUTED', "updated_at" = now() WHERE "result_revision_id" = $1`,
      [revision.id],
    );

    return ResultState.DISPUTED;
  }

  if (!(await isFullyConfirmed(transaction, revision.id))) {
    return ResultState.UNCONFIRMED;
  }

  await settleRevision(transaction, revision.id, ResultState.CONFIRMED, ResultSettleReason.CONFIRMED_BY_ALL, now);
  await publishRatingGeneration(transaction, revision.leagueId, revision.id);

  return ResultState.CONFIRMED;
}

/**
 * Corrects a result by appending a revision.
 *
 * Only a disputed result is corrected in this slice. The mechanism is the same one a confirmed result's correction will
 * use, but the entry point is not approved yet, and a service that accepted any state would let a manager rewrite an
 * accepted score with nobody having questioned it. A wrong accepted result is voided by a commissioner and re-entered
 * until that follow-up ships.
 *
 * The correction keeps the original's frozen format, scoring rules and policy: a league that changed its rules since
 * the match was played must not pull the correction onto the new ones, and the amendment window is measured from the
 * play time the first revision stated, so editing the time cannot revive an expired window. Everything else is born
 * fresh — a new answerer set, a new deadline, new game rows — under the same birth rule a first entry uses, so a
 * correction with nobody left to ask settles in the operation that made it
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account correcting it
 * @param request - The corrected submission and the operation's identity
 * @returns What the operation did and where the match stands, or the refusal
 */
export async function amendResult(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IAmendResultRequest,
): Promise<TResultOutcome> {
  try {
    const submission: IResultSubmission = normalizeSubmission(request.submission);
    const requestDigest: string = digest({ ...request, submission });
    const league = await lockLeague(transaction, await readLeagueOfMatch(transaction, request.canonicalMatchId));
    const previous: IRevisionRow = await lockCurrentRevision(transaction, request.canonicalMatchId);
    const now: Date = await sampleClock(transaction);
    const role: string | null = await readRole(transaction, previous.leagueId, actorId);

    if (role === null) {
      throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
    }

    // Under the locks, so a retry that raced its own original is answered from the receipt rather than amending twice
    const receipt: IResultEffect | null = await replayOperation(transaction, {
      actorId,
      clientOperationId: request.clientOperationId,
      operation: 'AMEND',
      requestDigest,
    });

    if (receipt) {
      return await replayed(transaction, receipt);
    }

    // Recording a result grants no amendment right of its own; an active manager or commissioner amends under the role
    if (!ADMIN_ROLES.includes(role)) {
      throw new ResultRefusalError(ResultRefusal.FORBIDDEN);
    }

    await settleIfDue(transaction, previous, now);

    const current: IRevisionRow = await lockCurrentRevision(transaction, request.canonicalMatchId);

    return await refusable(
      transaction,
      (): Promise<IResultEffect> =>
        applyAmendment(transaction, actorId, request, current, {
          configurationRevision: league.configurationRevision,
          now,
          requestDigest,
          submission,
        }),
      current.state,
    );
  } catch (error: unknown) {
    if (error instanceof ResultRefusalError) {
      return {
        ok: false,
        refusal: error.refusal,
        state: null,
      };
    }

    throw error;
  }
}

/**
 * Writes the corrected revision, once settlement and authority have been established
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account correcting it
 * @param request - The corrected submission and the operation's identity
 * @param current - The current revision, locked and settled if it was due
 * @param context - The league's configuration revision, the sampled clock, the digest and the normalized submission
 * @throws ResultRefusalError when the correction is refused
 * @returns What the correction did
 */
async function applyAmendment(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IAmendResultRequest,
  current: IRevisionRow,
  context: { configurationRevision: number; now: Date; requestDigest: string; submission: IResultSubmission },
): Promise<IResultEffect> {
  if (current.revision !== request.expectedRevision) {
    throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
  }

  // The approved slice corrects a disputed result and nothing else: an unconfirmed result is still being answered, an
  // accepted one is a void and a re-entry, and a voided one is finished
  if (current.state !== ResultState.DISPUTED) {
    throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
  }

  const window: number = current.policySnapshot.resultAmendmentWindow * HOUR_MS;
  const bound: number = current.originalPlayedAt.getTime() + window;

  if (context.now.getTime() > bound) {
    throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
  }

  // The corrected play time is bounded by the window measured from the time the first revision stated, not from now: a
  // correction may move the time within the window the match was entered under, and cannot push it into the future
  const problem: SubmissionProblem | null = findSubmissionProblem(request.submission, {
    earliest: current.originalPlayedAt.getTime() - window,
    now: context.now.getTime(),
  });

  if (problem) {
    throw new ResultRefusalError(ResultRefusal.INVALID_SUBMISSION);
  }

  // The frozen format wins over whatever the corrected body claims: a correction is not a way onto other rules
  const submission: IResultSubmission = normalizeSubmission({
    ...context.submission,
    gameType: current.settingsSnapshot.gameType,
  });

  if (!(await areLiveMembers(transaction, current.leagueId, seatedMembers(submission)))) {
    throw new ResultRefusalError(ResultRefusal.SEAT_NOT_A_MEMBER);
  }

  const reconstruction: IReconstruction = reconstruct(current.settingsSnapshot, submission);
  const answerers: string[] = requiredAnswerers(submission, actorId);
  const birth = birthState(current.policySnapshot, answerers);
  const playedAt: Date = new Date(submission.playedAt);
  const revisionId: string = randomUUID();
  const gameIds: string[] = reconstruction.games.map((): string => randomUUID());
  const deadline: Date | null =
    birth.state === ResultState.UNCONFIRMED
      ? new Date(context.now.getTime() + current.policySnapshot.resultConfirmationWindow * HOUR_MS)
      : null;

  await transaction.query(`UPDATE "result_revisions" SET "is_current" = NULL WHERE "id" = $1`, [current.id]);
  await transaction.query(
    `UPDATE "games" SET "superseded_at" = $2, "updated_at" = now() WHERE "result_revision_id" = $1`,
    [current.id, context.now],
  );

  await transaction.query(
    `INSERT INTO "result_revisions" ("id", "canonical_match_id", "league_id", "revision", "is_current", "state",
       "game_type", "settings_snapshot", "policy_snapshot", "league_configuration_revision", "submission",
       "reconstruction", "reconstruction_version", "submission_digest", "played_at", "original_played_at",
       "submitted_at", "confirmation_deadline", "settled_at", "settled_reason", "recorded_by", "edited_by")
     VALUES ($1, $2, $3, $4, true, $5::result_state, $6::game_type, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       $17, $18, $19::result_settle_reason, $20, $21)`,
    [
      revisionId,
      current.canonicalMatchId,
      current.leagueId,
      current.revision + 1,
      birth.state,
      current.settingsSnapshot.gameType,
      JSON.stringify(current.settingsSnapshot),
      JSON.stringify(current.policySnapshot),
      context.configurationRevision,
      JSON.stringify(submission),
      JSON.stringify(reconstruction),
      reconstruction.version,
      digest(submission),
      playedAt,
      current.originalPlayedAt,
      context.now,
      deadline,
      birth.reason ? context.now : null,
      birth.reason,
      current.recordedBy,
      actorId,
    ],
  );

  await writeAnswerers(transaction, revisionId, answerers);
  await writeProjection(transaction, {
    confirmationStatus:
      birth.state === ResultState.CONFIRMED ? ConfirmationStatus.CONFIRMED : ConfirmationStatus.UNCONFIRMED,
    confirmedAt: birth.state === ResultState.CONFIRMED ? context.now : null,
    gameIds,
    leagueId: current.leagueId,
    // The match keeps the identity revision one gave it, and a correction down to a single game is a standalone row
    matchId: gameIds.length > 1 ? current.canonicalMatchId : null,
    playedAt,
    reconstruction,
    recorderId: current.recordedBy,
    revisionId,
    settings: current.settingsSnapshot,
    submission,
  });

  await publishRatingGeneration(transaction, current.leagueId, revisionId);

  const effect: IResultEffect = {
    canonicalMatchId: current.canonicalMatchId,
    revision: current.revision + 1,
    resultRevisionId: revisionId,
    state: birth.state,
  };

  await writeReceipt(transaction, {
    actorId,
    canonicalMatchId: current.canonicalMatchId,
    clientOperationId: request.clientOperationId,
    effect,
    operation: 'AMEND',
    requestDigest: context.requestDigest,
    revisionId,
  });

  return effect;
}

/**
 * Resolves any game id of a match to the page that match lives at, for a caller who may read it.
 *
 * A match is addressed by revision one's first game id for the whole of its life. Game two of a best-of-three, and
 * every game row a superseded revision left behind, have no page of their own and resolve here instead. Access is
 * checked before anything is resolved, and a caller who is not an active member of the league named in the URL is told
 * the same thing about a real match as about an imaginary one
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account asking
 * @param leagueId - The league the URL names
 * @param gameId - The game id the URL names
 * @returns The canonical match id, or null when the caller may not read it or it does not exist
 */
export async function resolveMatchRoute(
  transaction: IInteractiveTransaction,
  actorId: string,
  leagueId: string,
  gameId: string,
): Promise<string | null> {
  if ((await readRole(transaction, leagueId, actorId)) === null) {
    return null;
  }

  const { rows } = await transaction.query<{ canonical_match_id: string }>(
    `SELECT r."canonical_match_id" FROM "result_revision_games" rg
     JOIN "result_revisions" r ON r."id" = rg."result_revision_id"
     WHERE rg."game_id" = $1 AND r."league_id" = $2
     LIMIT 1`,
    [gameId, leagueId],
  );

  return rows[0]?.canonical_match_id ?? null;
}

/**
 * Redacts every dispute note a deleted account is identified by.
 *
 * Two people are covered, because a note can name either: whoever wrote it, and anybody seated in any revision of the
 * match it belongs to. The words go and the row stays, so history still shows that a note was written and then
 * removed, and every score, rating and receipt the result rests on is untouched.
 *
 * A note written after the deletion has no words to remove: the writer finds the deleted participant under the shared
 * account lock and stores the row already redacted ({@link writeDisputeNote}), which is why calling this from account
 * deletion is only half of the requirement.
 *
 * What this cannot do is find a third party named inside somebody else's sentence. Free text is not an index of
 * people, and pretending otherwise would be a promise nothing here keeps; that limit belongs in the deletion copy
 * rather than in a heuristic
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param userId - The account being deleted
 * @returns How many notes were redacted
 */
export async function redactNotesForAccount(transaction: IInteractiveTransaction, userId: string): Promise<number> {
  // The other half of the protocol {@link lockAccountsOfMatch} describes. Taking the account row first is what makes
  // the two orders equivalent: a note writer that got here first holds this row until it commits, so the scan below
  // sees its note; one that arrives later finds the deletion this transaction is part of and never writes the words
  await transaction.query(`SELECT "id" FROM "users" WHERE "id" = $1 FOR UPDATE`, [userId]);

  const { rows } = await transaction.query<{ id: string }>(
    `UPDATE "result_dispute_notes" AS n
     SET "body" = NULL, "redacted_at" = now()
     FROM "result_actions" AS a
     JOIN "result_revisions" AS r ON r."id" = a."result_revision_id"
     WHERE n."result_action_id" = a."id"
       AND n."body" IS NOT NULL
       AND (
         a."actor_user_id" = $1
         OR EXISTS (
           SELECT 1 FROM "result_revisions" AS r2
           JOIN "game_participants" AS p ON p."result_revision_id" = r2."id"
           WHERE r2."canonical_match_id" = r."canonical_match_id" AND p."user_id" = $1
         )
       )
     RETURNING n."result_action_id" AS "id"`,
    [userId],
  );

  return rows.length;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suites can title their describe blocks from the source symbols
defineSymbol(recordResult, {
  name: 'Record Result',
  description: 'Records a result, proves it playable, and publishes the ladder it changes.',
});

defineSymbol(amendResult, {
  name: 'Amend Result',
  description: 'Corrects a result by appending a revision under the original frozen rules.',
});

defineSymbol(answerResult, {
  name: 'Answer Result',
  description: 'Confirms, disputes or voids one revision of a result.',
});

defineSymbol(redactNotesForAccount, {
  name: 'Redact Notes For Account',
  description: 'Redacts every dispute note a deleted account is identified by, across all revisions.',
});

defineSymbol(resolveMatchRoute, {
  name: 'Resolve Match Route',
  description: 'Resolves any game id of a match to the canonical page, for a caller who may read it.',
});

defineSymbol(settleDueResults, {
  name: 'Settle Due Results',
  description: 'Settles every result in a league whose confirmation window has passed.',
});
