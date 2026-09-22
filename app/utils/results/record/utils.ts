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
 * ██████████████████████████████████████████ #utils/results/record/utils.ts ███████████████████████████████████████████
 *
 * What the Record form derives and refuses, judged by the same engine the server uses.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IResultSeat, IResultSubmission } from '#shared/results';
import { reconstructResult, ResultEnding, seatsForGameType } from '#shared/results';
import type { GameType, IMatchSettings } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import {
  EMPTY_SEAT_MESSAGE,
  GUEST_NAME_MESSAGE,
  MAX_FORM_SCORE,
  MAX_GUEST_NAME,
  NO_MEMBER_MESSAGE,
  RECORDER_ABSENT_MESSAGE,
  SCORE_CEILING_MESSAGE,
  SCORE_MISSING_MESSAGE,
  SCORE_SHAPE_MESSAGE,
  UNDECIDED_LINE,
} from './constants';
import type {
  IRecordDraft,
  IRecordProblems,
  IRecordRecorder,
  IRecordRow,
  IRecordSeat,
  IRecordSideNames,
} from './types';

/**
 * Renders an instant for a `datetime-local` input, which takes local wall-clock time and no zone.
 *
 * The instant is the server's; only its presentation is local. A browser in another zone shows a different clock
 * face for the same moment, which is what somebody reading it expects
 * @public
 * @function
 * @param iso - The instant, as the server issued it
 * @returns What the input displays, or an empty string when there is no instant
 */
export function toDateTimeLocal(iso: string): string {
  const instant: Date = new Date(iso);

  if (Number.isNaN(instant.getTime())) {
    return '';
  }

  const pad = (value: number): string => String(value).padStart(2, '0');

  return (
    `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}` +
    `T${pad(instant.getHours())}:${pad(instant.getMinutes())}`
  );
}

/**
 * Reads what a `datetime-local` input holds back into an instant
 * @public
 * @function
 * @param local - What the input holds
 * @returns The instant, or null when the input holds nothing usable
 */
export function fromDateTimeLocal(local: string): string | null {
  const instant: Date = new Date(local);

  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/**
 * How many games a side has to win to take the match
 * @public
 * @function
 * @param matchFormat - Best of how many
 * @returns The number of games that wins it
 */
export function gamesToWin(matchFormat: number): number {
  return Math.floor(matchFormat / 2) + 1;
}

/**
 * Reads a typed score, or says why it cannot be read.
 *
 * Empty is a message rather than a zero. A blank box is somebody who has not finished typing, and 0-0 is a real
 * score that a retirement can carry, so the two must not collapse into each other
 * @public
 * @function
 * @param typed - What the input holds
 * @returns The score, or the message to show under it
 */
export function readScore(typed: string): { problem: string } | { score: number } {
  const trimmed: string = typed.trim();

  if (trimmed.length === 0) {
    return { problem: SCORE_MISSING_MESSAGE };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { problem: SCORE_SHAPE_MESSAGE };
  }

  const score: number = Number(trimmed);

  return score > MAX_FORM_SCORE ? { problem: SCORE_CEILING_MESSAGE } : { score };
}

/**
 * The scoring rules a single game is judged by, which is this match's rules over a best of one.
 *
 * Asking the engine about one game rather than re-deriving what a finished game is: deuce, the winning margin and
 * the point the game ends on are the engine's arithmetic, and a second copy of it here would be a second answer
 * @internal
 * @function
 * @param settings - The match's frozen rules
 * @returns The same rules over a single game
 */
function asSingleGame(settings: IMatchSettings): IMatchSettings {
  return { ...settings, matchFormat: 1 };
}

/**
 * Builds a submission the engine will take, from whatever the form holds
 * @internal
 * @function
 * @param draft - The form
 * @param rows - The rows to include
 * @returns The submission
 */
function asSubmission(draft: IRecordDraft, rows: { a: number; b: number }[]): IResultSubmission {
  return {
    ending: draft.ending === 'RETIRED' ? ResultEnding.RETIRED : ResultEnding.COMPLETED,
    gameType: draft.gameType,
    games: rows.map((row, index): { a: number; b: number; gameNumber: number } => ({
      a: row.a,
      b: row.b,
      gameNumber: index + 1,
    })),
    playedAt: draft.playedAt,
    retiredSeat: draft.ending === 'RETIRED' ? draft.retiredSeat : null,
    seats: draft.seats.map((seat: IRecordSeat): IResultSeat => ({
      guestName: seat.userId === null ? (seat.guestName?.trim() ?? '') : null,
      seat: seat.seat,
      userId: seat.userId,
    })),
  };
}

/**
 * Whether these two scores are a game that finished under these rules.
 *
 * Answered by replaying one game through the engine rather than by arithmetic here. A deuce overrun (13-10 under a
 * game to 11, win by 2) is refused because the game would have ended at 12-10, and that is the engine's judgement
 * rather than a rule this form keeps its own copy of
 * @public
 * @function
 * @param settings - The match's frozen rules
 * @param gameType - The format, which decides the seats a replay needs
 * @param a - Side A's score
 * @param b - Side B's score
 * @returns Whether a legal game reaches exactly this
 */
export function isFinishedGame(settings: IMatchSettings, gameType: GameType, a: number, b: number): boolean {
  const seats: IResultSeat[] = seatsForGameType(gameType).map((seat): IResultSeat => ({
    guestName: null,
    seat,
    userId: seat as string,
  }));

  try {
    reconstructResult(asSingleGame({ ...settings, gameType }), {
      ending: ResultEnding.COMPLETED,
      gameType,
      games: [
        {
          a,
          b,
          gameNumber: 1,
        },
      ],
      playedAt: new Date().toISOString(),
      retiredSeat: null,
      seats,
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * How many rows the form should be showing.
 *
 * A best of N starts at the fewest games it can take and grows a row whenever what has been entered leaves the
 * match open, never past N. A retirement is not derived at all: the person said how many games were played, and a
 * match abandoned in its first game is one row
 * @public
 * @function
 * @param settings - The match's frozen rules
 * @param draft - The form
 * @returns How many rows belong on screen
 */
export function rowsToShow(settings: IMatchSettings, draft: IRecordDraft): number {
  if (draft.ending === 'RETIRED') {
    return Math.min(Math.max(draft.gamesPlayed, 1), settings.matchFormat);
  }

  const needed: number = gamesToWin(settings.matchFormat);
  let won: { a: number; b: number } = { a: 0, b: 0 };
  let shown: number = needed;

  for (const [index, row] of draft.rows.entries()) {
    const a = readScore(row.a);
    const b = readScore(row.b);

    if (!('score' in a) || !('score' in b) || !isFinishedGame(settings, draft.gameType, a.score, b.score)) {
      // An unreadable or unfinished row decides nothing, so the rows after it are still the ones already on screen
      return Math.max(shown, index + 1);
    }

    won = a.score > b.score ? { ...won, a: won.a + 1 } : { ...won, b: won.b + 1 };

    if (won.a === needed || won.b === needed) {
      return index + 1;
    }

    // Never below the minimum: a best of five that has seen one finished game still has at least three rows, and
    // taking index + 2 alone would shrink the form under the person's hands
    shown = Math.max(needed, Math.min(index + 2, settings.matchFormat));
  }

  return shown;
}

/**
 * Which side, if either, withdrew
 * @internal
 * @function
 * @param draft - The form
 * @returns The side, or null when nobody did
 */
function retiredSideOf(draft: IRecordDraft): 'a' | 'b' | null {
  if (draft.ending !== 'RETIRED' || draft.retiredSeat === null) {
    return null;
  }

  return String(draft.retiredSeat).startsWith('A') ? 'a' : 'b';
}

/**
 * How many games each side has won, over the rows the form is actually showing.
 *
 * Counting stops at the first row that cannot be read: a half-typed form has no more to say. A game that was played
 * out keeps its own winner whoever withdrew afterwards, and the game somebody withdrew during goes to the side that
 * stayed, whatever the score had reached
 * @internal
 * @function
 * @param settings - The match's frozen rules
 * @param draft - The form
 * @returns The games won
 */
function countGamesWon(settings: IMatchSettings, draft: IRecordDraft): { a: number; b: number } {
  const won: { a: number; b: number } = { a: 0, b: 0 };
  const visible: IRecordRow[] = draft.rows.slice(0, rowsToShow(settings, draft));
  const retired: 'a' | 'b' | null = retiredSideOf(draft);

  for (const [index, row] of visible.entries()) {
    const a = readScore(row.a);
    const b = readScore(row.b);

    if (!('score' in a) || !('score' in b)) {
      break;
    }

    if (isFinishedGame(settings, draft.gameType, a.score, b.score)) {
      won[a.score > b.score ? 'a' : 'b'] += 1;

      continue;
    }

    if (retired !== null && index === visible.length - 1) {
      won[retired === 'a' ? 'b' : 'a'] += 1;
    }

    break;
  }

  return won;
}

/**
 * The line under the rows, which says where the match stands as somebody types
 * @public
 * @function
 * @param settings - The match's frozen rules
 * @param draft - The form
 * @param names - What to call each side
 * @returns The line
 */
export function toDerivedLine(settings: IMatchSettings, draft: IRecordDraft, names: IRecordSideNames): string {
  const won: { a: number; b: number } = countGamesWon(settings, draft);
  const retired: 'a' | 'b' | null = retiredSideOf(draft);

  if (retired !== null) {
    return `${retired === 'a' ? names.b : names.a} win ${won.a}-${won.b} · ${retired === 'a' ? names.a : names.b} retired`;
  }

  const needed: number = gamesToWin(settings.matchFormat);

  if (won.a >= needed || won.b >= needed) {
    return `${won.a > won.b ? names.a : names.b} win ${won.a}-${won.b}`;
  }

  return UNDECIDED_LINE;
}

/**
 * What is wrong with the seats, seat by seat and then as a set
 * @internal
 * @function
 * @param draft - The form
 * @param recorder - Who is recording, whether the league makes them play, and how to name a member
 * @returns The seat messages and the match-level one
 */
function findSeatProblems(
  draft: IRecordDraft,
  recorder: IRecordRecorder,
): { match: string | null; seats: IRecordProblems['seats'] } {
  const seats: IRecordProblems['seats'] = {};
  const members: string[] = [];

  for (const seat of draft.seats) {
    if (seat.userId === null && (seat.guestName === null || seat.guestName.trim().length === 0)) {
      seats[seat.seat] = EMPTY_SEAT_MESSAGE;

      continue;
    }

    if (seat.userId === null) {
      const name: string = seat.guestName?.trim() ?? '';

      if (name.length > MAX_GUEST_NAME) {
        seats[seat.seat] = GUEST_NAME_MESSAGE;
      }

      continue;
    }

    if (members.includes(seat.userId)) {
      // Named rather than numbered: whoever reads this knows which of their picks to change
      seats[seat.seat] = `${recorder.nameOf(seat.userId)} is already in this game`;
    }

    members.push(seat.userId);
  }

  if (Object.keys(seats).length > 0) {
    return { match: null, seats };
  }

  if (members.length === 0) {
    return { match: NO_MEMBER_MESSAGE, seats };
  }

  if (recorder.mustPlay && !members.includes(recorder.userId)) {
    return { match: RECORDER_ABSENT_MESSAGE, seats };
  }

  return { match: null, seats };
}

/**
 * Everything the form is refusing, addressed to where it is shown.
 *
 * The rows are judged one at a time against the engine, and then the set is judged by handing the whole thing to
 * the same reconstruction the server runs. Doing the set that way rather than counting games here means a match
 * decided too early, a match not decided at all and a row no legal rally order reaches are all the engine's answer
 * @public
 * @function
 * @param settings - The match's frozen rules
 * @param draft - The form
 * @param recorder - Who is recording, whether the league makes them play, and how to name a member
 * @returns What to show, and where
 */
export function findRecordProblems(
  settings: IMatchSettings,
  draft: IRecordDraft,
  recorder: IRecordRecorder,
): IRecordProblems {
  const { match, seats } = findSeatProblems(draft, recorder);
  const rows: Record<number, string> = {};
  const scores: { a: number; b: number }[] = [];
  const shown: number = rowsToShow(settings, draft);
  const visible: IRecordRow[] = draft.rows.slice(0, shown);

  for (const [index, row] of visible.entries()) {
    const a = readScore(row.a);
    const b = readScore(row.b);

    if (!('score' in a) || !('score' in b)) {
      rows[index] = 'score' in a ? (b as { problem: string }).problem : (a as { problem: string }).problem;

      continue;
    }

    scores.push({ a: a.score, b: b.score });

    // A withdrawal relaxes its last row alone: it may be unfinished, 0-0 included
    const last: boolean = index === visible.length - 1;

    if (!(draft.ending === 'RETIRED' && last) && !isFinishedGame(settings, draft.gameType, a.score, b.score)) {
      rows[index] =
        `${a.score}-${b.score} is not a finished game in this league ` +
        `(games go to ${settings.targetScore}, win by ${settings.winningMargin})`;
    }
  }

  if (Object.keys(rows).length > 0 || scores.length !== visible.length) {
    return {
      match,
      playedAt: null,
      rows,
      seats,
    };
  }

  let whole: string | null = match;

  if (whole === null && scores.length > 0) {
    try {
      reconstructResult({ ...settings, gameType: draft.gameType }, asSubmission(draft, scores));
    } catch {
      whole = `A best of ${settings.matchFormat} ends when one side wins ${gamesToWin(settings.matchFormat)} games.`;
    }
  }

  return {
    match: whole,
    playedAt: null,
    rows,
    seats,
  };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

defineSymbol(toDateTimeLocal, {
  name: 'To Date Time Local',
  description: 'Renders an instant for a datetime-local input.',
});

defineSymbol(fromDateTimeLocal, {
  name: 'From Date Time Local',
  description: 'Reads a datetime-local input back into an instant.',
});

defineSymbol(gamesToWin, {
  name: 'Games To Win',
  description: 'How many games a side has to win to take a best of N.',
});

defineSymbol(readScore, {
  name: 'Read Score',
  description: 'Reads a typed score, or says why it cannot be read.',
});

defineSymbol(isFinishedGame, {
  name: 'Is Finished Game',
  description: 'Whether two scores are a game that finished under these rules.',
});

defineSymbol(rowsToShow, {
  name: 'Rows To Show',
  description: 'How many game rows the form should be showing.',
});

defineSymbol(toDerivedLine, {
  name: 'To Derived Line',
  description: 'The line under the rows saying where the match stands.',
});

defineSymbol(findRecordProblems, {
  name: 'Find Record Problems',
  description: 'Everything the Record form is refusing, addressed to where it is shown.',
});
