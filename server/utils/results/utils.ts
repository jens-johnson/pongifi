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
import type { IReconstructedGame, IReconstruction, IResultPolicySnapshot, IResultSubmission } from '#shared/results';
import {
  canonicalize,
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
import { ADMIN_ROLES, HOUR_MS, VOID_ROLE } from './constants';
import { ResultRefusal } from './enums';
import { publishRatingGeneration } from './replay';
import type {
  IAmendResultRequest,
  IAnswerResultRequest,
  IRecordResultRequest,
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
 * Takes the league's lock and samples the database clock underneath it.
 *
 * Every result write in a league passes through this one row, which is what makes two results settling at the same
 * moment sequential rather than interleaved. The clock is read after the lock rather than when the request arrived:
 * a transaction that waited two seconds for the lock must decide a deadline against the time it actually got it
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param leagueId - The league
 * @throws ResultRefusalError when no such league exists
 * @returns The league's settings, its configuration revision, and the database's current time
 */
async function lockLeague(
  transaction: IInteractiveTransaction,
  leagueId: string,
): Promise<{ configurationRevision: number; now: Date; settings: TLeagueSettings }> {
  const { rows } = await transaction.query<{
    configuration_revision: number;
    now: Date;
    settings: TLeagueSettings;
  }>(
    `SELECT "configuration_revision", "settings", now() AS "now"
     FROM "leagues" WHERE "id" = $1 FOR UPDATE`,
    [leagueId],
  );
  const row = rows[0];

  if (!row) {
    throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
  }

  return {
    configurationRevision: row.configuration_revision,
    now: row.now,
    settings: row.settings,
  };
}

/**
 * Reads the role an account holds in a league right now.
 *
 * Read under the league's lock and never taken from the result: a policy freezes at creation, but who may act never
 * does. A demoted manager loses the amendment their old role allowed, and a removed member loses every action
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param leagueId - The league
 * @param userId - The account
 * @returns Their role, or null when they are not an active member
 */
async function readRole(
  transaction: IInteractiveTransaction,
  leagueId: string,
  userId: string,
): Promise<string | null> {
  const { rows } = await transaction.query<{ role: string }>(
    `SELECT "role" FROM "memberships"
     WHERE "league_id" = $1 AND "user_id" = $2 AND "status" = 'ACTIVE'`,
    [leagueId, userId],
  );

  return rows[0]?.role ?? null;
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
 * Writes a revision's game rows, seats and reconstructed events.
 *
 * Each revision owns its own rows outright: a correction that turns two games into three writes three new ones and
 * marks the old two superseded, rather than rewriting rows an earlier revision's audit still points at
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
    leagueId: string;
    playedAt: Date;
    reconstruction: IReconstruction;
    recorderId: string;
    revisionId: string;
    settings: IMatchSettings;
    submission: IResultSubmission;
  },
): Promise<string[]> {
  const matchId: string = randomUUID();
  const ids: string[] = [];

  for (const game of context.reconstruction.games) {
    const status: GameStatus = game.isComplete ? GameStatus.COMPLETE : GameStatus.RETIRED;
    const { rows } = await transaction.query<{ id: string }>(
      `INSERT INTO "games" ("league_id", "match_id", "game_number", "type", "status", "confirmation_status",
         "confirmed_at", "recording_mode", "settings_snapshot", "created_by", "recorder_user_id", "ended_at",
         "result_revision_id")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12) RETURNING "id"`,
      [
        context.leagueId,
        matchId,
        game.gameNumber,
        context.settings.gameType,
        status,
        context.confirmationStatus,
        context.confirmationStatus === ConfirmationStatus.CONFIRMED ? context.playedAt : null,
        RecordingMode.RETROACTIVE,
        JSON.stringify(context.settings),
        context.recorderId,
        context.playedAt,
        context.revisionId,
      ],
    );
    const gameId: string = rows[0]!.id;

    ids.push(gameId);
    await writeSeats(transaction, gameId, context.revisionId, context.submission, game);
    await writeEvents(transaction, gameId, context.revisionId, context.playedAt, game);
    await transaction.query(
      `INSERT INTO "result_revision_games" ("result_revision_id", "game_id", "game_number") VALUES ($1, $2, $3)`,
      [context.revisionId, gameId, game.gameNumber],
    );
  }

  return ids;
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
 * The savepoint is taken after settlement and before authority, so a refusal unwinds the action and nothing else. A
 * refusal is then answered as a value, which lets the transaction commit the settlement it did on the way in; only an
 * unexpected failure still unwinds the whole thing
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param body - The part that may be refused
 * @param state - The state to report alongside a refusal
 * @throws Whatever the body throws that is not a refusal
 * @returns What the body did, or why it was refused
 */
async function refusable(
  transaction: IInteractiveTransaction,
  body: () => Promise<IResultEffect>,
  state: ResultState | null,
): Promise<TResultOutcome> {
  await transaction.query('SAVEPOINT result_action');

  try {
    return { ok: true, value: await body() };
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
 * Records a result and publishes the ladder it changes, in one transaction.
 *
 * Order matters and is fixed: the league's lock first, so two results in one league are sequential; the receipt next,
 * so a retry is answered rather than written twice; the league's configuration revision under the lock, so a form
 * drawn against rules that have since moved is refused rather than quietly recorded under the new ones; then the
 * reconstruction, which is what proves the entered scores describe a match these rules could produce; then the
 * revision, its rows, and the ladder
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account recording it
 * @param request - The submission and the operation's identity
 * @throws ResultRefusalError when the recording is refused
 * @returns What the operation did
 */
async function applyRecordResult(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IRecordResultRequest,
): Promise<IResultEffect> {
  const requestDigest: string = digest(request);
  const league = await lockLeague(transaction, request.leagueId);

  // Checked under the lock, not before it: two identical creates that arrived together both find no receipt outside
  // it, and the one that waits has to see the other's before it writes a second result
  const replayed: IResultEffect | null = await replayOperation(transaction, {
    actorId,
    clientOperationId: request.clientOperationId,
    operation: 'CREATE',
    requestDigest,
  });

  if (replayed) {
    return replayed;
  }

  const submission: IResultSubmission = normalizeSubmission(request.submission);
  const role: string | null = await readRole(transaction, request.leagueId, actorId);
  const policy: IResultPolicySnapshot = toPolicySnapshot(league.settings);
  const isSeated: boolean = submission.seats.some((seat): boolean => seat.userId === actorId);

  if (!mayRecord(policy, role, isSeated)) {
    throw new ResultRefusalError(role === null ? ResultRefusal.NOT_FOUND : ResultRefusal.FORBIDDEN);
  }

  if (league.configurationRevision !== request.expectedLeagueRevision) {
    throw new ResultRefusalError(ResultRefusal.STALE_LEAGUE_RULES);
  }

  const settings: IMatchSettings = toMatchSettings(league.settings, submission.gameType);
  const reconstruction: IReconstruction = reconstruct(settings, submission);
  const answerers: string[] = requiredAnswerers(submission, actorId);
  const birth = birthState(policy, answerers);
  const playedAt: Date = new Date(submission.playedAt);
  const revisionId: string = randomUUID();
  const deadline: Date | null =
    birth.state === ResultState.UNCONFIRMED
      ? new Date(league.now.getTime() + policy.resultConfirmationWindow * HOUR_MS)
      : null;

  await transaction.query(
    `INSERT INTO "result_revisions" ("id", "canonical_match_id", "league_id", "revision", "is_current", "state",
       "game_type", "settings_snapshot", "policy_snapshot", "league_configuration_revision", "submission",
       "reconstruction", "reconstruction_version", "submission_digest", "played_at", "original_played_at",
       "submitted_at", "confirmation_deadline", "settled_at", "settled_reason", "recorded_by")
     VALUES ($1, $1, $2, 1, true, $3::result_state, $4::game_type, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13, $14,
       $15, $16::result_settle_reason, $17)`,
    [
      revisionId,
      request.leagueId,
      birth.state,
      submission.gameType,
      JSON.stringify(settings),
      JSON.stringify(policy),
      league.configurationRevision,
      JSON.stringify(submission),
      JSON.stringify(reconstruction),
      reconstruction.version,
      digest(submission),
      playedAt,
      league.now,
      deadline,
      birth.reason ? league.now : null,
      birth.reason,
      actorId,
    ],
  );

  await writeAnswerers(transaction, revisionId, answerers);
  await writeProjection(transaction, {
    confirmationStatus:
      birth.state === ResultState.CONFIRMED ? ConfirmationStatus.CONFIRMED : ConfirmationStatus.UNCONFIRMED,
    leagueId: request.leagueId,
    playedAt,
    reconstruction,
    recorderId: actorId,
    revisionId,
    settings,
    submission,
  });

  await publishRatingGeneration(transaction, request.leagueId, revisionId);

  const effect: IResultEffect = {
    canonicalMatchId: revisionId,
    revision: 1,
    resultRevisionId: revisionId,
    state: birth.state,
  };

  await writeReceipt(transaction, {
    actorId,
    canonicalMatchId: revisionId,
    clientOperationId: request.clientOperationId,
    effect,
    operation: 'CREATE',
    requestDigest,
    revisionId,
  });

  return effect;
}

/**
 * Records a result, answering with what it did or why it was refused
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account recording it
 * @param request - The submission and the operation's identity
 * @returns What the operation did, or the refusal
 */
export async function recordResult(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IRecordResultRequest,
): Promise<TResultOutcome> {
  return refusable(transaction, (): Promise<IResultEffect> => applyRecordResult(transaction, actorId, request), null);
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
 * @returns How many revisions settled
 */
export async function settleDueResults(transaction: IInteractiveTransaction, leagueId: string): Promise<number> {
  const league = await lockLeague(transaction, leagueId);
  const { rows } = await transaction.query<{ id: string }>(
    `SELECT "id" FROM "result_revisions"
     WHERE "league_id" = $1 AND "is_current" AND "state" = 'UNCONFIRMED'
       AND "confirmation_deadline" IS NOT NULL AND "confirmation_deadline" <= $2
     ORDER BY "confirmation_deadline"
     FOR UPDATE`,
    [leagueId, league.now],
  );

  for (const row of rows) {
    await settleRevision(transaction, row.id, ResultState.CONFIRMED, ResultSettleReason.DEADLINE_PASSED, league.now);
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
 * Confirms, disputes or voids a revision.
 *
 * Every one of them is the same shape: settle an overdue revision first, re-read authority under the lock, refuse an
 * action aimed at a revision that has moved, then record a durable action row rather than a flag. A confirmation is
 * one row per person per revision, so a repeat is a unique-key conflict rather than a second vote, and a person who
 * confirmed may still dispute while the revision is pending. A dispute stops the deadline from settling it; a void is
 * a commissioner's and takes the result out of every count and ladder
 * @public
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - The account acting
 * @param request - The action and the operation's identity
 * @returns What the operation did, or the refusal alongside the state the result is actually in
 */
export async function answerResult(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IAnswerResultRequest,
): Promise<TResultOutcome> {
  try {
    const requestDigest: string = digest(request);
    const league = await lockLeague(transaction, await readLeagueOfMatch(transaction, request.canonicalMatchId));
    const revision: IRevisionRow = await lockCurrentRevision(transaction, request.canonicalMatchId);

    // Under the locks, so a retry that raced its own original sees the receipt rather than writing a second action
    const replayed: IResultEffect | null = await replayOperation(transaction, {
      actorId,
      clientOperationId: request.clientOperationId,
      operation: request.action,
      requestDigest,
    });

    if (replayed) {
      return { ok: true, value: replayed };
    }

    const role: string | null = await readRole(transaction, revision.leagueId, actorId);

    if (role === null) {
      throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
    }

    // Settled before the action is judged, and outside the savepoint the action unwinds to: a result that reached its
    // deadline reached it, whether or not the action that noticed is one this league will accept
    await settleIfDue(transaction, revision, league.now);

    const current: IRevisionRow = await lockCurrentRevision(transaction, request.canonicalMatchId);

    return await refusable(
      transaction,
      (): Promise<IResultEffect> =>
        applyAnswerAction(transaction, actorId, request, current, league.now, role, requestDigest),
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
 * Records the action itself, once settlement and authority have been established.
 *
 * A confirmation is one row per person per revision, so a repeat is a unique-key conflict rather than a second vote,
 * and a person who confirmed may still dispute while the revision is pending. A dispute stops the deadline from
 * settling it; a void is a commissioner's and takes the result out of every count and ladder
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

  const seated: boolean = current.submission.seats.some((seat): boolean => seat.userId === actorId);

  if (request.action === ResultAction.VOID) {
    if (role !== VOID_ROLE) {
      throw new ResultRefusalError(ResultRefusal.FORBIDDEN);
    }
  } else if (!seated) {
    throw new ResultRefusalError(ResultRefusal.FORBIDDEN);
  } else if (current.state !== ResultState.UNCONFIRMED) {
    throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
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
    await transaction.query(`INSERT INTO "result_dispute_notes" ("result_action_id", "body") VALUES ($1, $2)`, [
      actions[0]!.id,
      request.note,
    ]);
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
      `UPDATE "result_revisions" SET "state" = 'VOID', "settled_at" = $2, "settled_reason" = 'CONFIRMED_BY_ALL'
       WHERE "id" = $1`,
      [revision.id, now],
    );
    // A voided result leaves every count and every ladder, and keeps its rows addressable for the audit that follows
    await transaction.query(
      `UPDATE "games" SET "status" = 'VOID', "superseded_at" = $2, "updated_at" = now() WHERE "result_revision_id" = $1`,
      [revision.id, now],
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
 * @throws ResultRefusalError when the correction is refused
 * @returns What the operation did
 */
export async function amendResult(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IAmendResultRequest,
): Promise<TResultOutcome> {
  try {
    const requestDigest: string = digest(request);
    const league = await lockLeague(transaction, await readLeagueOfMatch(transaction, request.canonicalMatchId));
    const previous: IRevisionRow = await lockCurrentRevision(transaction, request.canonicalMatchId);

    // Under the locks, so a retry that raced its own original is answered from the receipt rather than amending twice
    const replayed: IResultEffect | null = await replayOperation(transaction, {
      actorId,
      clientOperationId: request.clientOperationId,
      operation: 'AMEND',
      requestDigest,
    });

    if (replayed) {
      return { ok: true, value: replayed };
    }

    const role: string | null = await readRole(transaction, previous.leagueId, actorId);

    if (role === null) {
      throw new ResultRefusalError(ResultRefusal.NOT_FOUND);
    }

    // Recording a result grants no amendment right of its own; an active manager or commissioner amends under the role
    if (!ADMIN_ROLES.includes(role)) {
      throw new ResultRefusalError(ResultRefusal.FORBIDDEN);
    }

    await settleIfDue(transaction, previous, league.now);

    const current: IRevisionRow = await lockCurrentRevision(transaction, request.canonicalMatchId);

    return await refusable(
      transaction,
      (): Promise<IResultEffect> => applyAmendment(transaction, actorId, request, current, league, requestDigest),
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
 * @param league - The locked league, its configuration revision and the database clock
 * @param requestDigest - The digest the receipt is keyed by
 * @throws ResultRefusalError when the correction is refused
 * @returns What the correction did
 */
async function applyAmendment(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: IAmendResultRequest,
  current: IRevisionRow,
  league: { configurationRevision: number; now: Date },
  requestDigest: string,
): Promise<IResultEffect> {
  if (current.revision !== request.expectedRevision || current.state === ResultState.VOID) {
    throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
  }

  const bound: number = current.originalPlayedAt.getTime() + current.policySnapshot.resultAmendmentWindow * HOUR_MS;

  if (league.now.getTime() > bound) {
    throw new ResultRefusalError(ResultRefusal.STALE_RESULT);
  }

  // The frozen format wins over whatever the corrected body claims: a correction is not a way onto other rules
  const submission: IResultSubmission = normalizeSubmission({
    ...request.submission,
    gameType: current.settingsSnapshot.gameType,
  });
  const reconstruction: IReconstruction = reconstruct(current.settingsSnapshot, submission);
  const answerers: string[] = requiredAnswerers(submission, actorId);
  const birth = birthState(current.policySnapshot, answerers);
  const playedAt: Date = new Date(submission.playedAt);
  const revisionId: string = randomUUID();
  const deadline: Date | null =
    birth.state === ResultState.UNCONFIRMED
      ? new Date(league.now.getTime() + current.policySnapshot.resultConfirmationWindow * HOUR_MS)
      : null;

  await transaction.query(`UPDATE "result_revisions" SET "is_current" = NULL WHERE "id" = $1`, [current.id]);
  await transaction.query(
    `UPDATE "games" SET "superseded_at" = $2, "updated_at" = now() WHERE "result_revision_id" = $1`,
    [current.id, league.now],
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
      league.configurationRevision,
      JSON.stringify(submission),
      JSON.stringify(reconstruction),
      reconstruction.version,
      digest(submission),
      playedAt,
      current.originalPlayedAt,
      league.now,
      deadline,
      birth.reason ? league.now : null,
      birth.reason,
      current.recordedBy,
      actorId,
    ],
  );

  await writeAnswerers(transaction, revisionId, answerers);
  await writeProjection(transaction, {
    confirmationStatus:
      birth.state === ResultState.CONFIRMED ? ConfirmationStatus.CONFIRMED : ConfirmationStatus.UNCONFIRMED,
    leagueId: current.leagueId,
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
    requestDigest,
    revisionId,
  });

  return effect;
}

/**
 * Redacts every dispute note a deleted account is identified by.
 *
 * Two people are covered, because a note can name either: whoever wrote it, and anybody seated in any revision of the
 * match it belongs to. The words go and the row stays, so history still shows that a note was written and then
 * removed, and every score, rating and receipt the result rests on is untouched.
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

defineSymbol(settleDueResults, {
  name: 'Settle Due Results',
  description: 'Settles every result in a league whose confirmation window has passed.',
});
