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
 * █████████████████████████████████████ #shared/rating-engine/eligibility.test.ts █████████████████████████████████████
 *
 * Unit tests for data eligibility; the table in spec VIII.VII case by case.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { EConfirmationStatus, EGameStatus } from '#shared/domain';

import { feedsPointStatistics, feedsRallyStatistics, feedsRatings, feedsWinLoss } from './eligibility';
import type { IGameEligibility } from './types';

/**
 * A settled, rated, live-recorded game; every case states only what it varies
 * @internal
 * @function
 * @param overrides - Anything to vary
 * @returns Eligibility facts
 */
function facts(overrides: Partial<IGameEligibility> = {}): IGameEligibility {
  return {
    status: EGameStatus.COMPLETE,
    confirmationStatus: EConfirmationStatus.CONFIRMED,
    hasGuest: false,
    ratingEnabled: true,
    isLiveRecorded: true,
    ...overrides,
  };
}

/**
 * What a game feeds, as the table in VIII.VII expresses it
 * @internal
 * @function
 * @param eligibility - The game's facts
 * @returns The four answers, in table order
 */
function feeds(eligibility: IGameEligibility): [boolean, boolean, boolean, boolean] {
  return [
    feedsWinLoss(eligibility),
    feedsRatings(eligibility),
    feedsPointStatistics(eligibility),
    feedsRallyStatistics(eligibility),
  ];
}

describe(getTestFileName(import.meta.url), (): void => {
  describe('data eligibility (VIII.VII)', (): void => {
    it.each<[string, IGameEligibility, [boolean, boolean, boolean, boolean]]>([
      /* label, facts, [win-loss, ratings, points, rally] */
      ['a live-recorded game feeds everything', facts(), [true, true, true, true]],
      [
        'a retroactive game feeds everything but rally detail',
        facts({ isLiveRecorded: false }),
        [true, true, true, false],
      ],
      ['a walkover feeds win-loss only', facts({ status: EGameStatus.WALKOVER }), [true, false, false, false]],
      [
        'a retirement feeds win-loss, ratings, and the points played before it',
        facts({ status: EGameStatus.RETIRED }),
        [true, true, true, true],
      ],
      [
        'an unconfirmed game feeds nothing yet',
        facts({ confirmationStatus: EConfirmationStatus.UNCONFIRMED }),
        [false, false, false, false],
      ],
      [
        'a disputed game feeds nothing',
        facts({ confirmationStatus: EConfirmationStatus.DISPUTED }),
        [false, false, false, false],
      ],
      [
        'a game with a guest counts for everything except ratings',
        facts({ hasGuest: true }),
        [true, false, true, true],
      ],
      [
        'a league with rating switched off still records everything else',
        facts({ ratingEnabled: false }),
        [true, false, true, true],
      ],
      [
        'a per-game override can mark a game unrated without hiding it',
        facts({ isUnratedOverride: true }),
        [true, false, true, true],
      ],
      ['a no contest feeds nothing', facts({ status: EGameStatus.NO_CONTEST }), [false, false, false, false]],
      ['an abandoned game feeds nothing', facts({ status: EGameStatus.ABANDONED }), [false, false, false, false]],
      ['a void game feeds nothing', facts({ status: EGameStatus.VOID }), [false, false, false, false]],
      [
        'a game still in progress feeds nothing',
        facts({ status: EGameStatus.IN_PROGRESS }),
        [false, false, false, false],
      ],
    ])('%s', (_label, eligibility, expected): void => {
      expect(feeds(eligibility)).toEqual(expected);
    });

    it('never feeds rally statistics without feeding point statistics', (): void => {
      const combinations = [
        facts(),
        facts({ isLiveRecorded: false }),
        facts({ status: EGameStatus.WALKOVER }),
        facts({ confirmationStatus: EConfirmationStatus.DISPUTED }),
      ];

      for (const eligibility of combinations) {
        expect(feedsRallyStatistics(eligibility) && !feedsPointStatistics(eligibility)).toBe(false);
      }
    });
  });
});
