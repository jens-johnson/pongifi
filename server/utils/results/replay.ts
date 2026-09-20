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
 * ██████████████████████████████████████████ #server/utils/results/replay.ts ██████████████████████████████████████████
 *
 * Recomputes a league's whole ladder and publishes it as one immutable generation.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ConfirmationStatus, GameStatus, ParticipantOutcome } from '#shared/domain';
import { RatingScope } from '#shared/domain';
import type { IRatableGame, IRatedParticipant, IRatingSnapshotDraft } from '#shared/rating-engine';
import { replayRatings } from '#shared/rating-engine';
import type { IOrderedGame, IResultPolicySnapshot } from '#shared/results';
import { compareForReplay } from '#shared/results';
import type { GameType, Side } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import type { IInteractiveTransaction } from '../db/types';
import { REPLAYED_SCOPE } from './constants';
import type { IPublishedGeneration } from './types';

/**
 * One game row of a league's ladder, with the seats and the frozen policy that decide what it feeds
 * @internal
 */
interface ILadderRow {
  canonical_match_id: string;
  confirmation_status: ConfirmationStatus;
  game_id: string;
  game_number: number;
  game_type: GameType;
  has_guest: boolean;
  played_at: Date;
  policy_snapshot: IResultPolicySnapshot;
  seats: { outcome: ParticipantOutcome; score: number; side: Side; user_id: string | null }[];
  status: GameStatus;
  winning_margin: number;
}

/**
 * Every game row a league's ladder is built from, in one read.
 *
 * Only the current revision of each match appears: a superseded child game is still in the table and still reachable
 * by its own id, and counting it again would rate a score nobody stands behind. Guest and unrated games are read too
 * rather than filtered here, because the engine has to see them to decide they feed nothing
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param leagueId - The league
 * @returns The rows, unordered
 */
async function readLadderRows(transaction: IInteractiveTransaction, leagueId: string): Promise<ILadderRow[]> {
  const { rows } = await transaction.query<ILadderRow>(
    `SELECT
       g."id"                        AS game_id,
       g."status"                    AS status,
       g."confirmation_status"       AS confirmation_status,
       g."type"                      AS game_type,
       (g."settings_snapshot" ->> 'winningMargin')::int AS winning_margin,
       r."canonical_match_id"        AS canonical_match_id,
       r."played_at"                 AS played_at,
       r."policy_snapshot"           AS policy_snapshot,
       rg."game_number"              AS game_number,
       EXISTS (
         SELECT 1 FROM "game_participants" p
         WHERE p."game_id" = g."id" AND p."user_id" IS NULL
       )                             AS has_guest,
       COALESCE(
         (
           SELECT json_agg(json_build_object(
             'user_id', p."user_id",
             'side', p."side",
             'score', p."final_score",
             'outcome', p."outcome"
           ) ORDER BY p."seat")
           FROM "game_participants" p
           WHERE p."game_id" = g."id"
         ),
         '[]'::json
       )                             AS seats
     FROM "games" g
     JOIN "result_revision_games" rg ON rg."game_id" = g."id"
     JOIN "result_revisions" r       ON r."id" = rg."result_revision_id"
     WHERE g."league_id" = $1
       AND g."superseded_at" IS NULL
       AND r."is_current"`,
    [leagueId],
  );

  return rows;
}

/**
 * Turns a ladder row into the shape the rating engine reads.
 *
 * The frozen policy travels with the game rather than being read from the league, so a match played when the league
 * did not rate games stays unrated after somebody turns rating on, and a provisional threshold that has since moved
 * does not retroactively change how fast an old game counted
 * @internal
 * @function
 * @param row - The ladder row
 * @returns The rateable game
 */
function toRatableGame(row: ILadderRow): IRatableGame {
  const participants: IRatedParticipant[] = row.seats
    .filter((seat): boolean => seat.user_id !== null)
    .map((seat): IRatedParticipant => ({
      gamesPlayed: 0,
      outcome: seat.outcome,
      participantId: seat.user_id as string,
      rating: 0,
      score: seat.score,
      side: seat.side,
    }));

  return {
    eligibility: {
      confirmationStatus: row.confirmation_status,
      hasGuest: row.has_guest,
      isLiveRecorded: false,
      ratingEnabled: row.policy_snapshot.ratingEnabled,
      status: row.status,
    },
    gameId: row.game_id,
    gameType: row.game_type,
    participants,
    provisionalGames: row.policy_snapshot.provisionalGames,
    winningMargin: row.winning_margin,
  };
}

/**
 * Recomputes a league's whole ladder and publishes it as one immutable generation.
 *
 * The recomputation is total rather than incremental, and the seed is the opening rating with no games behind it, not
 * whatever each player's rating happens to be now. That is the only way a correction to an old match reaches the
 * people it should: A beating B changes B's rating, which changes what beating B was worth to C, which changes C
 * against D. An incremental pass that touched only the people in the corrected match would leave D wrong, and there
 * is no cheap way to know it had.
 *
 * Nothing here updates a row in place. The generation, its snapshots and the pointer that selects it are written
 * inside the caller's transaction, so a reader either sees the whole new ladder or the whole old one. A superseded
 * generation stays behind as history
 * @public
 * @async
 * @function
 * @param transaction - The open transaction, already holding the league's lock
 * @param leagueId - The league to recompute
 * @param causedByRevisionId - The revision whose transition caused this, for the audit trail
 * @returns The published generation, how many game rows it actually rated, and where the time went
 */
export async function publishRatingGeneration(
  transaction: IInteractiveTransaction,
  leagueId: string,
  causedByRevisionId: string | null,
): Promise<IPublishedGeneration> {
  const readStarted: number = performance.now();
  const rows: ILadderRow[] = await readLadderRows(transaction, leagueId);
  const engineStarted: number = performance.now();
  const ordered: ILadderRow[] = [...rows].sort((left, right): number =>
    compareForReplay(toOrdered(left), toOrdered(right)),
  );
  const drafts: IRatingSnapshotDraft[] = replayRatings(ordered.map(toRatableGame), REPLAYED_SCOPE);
  const insertStarted: number = performance.now();

  // What the generation counts is the games that rated somebody, not the rows the pass read: a league of guest games
  // scans plenty and rates none, and a count of scanned rows would describe that league as fully rated
  const ratedGameCount: number = new Set(drafts.map((draft: IRatingSnapshotDraft): string => draft.gameId)).size;
  const { rows: created } = await transaction.query<{ id: string }>(
    `INSERT INTO "rating_generations" ("league_id", "caused_by_revision_id", "rated_game_count")
     VALUES ($1, $2, $3) RETURNING "id"`,
    [leagueId, causedByRevisionId, ratedGameCount],
  );
  const generationId: string = created[0]!.id;

  if (drafts.length > 0) {
    await transaction.query(
      `INSERT INTO "rating_snapshots"
         ("league_id", "user_id", "scope", "rating", "rating_before", "delta", "games_played", "is_provisional",
          "game_id", "rating_generation_id")
       SELECT $1, d."user_id", $2::rating_scope, d."rating", d."rating_before", d."delta", d."games_played",
              d."is_provisional", d."game_id", $3
       FROM json_to_recordset($4::json) AS d(
         "user_id" uuid, "rating" double precision, "rating_before" double precision, "delta" double precision,
         "games_played" int, "is_provisional" boolean, "game_id" uuid
       )`,
      [
        leagueId,
        RatingScope.OVERALL,
        generationId,
        JSON.stringify(
          drafts.map((draft): Record<string, unknown> => ({
            delta: draft.delta,
            game_id: draft.gameId,
            games_played: draft.gamesPlayed,
            is_provisional: draft.isProvisional,
            rating: draft.ratingAfter,
            rating_before: draft.ratingBefore,
            user_id: draft.participantId,
          })),
        ),
      ],
    );
  }

  // The pointer moves last and moves once: until it does, every reader is still on the previous complete ladder
  await transaction.query(
    `INSERT INTO "active_rating_generations" ("league_id", "rating_generation_id")
     VALUES ($1, $2)
     ON CONFLICT ("league_id") DO UPDATE SET "rating_generation_id" = EXCLUDED."rating_generation_id",
       "published_at" = now()`,
    [leagueId, generationId],
  );

  return {
    generationId,
    ratedGameCount,
    timings: {
      engineMs: insertStarted - engineStarted,
      insertMs: performance.now() - insertStarted,
      readMs: engineStarted - readStarted,
    },
  };
}

/**
 * Reads the four facts a ladder row is ordered by
 * @internal
 * @function
 * @param row - The ladder row
 * @returns Its ordering key
 */
function toOrdered(row: ILadderRow): IOrderedGame {
  return {
    canonicalMatchId: row.canonical_match_id,
    gameId: row.game_id,
    gameNumber: row.game_number,
    playedAt: row.played_at.toISOString(),
  };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(publishRatingGeneration, {
  name: 'Publish Rating Generation',
  description: "Recomputes a league's whole ladder and publishes it as one immutable generation.",
});
