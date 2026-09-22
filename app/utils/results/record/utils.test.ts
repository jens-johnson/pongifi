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
 * ████████████████████████████████████████ #utils/results/record/utils.test.ts ████████████████████████████████████████
 *
 * Unit tests for what the Record form derives and refuses.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { Seat } from '#shared/results';
import type { IMatchSettings } from '#shared/rules-engine';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import {
  EMPTY_SEAT_MESSAGE,
  NO_MEMBER_MESSAGE,
  RECORDER_ABSENT_MESSAGE,
  SCORE_CEILING_MESSAGE,
  SCORE_MISSING_MESSAGE,
  SCORE_SHAPE_MESSAGE,
  UNDECIDED_LINE,
} from './constants';
import type { IRecordDraft, IRecordProblems, IRecordRecorder, IRecordRow } from './types';
import { findRecordProblems, gamesToWin, isFinishedGame, readScore, rowsToShow, toDerivedLine } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Who is recording
 * @internal
 * @constant
 */
const ADA: string = 'a4f1c0de-0000-4000-8000-000000000001';

/**
 * Who they played
 * @internal
 * @constant
 */
const BEN: string = 'b5e2d1ef-0000-4000-8000-000000000002';

/**
 * A best of three to eleven, win by two
 * @internal
 * @constant
 */
const SETTINGS: IMatchSettings = {
  cutthroatTimeCap: 0,
  expediteEnabled: false,
  gameType: GameType.SINGLES,
  matchFormat: 3,
  serviceInterval: 2,
  targetScore: 11,
  winningMargin: 2,
};

/**
 * The recorder, who may record without playing unless a case says otherwise
 * @internal
 * @function
 * @param overrides - What the case changes
 * @returns The recorder
 */
function recorder(overrides: Partial<IRecordRecorder> = {}): IRecordRecorder {
  return {
    mustPlay: false,
    nameOf: (userId: string): string => (userId === ADA ? 'Ada' : 'Ben'),
    userId: ADA,
    ...overrides,
  };
}

/**
 * Turns pairs into the rows a form holds, which are strings
 * @internal
 * @function
 * @param pairs - The scores
 * @returns The rows
 */
function rows(...pairs: [number | string, number | string][]): IRecordRow[] {
  return pairs.map(([a, b]): IRecordRow => ({ a: String(a), b: String(b) }));
}

/**
 * A form as it stands
 * @internal
 * @function
 * @param overrides - What the case changes
 * @returns The draft
 */
function draft(overrides: Partial<IRecordDraft> = {}): IRecordDraft {
  return {
    ending: 'COMPLETED',
    gamesPlayed: 1,
    gameType: GameType.SINGLES,
    playedAt: '2026-09-20T12:00:00.000Z',
    retiredSeat: null,
    rows: rows([11, 4], [11, 6]),
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: ADA,
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: BEN,
      },
    ],
    ...overrides,
  };
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(gamesToWin), (): void => {
    it('is a majority of the format', (): void => {
      expect([1, 3, 5, 7].map(gamesToWin)).toEqual([1, 2, 3, 4]);
    });
  });

  describe(symbolName(readScore), (): void => {
    it('tells an empty box from a zero', (): void => {
      // A blank box is somebody who has not finished typing; 0-0 is a real score a retirement can carry
      expect(readScore('')).toEqual({ problem: SCORE_MISSING_MESSAGE });
      expect(readScore('   ')).toEqual({ problem: SCORE_MISSING_MESSAGE });
      expect(readScore('0')).toEqual({ score: 0 });
    });

    it('refuses anything that is not a whole number', (): void => {
      expect(readScore('11.5')).toEqual({ problem: SCORE_SHAPE_MESSAGE });
      expect(readScore('-1')).toEqual({ problem: SCORE_SHAPE_MESSAGE });
      expect(readScore('eleven')).toEqual({ problem: SCORE_SHAPE_MESSAGE });
    });

    it('is honest about the ceiling being this form’s and not the game’s', (): void => {
      expect(readScore('99')).toEqual({ score: 99 });
      expect(readScore('100')).toEqual({ problem: SCORE_CEILING_MESSAGE });
    });
  });

  describe(symbolName(isFinishedGame), (): void => {
    it('accepts a game that ended on the point that ended it', (): void => {
      expect(isFinishedGame(SETTINGS, GameType.SINGLES, 11, 4)).toBe(true);
      expect(isFinishedGame(SETTINGS, GameType.SINGLES, 12, 10)).toBe(true);
      expect(isFinishedGame(SETTINGS, GameType.SINGLES, 15, 13)).toBe(true);
    });

    it('refuses a deuce overrun, because the game would have ended earlier', (): void => {
      // 13-10 under a game to 11, win by 2: the game was over at 12-10 and those points were never played
      expect(isFinishedGame(SETTINGS, GameType.SINGLES, 13, 10)).toBe(false);
    });

    it('refuses a game nobody has won yet, and one won by too little', (): void => {
      expect(isFinishedGame(SETTINGS, GameType.SINGLES, 5, 3)).toBe(false);
      expect(isFinishedGame(SETTINGS, GameType.SINGLES, 11, 10)).toBe(false);
      expect(isFinishedGame(SETTINGS, GameType.SINGLES, 0, 0)).toBe(false);
    });
  });

  describe(symbolName(rowsToShow), (): void => {
    it('starts at the fewest games the format can take', (): void => {
      expect(rowsToShow(SETTINGS, draft({ rows: rows(['', ''], ['', '']) }))).toBe(2);
    });

    it('grows a row once what is entered leaves the match open', (): void => {
      expect(rowsToShow(SETTINGS, draft({ rows: rows([11, 4], [6, 11]) }))).toBe(3);
    });

    it('stops at the row that decided it', (): void => {
      expect(rowsToShow(SETTINGS, draft({ rows: rows([11, 4], [11, 6], [11, 3]) }))).toBe(2);
    });

    it('never grows past the format', (): void => {
      expect(rowsToShow(SETTINGS, draft({ rows: rows([11, 4], [6, 11], [11, 9]) }))).toBe(3);
    });

    it('never shrinks below the minimum a format can take', (): void => {
      // A best of five that has seen one finished game still has at least three rows; a form that shrank under
      // somebody's hands would take away a row they were about to type in
      for (const [matchFormat, minimum] of [
        [1, 1],
        [3, 2],
        [5, 3],
        [7, 4],
      ] as [number, number][]) {
        const settings: IMatchSettings = { ...SETTINGS, matchFormat };
        const blank: IRecordDraft = draft({ rows: rows(['', ''], ['', ''], ['', ''], ['', '']) });
        const started: IRecordDraft = draft({ rows: rows([11, 4], ['', ''], ['', ''], ['', '']) });

        expect(rowsToShow(settings, blank)).toBe(minimum);
        expect(rowsToShow(settings, started)).toBe(minimum);
      }
    });

    it('grows past the minimum only once the games entered need it', (): void => {
      const five: IMatchSettings = { ...SETTINGS, matchFormat: 5 };

      expect(rowsToShow(five, draft({ rows: rows([11, 4], [11, 6], ['', '']) }))).toBe(3);
      expect(rowsToShow(five, draft({ rows: rows([11, 4], [4, 11], [11, 6], ['', '']) }))).toBe(4);
      expect(rowsToShow(five, draft({ rows: rows([11, 4], [11, 6], [11, 3]) }))).toBe(3);
    });

    it('takes a withdrawal’s count from the person rather than deriving it', (): void => {
      // A match abandoned in its first game is one row, and nothing about the scores says so
      const retired: IRecordDraft = draft({
        ending: 'RETIRED',
        gamesPlayed: 1,
        retiredSeat: Seat.B1,
      });

      expect(rowsToShow(SETTINGS, retired)).toBe(1);
      expect(rowsToShow(SETTINGS, { ...retired, gamesPlayed: 9 })).toBe(3);
    });
  });

  describe(symbolName(toDerivedLine), (): void => {
    const names = { a: 'Ada', b: 'Ben' };

    it('says nothing is decided until it is', (): void => {
      expect(toDerivedLine(SETTINGS, draft({ rows: rows([11, 4], ['', '']) }), names)).toBe(UNDECIDED_LINE);
    });

    it('names the winner and the games once it is', (): void => {
      expect(toDerivedLine(SETTINGS, draft(), names)).toBe('Ada win 2-0');
      expect(toDerivedLine(SETTINGS, draft({ rows: rows([4, 11], [6, 11]) }), names)).toBe('Ben win 0-2');
    });

    it('credits the game somebody withdrew during to the side that stayed', (): void => {
      // The spec's example: a retired best of 3 at 11-7, 4-6 gives game 1 to A on the scoreboard and game 2 to A by
      // the withdrawal
      const line: string = toDerivedLine(
        SETTINGS,
        draft({
          ending: 'RETIRED',
          gamesPlayed: 2,
          retiredSeat: Seat.B1,
          rows: rows([11, 7], [4, 6]),
        }),
        names,
      );

      expect(line).toBe('Ada win 2-0 · Ben retired');
    });

    it('lets a side that withdrew keep the games it had already won, and still lose', (): void => {
      // 1-1 on games and the match is Ben's: every completed game keeps its winner, and the side that withdrew
      // loses however far ahead it was
      const line: string = toDerivedLine(
        SETTINGS,
        draft({
          ending: 'RETIRED',
          gamesPlayed: 2,
          retiredSeat: Seat.A1,
          rows: rows([11, 4], [5, 3]),
        }),
        names,
      );

      expect(line).toBe('Ben win 1-1 · Ada retired');
    });

    it('credits a withdrawal in the first game at nil-nil', (): void => {
      const line: string = toDerivedLine(
        SETTINGS,
        draft({
          ending: 'RETIRED',
          gamesPlayed: 1,
          retiredSeat: Seat.B1,
          rows: rows([0, 0]),
        }),
        names,
      );

      expect(line).toBe('Ada win 1-0 · Ben retired');
    });

    it('counts the games the form is showing, not the rows it happens to hold', (): void => {
      // A third game after a 2-0 has already been dropped from the form; the line must not still be counting it
      expect(toDerivedLine(SETTINGS, draft({ rows: rows([11, 4], [11, 6], [11, 3]) }), names)).toBe('Ada win 2-0');
    });
  });

  describe(symbolName(findRecordProblems), (): void => {
    it('finds nothing wrong with a match that was played', (): void => {
      expect(findRecordProblems(SETTINGS, draft(), recorder())).toEqual({
        match: null,
        playedAt: null,
        rows: {},
        seats: {},
      });
    });

    it('puts a row’s message on that row', (): void => {
      const found: IRecordProblems = findRecordProblems(SETTINGS, draft({ rows: rows([13, 10], [11, 6]) }), recorder());

      expect(found.rows[0]).toBe('13-10 is not a finished game in this league (games go to 11, win by 2)');
      expect(found.rows[1]).toBeUndefined();
    });

    it('drops a game the match was already over before, rather than complaining about it', (): void => {
      // The form removes the row instead: a third game after a 2-0 is not an error somebody made, it is a row that
      // stopped being needed, and it is judged on the two that count
      const decided: IRecordDraft = draft({ rows: rows([11, 4], [11, 6], [11, 3]) });

      expect(rowsToShow(SETTINGS, decided)).toBe(2);
      expect(findRecordProblems(SETTINGS, decided, recorder())).toEqual({
        match: null,
        playedAt: null,
        rows: {},
        seats: {},
      });
    });

    it('says a match that ends undecided is not one', (): void => {
      const found: IRecordProblems = findRecordProblems(SETTINGS, draft({ rows: rows([11, 4]) }), recorder());

      expect(found.match).toBe('A best of 3 ends when one side wins 2 games.');
    });

    it('lets a withdrawal leave its last game unfinished, and only its last', (): void => {
      const retired: IRecordDraft = draft({
        ending: 'RETIRED',
        gamesPlayed: 2,
        retiredSeat: Seat.B1,
        rows: rows([11, 4], [5, 3]),
      });

      expect(findRecordProblems(SETTINGS, retired, recorder()).rows).toEqual({});

      // The earlier game is still judged as played
      const earlier: IRecordProblems = findRecordProblems(
        SETTINGS,
        { ...retired, rows: rows([7, 4], [5, 3]) },
        recorder(),
      );

      expect(earlier.rows[0]).toContain('not a finished game');
    });

    it('accepts a withdrawal in the first game at nil-nil', (): void => {
      const found: IRecordProblems = findRecordProblems(
        SETTINGS,
        draft({
          ending: 'RETIRED',
          gamesPlayed: 1,
          retiredSeat: Seat.B1,
          rows: rows([0, 0]),
        }),
        recorder(),
      );

      expect(found.rows).toEqual({});
      expect(found.match).toBeNull();
    });

    it('asks an empty seat to be filled', (): void => {
      const found: IRecordProblems = findRecordProblems(
        SETTINGS,
        draft({
          seats: [
            {
              guestName: null,
              seat: Seat.A1,
              userId: ADA,
            },
            {
              guestName: null,
              seat: Seat.B1,
              userId: null,
            },
          ],
        }),
        recorder(),
      );

      expect(found.seats[Seat.B1]).toBe(EMPTY_SEAT_MESSAGE);
    });

    it('names whoever was picked twice', (): void => {
      const found: IRecordProblems = findRecordProblems(
        SETTINGS,
        draft({
          seats: [
            {
              guestName: null,
              seat: Seat.A1,
              userId: ADA,
            },
            {
              guestName: null,
              seat: Seat.B1,
              userId: ADA,
            },
          ],
        }),
        recorder(),
      );

      expect(found.seats[Seat.B1]).toBe('Ada is already in this game');
    });

    it('refuses a match of guests alone', (): void => {
      const found: IRecordProblems = findRecordProblems(
        SETTINGS,
        draft({
          seats: [
            {
              guestName: 'Sam',
              seat: Seat.A1,
              userId: null,
            },
            {
              guestName: 'Kim',
              seat: Seat.B1,
              userId: null,
            },
          ],
        }),
        recorder(),
      );

      expect(found.match).toBe(NO_MEMBER_MESSAGE);
    });

    it('makes a recorder play where the league only lets participants record', (): void => {
      const found: IRecordProblems = findRecordProblems(
        SETTINGS,
        draft({
          seats: [
            {
              guestName: 'Sam',
              seat: Seat.A1,
              userId: null,
            },
            {
              guestName: null,
              seat: Seat.B1,
              userId: BEN,
            },
          ],
        }),
        recorder({ mustPlay: true }),
      );

      expect(found.match).toBe(RECORDER_ABSENT_MESSAGE);
    });

    it('says nothing about the set while a row is still unreadable', (): void => {
      // A half-typed form is not a wrong one, and a message above Save about games nobody has entered is noise
      const found: IRecordProblems = findRecordProblems(SETTINGS, draft({ rows: rows([11, 4], ['', '']) }), recorder());

      expect(found.rows[1]).toBe(SCORE_MISSING_MESSAGE);
      expect(found.match).toBeNull();
    });
  });
});
