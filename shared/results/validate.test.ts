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
 * █████████████████████████████████████████ #shared/results/validate.test.ts ██████████████████████████████████████████
 *
 * Unit tests for the bounds a submitted result and a dispute note have to meet.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import { MAX_ENTERED_SCORE, MAX_GAME_ROWS, MAX_GUEST_NAME_LENGTH, MAX_NOTE_LENGTH } from './constants';
import { ResultEnding, Seat } from './enums';
import type { IGameScoreRow, IResultSeat, IResultSubmission } from './types';
import { findNoteProblem, findSubmissionProblem, SubmissionProblem } from './validate';

/**
 * The instant every case is judged against, and the oldest play time it accepts
 * @internal
 * @constant
 */
const BOUNDS: { earliest: number; now: number } = {
  earliest: Date.parse('2026-09-17T18:00:00.000Z'),
  now: Date.parse('2026-09-19T18:00:00.000Z'),
};

/**
 * A singles submission inside every bound, varied per case
 * @internal
 * @function
 * @param overrides - What this case varies
 * @returns The submission
 */
function submission(overrides: Partial<IResultSubmission> = {}): IResultSubmission {
  return {
    ending: ResultEnding.COMPLETED,
    gameType: GameType.SINGLES,
    games: [
      {
        a: 11,
        b: 4,
        gameNumber: 1,
      },
    ],
    playedAt: '2026-09-19T17:00:00.000Z',
    retiredSeat: null,
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: 'ada',
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: 'ben',
      },
    ],
    ...overrides,
  };
}

/**
 * The seats a case varies, written once
 * @internal
 * @function
 * @param guestName - The label the B1 seat holds, or null for a member
 * @returns The seats
 */
function withGuest(guestName: string | null): IResultSeat[] {
  return [
    {
      guestName: null,
      seat: Seat.A1,
      userId: 'ada',
    },
    {
      guestName,
      seat: Seat.B1,
      userId: guestName === null ? 'ben' : null,
    },
  ];
}

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(findSubmissionProblem), (): void => {
    it('accepts a submission inside every bound', (): void => {
      expect(findSubmissionProblem(submission(), BOUNDS)).toBeNull();
    });

    it('accepts a guest label that only needs trimming, and refuses one that needs cutting', (): void => {
      expect(findSubmissionProblem(submission({ seats: withGuest('  Priya  ') }), BOUNDS)).toBeNull();
      expect(
        findSubmissionProblem(submission({ seats: withGuest('x'.repeat(MAX_GUEST_NAME_LENGTH)) }), BOUNDS),
      ).toBeNull();
      expect(
        findSubmissionProblem(submission({ seats: withGuest('x'.repeat(MAX_GUEST_NAME_LENGTH + 1)) }), BOUNDS),
      ).toBe(SubmissionProblem.GUEST_NAME);
      expect(findSubmissionProblem(submission({ seats: withGuest('   ') }), BOUNDS)).toBe(SubmissionProblem.GUEST_NAME);
    });

    it('names the bound a body breaks', (): void => {
      const rows: IGameScoreRow[] = Array.from({ length: MAX_GAME_ROWS + 1 }, (_row, index: number): IGameScoreRow => ({
        a: 11,
        b: 4,
        gameNumber: index + 1,
      }));
      const cases: [string, IResultSubmission, SubmissionProblem][] = [
        ['a format with no final-score form', submission({ gameType: GameType.CUTTHROAT }), SubmissionProblem.FORMAT],
        ['no games at all', submission({ games: [] }), SubmissionProblem.GAME_COUNT],
        ['more games than a best-of-seven holds', submission({ games: rows }), SubmissionProblem.GAME_COUNT],
        [
          'games numbered from two',
          submission({
            games: [
              {
                a: 11,
                b: 4,
                gameNumber: 2,
              },
            ],
          }),
          SubmissionProblem.GAME_NUMBERING,
        ],
        [
          'a score above the form’s ceiling',
          submission({
            games: [
              {
                a: MAX_ENTERED_SCORE + 1,
                b: 4,
                gameNumber: 1,
              },
            ],
          }),
          SubmissionProblem.SCORE_RANGE,
        ],
        [
          'a fractional score',
          submission({
            games: [
              {
                a: 11.5,
                b: 4,
                gameNumber: 1,
              },
            ],
          }),
          SubmissionProblem.SCORE_RANGE,
        ],
        [
          'a seat the format does not fill',
          submission({
            seats: [
              {
                guestName: null,
                seat: Seat.A1,
                userId: 'ada',
              },
              {
                guestName: null,
                seat: Seat.A2,
                userId: 'ben',
              },
            ],
          }),
          SubmissionProblem.SEATS,
        ],
        [
          'a seat holding both a member and a guest',
          submission({
            seats: [
              {
                guestName: 'Priya',
                seat: Seat.A1,
                userId: 'ada',
              },
              {
                guestName: null,
                seat: Seat.B1,
                userId: 'ben',
              },
            ],
          }),
          SubmissionProblem.SEAT_IDENTITY,
        ],
        [
          'one member sitting twice',
          submission({
            seats: [
              {
                guestName: null,
                seat: Seat.A1,
                userId: 'ada',
              },
              {
                guestName: null,
                seat: Seat.B1,
                userId: 'ada',
              },
            ],
          }),
          SubmissionProblem.SEAT_IDENTITY,
        ],
        [
          'a match between two guests',
          submission({
            seats: [
              {
                guestName: 'Priya',
                seat: Seat.A1,
                userId: null,
              },
              {
                guestName: 'Quinn',
                seat: Seat.B1,
                userId: null,
              },
            ],
          }),
          SubmissionProblem.NO_MEMBER,
        ],
        [
          'a retirement naming nobody',
          submission({ ending: ResultEnding.RETIRED, retiredSeat: null }),
          SubmissionProblem.RETIREMENT,
        ],
        [
          'a retirement naming a seat nobody sits in',
          submission({ ending: ResultEnding.RETIRED, retiredSeat: Seat.B2 }),
          SubmissionProblem.RETIREMENT,
        ],
        ['a withdrawal on a completed match', submission({ retiredSeat: Seat.A1 }), SubmissionProblem.RETIREMENT],
        [
          'a play time that is not an instant',
          submission({ playedAt: 'saturday' }),
          SubmissionProblem.PLAYED_AT_MALFORMED,
        ],
        [
          'a play time the clock has not reached',
          submission({ playedAt: '2026-09-19T18:00:01.000Z' }),
          SubmissionProblem.PLAYED_AT_FUTURE,
        ],
        [
          'a play time older than the window',
          submission({ playedAt: '2026-09-17T17:59:59.000Z' }),
          SubmissionProblem.PLAYED_AT_STALE,
        ],
      ];

      expect(
        cases.map(([name, body]): [string, SubmissionProblem | null] => [name, findSubmissionProblem(body, BOUNDS)]),
      ).toEqual(cases.map(([name, , problem]): [string, SubmissionProblem] => [name, problem]));
    });

    it('accepts the instants exactly on each bound', (): void => {
      expect(findSubmissionProblem(submission({ playedAt: new Date(BOUNDS.now).toISOString() }), BOUNDS)).toBeNull();
      expect(
        findSubmissionProblem(submission({ playedAt: new Date(BOUNDS.earliest).toISOString() }), BOUNDS),
      ).toBeNull();
    });
  });

  describe(symbolName(findNoteProblem), (): void => {
    it('accepts no note, and a note up to the column’s bound', (): void => {
      expect(findNoteProblem(null, true)).toBeNull();
      expect(findNoteProblem('x'.repeat(MAX_NOTE_LENGTH), true)).toBeNull();
    });

    it('refuses a longer note, and any note on an action that carries none', (): void => {
      expect(findNoteProblem('x'.repeat(MAX_NOTE_LENGTH + 1), true)).toBe(SubmissionProblem.NOTE);
      expect(findNoteProblem('why not', false)).toBe(SubmissionProblem.NOTE);
    });
  });
});
