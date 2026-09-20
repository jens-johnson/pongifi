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
 * ███████████████████████████████████████████ #shared/results/utils.test.ts ███████████████████████████████████████████
 *
 * Unit tests for canonical form, normalization and the replay order.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import { ResultEnding, Seat } from './enums';
import type { IResultSubmission } from './types';
import type { IOrderedGame } from './utils';
import { canonicalize, compareForReplay, normalizeSubmission, seatsForGameType } from './utils';

/**
 * A game as the replay orders it
 * @internal
 * @function
 * @param overrides - What this case varies
 * @returns The ordered game
 */
function ordered(overrides: Partial<IOrderedGame> = {}): IOrderedGame {
  return {
    canonicalMatchId: 'match-a',
    gameId: 'game-a',
    gameNumber: 1,
    playedAt: '2026-09-19T18:00:00.000Z',
    ...overrides,
  };
}

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(canonicalize), (): void => {
    it('writes the same bytes whatever order the keys arrived in', (): void => {
      expect(canonicalize({ a: 1, b: { d: 4, c: 3 } })).toBe(canonicalize({ b: { c: 3, d: 4 }, a: 1 }));
    });

    it('keeps array order, which is meaning rather than presentation', (): void => {
      expect(canonicalize([2, 1])).not.toBe(canonicalize([1, 2]));
    });

    it('writes an undefined value as null rather than as nothing', (): void => {
      expect(canonicalize(undefined)).toBe('null');
    });
  });

  describe(symbolName(normalizeSubmission), (): void => {
    it('digests identically whatever order the seats and games arrived in', (): void => {
      const one: IResultSubmission = {
        ending: ResultEnding.COMPLETED,
        gameType: GameType.DOUBLES,
        games: [
          {
            a: 11,
            b: 4,
            gameNumber: 1,
          },
          {
            a: 11,
            b: 6,
            gameNumber: 2,
          },
        ],
        playedAt: '2026-09-19T18:00:00.000Z',
        retiredSeat: null,
        seats: [
          {
            guestName: null,
            seat: Seat.B2,
            userId: 'u4',
          },
          {
            guestName: null,
            seat: Seat.A1,
            userId: 'u1',
          },
          {
            guestName: ' Sam ',
            seat: Seat.B1,
            userId: null,
          },
          {
            guestName: null,
            seat: Seat.A2,
            userId: 'u3',
          },
        ],
      };
      const other: IResultSubmission = {
        ...one,
        games: [...one.games].reverse(),
        playedAt: '2026-09-19T18:00:00Z',
        seats: [...one.seats].reverse(),
      };

      expect(canonicalize(normalizeSubmission(one))).toBe(canonicalize(normalizeSubmission(other)));
    });

    it('trims a guest label and bounds its length', (): void => {
      const [seat] = normalizeSubmission({
        ending: ResultEnding.COMPLETED,
        gameType: GameType.SINGLES,
        games: [
          {
            a: 11,
            b: 4,
            gameNumber: 1,
          },
        ],
        playedAt: '2026-09-19T18:00:00.000Z',
        retiredSeat: null,
        seats: [
          {
            guestName: `  ${'x'.repeat(60)}  `,
            seat: Seat.A1,
            userId: null,
          },
          {
            guestName: null,
            seat: Seat.B1,
            userId: 'u1',
          },
        ],
      }).seats;

      expect(seat?.guestName).toHaveLength(40);
    });
  });

  describe(symbolName(compareForReplay), (): void => {
    it('rates the earlier match first', (): void => {
      expect(compareForReplay(ordered({ playedAt: '2026-09-18T18:00:00.000Z' }), ordered())).toBeLessThan(0);
    });

    it('keeps a match’s games contiguous when two matches share a play time', (): void => {
      const rows: IOrderedGame[] = [
        ordered({
          canonicalMatchId: 'match-b',
          gameId: 'g3',
          gameNumber: 1,
        }),
        ordered({
          canonicalMatchId: 'match-a',
          gameId: 'g2',
          gameNumber: 2,
        }),
        ordered({
          canonicalMatchId: 'match-a',
          gameId: 'g1',
          gameNumber: 1,
        }),
      ];

      expect([...rows].sort(compareForReplay).map((row: IOrderedGame): string => row.gameId)).toEqual([
        'g1',
        'g2',
        'g3',
      ]);
    });

    it('still has one total order for two games that agree on everything else', (): void => {
      expect(compareForReplay(ordered({ gameId: 'a' }), ordered({ gameId: 'b' }))).toBeLessThan(0);
      expect(compareForReplay(ordered(), ordered())).toBe(0);
    });
  });

  describe(symbolName(seatsForGameType), (): void => {
    it('fills two seats for singles and four for doubles, and none for a format with no form', (): void => {
      expect(seatsForGameType(GameType.SINGLES)).toEqual([Seat.A1, Seat.B1]);
      expect(seatsForGameType(GameType.DOUBLES)).toEqual([Seat.A1, Seat.B1, Seat.A2, Seat.B2]);
      expect(seatsForGameType(GameType.CUTTHROAT)).toEqual([]);
    });
  });
});
