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
 * █████████████████████████████████████████████ #shared/results/utils.ts ██████████████████████████████████████████████
 *
 * Canonical form, digest input and the total order a rating replay reads games in.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import { DOUBLES_SEATS, SINGLES_SEATS } from './constants';
import { Seat } from './enums';
import type { IGameScoreRow, IResultSeat, IResultSubmission } from './types';

/**
 * The order every seat list is written in, so two submissions of the same match digest identically
 * @internal
 * @constant
 */
const SEAT_ORDER: readonly Seat[] = [Seat.A1, Seat.A2, Seat.B1, Seat.B2];

/**
 * A game ordered against another for the rating replay
 * @public
 */
export interface IOrderedGame {
  /* The match the game belongs to, which keeps a best-of-N's children contiguous */
  canonicalMatchId: string;

  /* The game row */
  gameId: string;

  /* Which game of its match it is */
  gameNumber: number;

  /* When the match was played */
  playedAt: string;
}

/**
 * Writes a value as JSON with every object key in order, so the same facts always produce the same bytes.
 *
 * A digest over `JSON.stringify` of a parsed request would depend on the order the client happened to send its keys
 * in, which would make an identical resubmission look like a changed body
 * @public
 * @function
 * @param value - The value to write
 * @returns Its canonical JSON
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry: unknown): string => canonicalize(entry)).join(',')}]`;
  }

  const entries: string[] = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key: string): string => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`);

  return `{${entries.join(',')}}`;
}

/**
 * Writes a stated play time as the one string two equal instants share, or leaves it alone when it is not one.
 *
 * Normalization has to be total: it runs before the submission's bounds are checked, so a body carrying rubbish in
 * this field has to reach the validator that names the problem rather than raising a `RangeError` on the way
 * @internal
 * @function
 * @param playedAt - The stated play time, as it arrived
 * @returns The instant in its canonical form, or the original string when it states no instant
 */
function toInstant(playedAt: string): string {
  const stated: number = Date.parse(playedAt);

  return Number.isNaN(stated) ? playedAt : new Date(stated).toISOString();
}

/**
 * Puts a submission into the one shape it is stored, digested and compared in.
 *
 * Trimming and ordering happen here rather than at each caller, because the digest that decides whether a retry is
 * the same submission has to be taken over the normalized form: a guest name with a trailing space, or seats listed
 * in another order, is the same result and must not read as a changed body.
 *
 * Everything this does is reversible in the only sense that matters: two bodies normalize alike exactly when they
 * state the same result. Nothing is truncated, clamped or dropped, because the digest runs before the bounds are
 * checked — a step that shortened an over-long guest label here would make a body the server is about to refuse
 * digest identically to the valid one somebody already committed, and answer the changed request from that receipt.
 * A play time that is not an instant is carried through untouched for the same reason: {@link findSubmissionProblem}
 * refuses it by name, which it cannot do if reading it threw first
 * @public
 * @function
 * @param submission - The submission as it arrived
 * @returns The normalized submission
 */
export function normalizeSubmission(submission: IResultSubmission): IResultSubmission {
  const seats: IResultSeat[] = [...submission.seats]
    .sort(
      (left: IResultSeat, right: IResultSeat): number => SEAT_ORDER.indexOf(left.seat) - SEAT_ORDER.indexOf(right.seat),
    )
    .map((seat: IResultSeat): IResultSeat => ({
      guestName: seat.guestName === null ? null : seat.guestName.trim(),
      seat: seat.seat,
      userId: seat.userId,
    }));

  const games: IGameScoreRow[] = [...submission.games]
    .sort((left: IGameScoreRow, right: IGameScoreRow): number => left.gameNumber - right.gameNumber)
    .map((game: IGameScoreRow): IGameScoreRow => ({
      a: game.a,
      b: game.b,
      gameNumber: game.gameNumber,
    }));

  return {
    ending: submission.ending,
    gameType: submission.gameType,
    games,
    playedAt: toInstant(submission.playedAt),
    retiredSeat: submission.retiredSeat,
    seats,
  };
}

/**
 * The seats a format fills
 * @public
 * @function
 * @param gameType - Which format
 * @returns The seats, in canonical interleaved order, or an empty list for a format with no final-score form
 */
export function seatsForGameType(gameType: GameType): readonly Seat[] {
  if (gameType === GameType.DOUBLES) {
    return DOUBLES_SEATS;
  }

  return gameType === GameType.SINGLES ? SINGLES_SEATS : [];
}

/**
 * Orders two games for a rating replay.
 *
 * Play time first, so a backdated result takes its true place in the ladder; then the match, so a best-of-N's games
 * stay contiguous rather than interleaving with another match played at the same minute; then the game number, so a
 * match's own games stay in the order they were played; then the game id, so two matches entered for the same instant
 * still have one total order rather than a database-dependent one
 * @public
 * @function
 * @param left - One game
 * @param right - The other
 * @returns Negative when the left game is rated first, positive when the right one is
 */
export function compareForReplay(left: IOrderedGame, right: IOrderedGame): number {
  const byTime: number = Date.parse(left.playedAt) - Date.parse(right.playedAt);

  if (byTime !== 0) {
    return byTime;
  }

  if (left.canonicalMatchId !== right.canonicalMatchId) {
    return left.canonicalMatchId < right.canonicalMatchId ? -1 : 1;
  }

  if (left.gameNumber !== right.gameNumber) {
    return left.gameNumber - right.gameNumber;
  }

  if (left.gameId === right.gameId) {
    return 0;
  }

  return left.gameId < right.gameId ? -1 : 1;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(canonicalize, {
  name: 'Canonicalize',
  description: 'Writes a value as JSON with every object key in order.',
});

defineSymbol(normalizeSubmission, {
  name: 'Normalize Submission',
  description: 'Puts a submitted result into the shape it is stored and digested in.',
});

defineSymbol(compareForReplay, {
  name: 'Compare For Replay',
  description: "Orders two games for a league's rating replay.",
});

defineSymbol(seatsForGameType, {
  name: 'Seats For Game Type',
  description: 'The seats a format fills, in canonical order.',
});
