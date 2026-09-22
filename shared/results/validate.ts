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
 * ████████████████████████████████████████████ #shared/results/validate.ts ████████████████████████████████████████████
 *
 * The bounds a submitted result has to meet before anything is frozen, reconstructed or stored.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import {
  MAX_ENTERED_SCORE,
  MAX_GAME_ROWS,
  MAX_GUEST_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MIN_GUEST_NAME_LENGTH,
} from './constants';
import type { Seat } from './enums';
import { ResultEnding } from './enums';
import type { IGameScoreRow, IResultSeat, IResultSubmission } from './types';
import { seatsForGameType } from './utils';

/**
 * What is wrong with a submission, when something is.
 *
 * Separate from a refusal the reconstruction raises: an unplayable scoreline is a legal request about an impossible
 * match, while everything here is a request the server will not read at all. They are distinct codes rather than one
 * because the form marks the field each of them belongs to, and because a test that asserts "refused" proves nothing
 * about which rule did the refusing
 * @public
 * @enum
 */
export enum SubmissionProblem {
  /* A format this form does not record, cutthroat being the one the slice leaves to the live scorer */
  FORMAT = 'FORMAT',

  /* No games at all, or more than a best-of-seven can hold */
  GAME_COUNT = 'GAME_COUNT',

  /* The rows are not games one to n exactly once */
  GAME_NUMBERING = 'GAME_NUMBERING',

  /* A guest label that is empty once trimmed, or longer than a label may be */
  GUEST_NAME = 'GUEST_NAME',

  /* Every seat holds a guest, so no member's record would move */
  NO_MEMBER = 'NO_MEMBER',

  /* A note longer than a note may be, or a note on an action that carries none */
  NOTE = 'NOTE',

  /* A play time that is not an instant at all */
  PLAYED_AT_MALFORMED = 'PLAYED_AT_MALFORMED',

  /* A play time the database's clock has not reached */
  PLAYED_AT_FUTURE = 'PLAYED_AT_FUTURE',

  /* A play time older than the window this league still accepts an entry within */
  PLAYED_AT_STALE = 'PLAYED_AT_STALE',

  /* A retirement with nobody named, a named seat nobody sits in, or a withdrawal on a completed match */
  RETIREMENT = 'RETIREMENT',

  /* A score that is not a whole number the form accepts */
  SCORE_RANGE = 'SCORE_RANGE',

  /* The wrong number of seats for the format, or a seat the format does not fill */
  SEATS = 'SEATS',

  /* A seat holding both a member and a guest or neither, or one member sitting twice */
  SEAT_IDENTITY = 'SEAT_IDENTITY',
}

/**
 * Whether a score is a whole number inside the form's range.
 *
 * The ceiling belongs to this form rather than to the rules engine, which can replay a longer game; what the check is
 * really for is the fractional and non-finite values a JSON body can carry into an integer column
 * @internal
 * @function
 * @param score - The entered score
 * @returns Whether the form accepts it
 */
function isEnteredScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= MAX_ENTERED_SCORE;
}

/**
 * What is wrong with the games, if anything
 * @internal
 * @function
 * @param games - The entered rows
 * @returns The problem, or null
 */
function findGameProblem(games: IGameScoreRow[]): SubmissionProblem | null {
  if (games.length === 0 || games.length > MAX_GAME_ROWS) {
    return SubmissionProblem.GAME_COUNT;
  }

  const numbers: number[] = [...games].map((game: IGameScoreRow): number => game.gameNumber).sort();

  if (numbers.some((number: number, index: number): boolean => number !== index + 1)) {
    return SubmissionProblem.GAME_NUMBERING;
  }

  if (games.some((game: IGameScoreRow): boolean => !isEnteredScore(game.a) || !isEnteredScore(game.b))) {
    return SubmissionProblem.SCORE_RANGE;
  }

  return null;
}

/**
 * Whether a guest label is a label at all.
 *
 * Checked before normalization trims and truncates, because a label the form would have to cut down is one the person
 * never typed, and storing a shortened name under somebody's result is worse than refusing the entry
 * @internal
 * @function
 * @param guestName - The label as it arrived
 * @returns Whether it is within bounds once trimmed
 */
function isGuestName(guestName: string): boolean {
  const trimmed: string = guestName.trim();

  return trimmed.length >= MIN_GUEST_NAME_LENGTH && trimmed.length <= MAX_GUEST_NAME_LENGTH;
}

/**
 * What is wrong with the seats, if anything.
 *
 * The identity rules are the pitch's (VI.III): a seat holds one member or one guest label, a member sits once, and at
 * least one seat holds a member, because a match between two guests moves nobody's record and belongs to nobody's
 * history. Whether those members are still in the league is a question only the database can answer, and the service
 * asks it under the league's lock
 * @internal
 * @function
 * @param submission - The submission as it arrived
 * @returns The problem, or null
 */
function findSeatProblem(submission: IResultSubmission): SubmissionProblem | null {
  const expected: readonly Seat[] = seatsForGameType(submission.gameType);

  if (expected.length === 0) {
    return SubmissionProblem.FORMAT;
  }

  const filled: Seat[] = submission.seats.map((seat: IResultSeat): Seat => seat.seat);

  if (
    filled.length !== expected.length ||
    expected.some((seat: Seat): boolean => !filled.includes(seat)) ||
    new Set(filled).size !== filled.length
  ) {
    return SubmissionProblem.SEATS;
  }

  // A seat holds exactly one of the two identities; both or neither is a body the form could not have produced
  if (submission.seats.some((seat: IResultSeat): boolean => (seat.userId === null) === (seat.guestName === null))) {
    return SubmissionProblem.SEAT_IDENTITY;
  }

  if (submission.seats.some((seat: IResultSeat): boolean => seat.guestName !== null && !isGuestName(seat.guestName))) {
    return SubmissionProblem.GUEST_NAME;
  }

  const members: string[] = submission.seats
    .map((seat: IResultSeat): string | null => seat.userId)
    .filter((userId: string | null): userId is string => userId !== null);

  if (new Set(members).size !== members.length) {
    return SubmissionProblem.SEAT_IDENTITY;
  }

  return members.length === 0 ? SubmissionProblem.NO_MEMBER : null;
}

/**
 * What is wrong with the stated play time, if anything.
 *
 * Both bounds are instants the caller supplies rather than a window this function measures for itself: the time a
 * result is judged against is the database's, sampled under the locks the write holds, and the oldest accepted instant
 * differs between a first entry and a correction. A validator reading `Date.now()` would be judging against the
 * application server's clock instead
 * @internal
 * @function
 * @param playedAt - The stated play time
 * @param bounds - The database clock, and the oldest play time still accepted
 * @returns The problem, or null
 */
function findPlayedAtProblem(playedAt: string, bounds: { earliest: number; now: number }): SubmissionProblem | null {
  const stated: number = Date.parse(playedAt);

  if (!Number.isFinite(stated)) {
    return SubmissionProblem.PLAYED_AT_MALFORMED;
  }

  if (stated > bounds.now) {
    return SubmissionProblem.PLAYED_AT_FUTURE;
  }

  return stated < bounds.earliest ? SubmissionProblem.PLAYED_AT_STALE : null;
}

/**
 * What is wrong with a submitted result, if anything.
 *
 * Checked on the server as well as in the form, over the body as it arrived rather than after normalization: trimming
 * a guest label to its ceiling would store a truncated name the person never typed, and a normalizer that silently
 * repaired an empty one would store a nameless guest. The order the checks run in is the order the form reads top to
 * bottom, so the first problem reported is the first one on the page
 * @public
 * @function
 * @param submission - The submission as it arrived
 * @param bounds - The database clock, and the oldest play time this write still accepts
 * @returns The problem, or null when the submission is within every bound
 */
export function findSubmissionProblem(
  submission: IResultSubmission,
  bounds: { earliest: number; now: number },
): SubmissionProblem | null {
  const seats: SubmissionProblem | null = findSeatProblem(submission);

  if (seats) {
    return seats;
  }

  const games: SubmissionProblem | null = findGameProblem(submission.games);

  if (games) {
    return games;
  }

  if (submission.ending === ResultEnding.RETIRED) {
    const seated: boolean = submission.seats.some((seat: IResultSeat): boolean => seat.seat === submission.retiredSeat);

    if (submission.retiredSeat === null || !seated) {
      return SubmissionProblem.RETIREMENT;
    }
  } else if (submission.retiredSeat !== null) {
    return SubmissionProblem.RETIREMENT;
  }

  return findPlayedAtProblem(submission.playedAt, bounds);
}

/**
 * What is wrong with a dispute's note, if anything.
 *
 * A note is words a person chose, so an empty one is no note rather than a refusal; what is refused is a note longer
 * than the column's bound, and a note attached to an action that carries none
 * @public
 * @function
 * @param note - The note as it arrived
 * @param carriesNote - Whether this action is the one a note belongs to
 * @returns The problem, or null
 */
export function findNoteProblem(note: string | null, carriesNote: boolean): SubmissionProblem | null {
  if (note === null) {
    return null;
  }

  if (!carriesNote) {
    return SubmissionProblem.NOTE;
  }

  return note.length > MAX_NOTE_LENGTH ? SubmissionProblem.NOTE : null;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suites can title their describe blocks from the source symbols
defineSymbol(findSubmissionProblem, {
  name: 'Find Submission Problem',
  description: 'The bound a submitted result breaks, if it breaks one.',
});

defineSymbol(findNoteProblem, {
  name: 'Find Note Problem',
  description: "The bound a dispute's note breaks, if it breaks one.",
});
