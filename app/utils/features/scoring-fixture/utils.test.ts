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
 * ███████████████████████████████████ #utils/features/scoring-fixture/utils.test.ts ███████████████████████████████████
 *
 * Unit tests for the Features scoring fixture; every assertion is a claim the illustration makes on the page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { SCORING_FIXTURE_FIRST_RECEIVER, SCORING_FIXTURE_FIRST_SERVER } from './constants';
import type { IScoringFixture, IScoringFixturePlayer } from './types';
import { buildScoringFixture, buildScoringFixtureEvents, scoreScoringFixturePoint } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The state the illustration labels itself with; every assertion below is a claim the diagram makes on the page
 * @internal
 * @constant
 */
const fixture: IScoringFixture = buildScoringFixture();

/* ─── Helpers ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The player holding service, according to the replayed log
 * @internal
 * @function
 * @returns The serving player's name, or undefined when the state names nobody
 */
function serving(): string | undefined {
  return fixture.players.find((player: IScoringFixturePlayer): boolean => player.isServing)?.name;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(buildScoringFixture), (): void => {
    it('reaches the second game, because the first was played out to a result', (): void => {
      expect(fixture.gameNumber).toBe(2);
    });

    it('stands level at ten apiece, one point short of the target for both players', (): void => {
      expect(fixture.players.map((player: IScoringFixturePlayer): number => player.score)).toEqual([10, 10]);
    });

    it('is at deuce, so service changes every point rather than every two', (): void => {
      expect(fixture.isDeuce).toBe(true);
    });

    /**
     * The claim the diagram would most easily get wrong by hand. The rotation swaps between games, so the player who
     * received first in game one opens game two; twenty points at a two-point interval is ten changes of service,
     * which is an even number, so the serve comes back round to them
     */
    it('returns service to the player who received first in game one', (): void => {
      expect(serving()).toBe(SCORING_FIXTURE_FIRST_RECEIVER);
    });

    it('does not leave service with the player who opened the match', (): void => {
      expect(serving()).not.toBe(SCORING_FIXTURE_FIRST_SERVER);
    });

    it('captions the rules the depicted match is played under', (): void => {
      expect(fixture.settingsCaption).toBe('singles · first to 11, win by 2 · best of 3');
    });

    it('describes the depicted state in a sentence, for the accessible description', (): void => {
      expect(fixture.description).toBe(
        'Singles, best of 3. Maya won game one 11-7. Game 2 stands at 10-10, which is deuce, so service changes ' +
          'every point instead of every 2. Maya is serving to Sam.',
      );
    });

    it('derives an awarded rally and the resulting change of service from the event log', (): void => {
      const events = scoreScoringFixturePoint(buildScoringFixtureEvents(), SCORING_FIXTURE_FIRST_RECEIVER);
      const afterPoint: IScoringFixture = buildScoringFixture(events);

      expect(afterPoint.players.map((player: IScoringFixturePlayer): number => player.score)).toEqual([11, 10]);
      expect(afterPoint.players.find((player: IScoringFixturePlayer): boolean => player.isServing)?.name).toBe(
        SCORING_FIXTURE_FIRST_SERVER,
      );
    });

    it('stops accepting rallies after the demo reaches a match result', (): void => {
      const afterFirst = scoreScoringFixturePoint(buildScoringFixtureEvents(), SCORING_FIXTURE_FIRST_RECEIVER);
      const completedEvents = scoreScoringFixturePoint(afterFirst, SCORING_FIXTURE_FIRST_RECEIVER);
      const completed: IScoringFixture = buildScoringFixture(completedEvents);

      expect(completed.isComplete).toBe(true);
      expect(completed.winner).toBe(SCORING_FIXTURE_FIRST_RECEIVER);
      expect(completed.players.map((player: IScoringFixturePlayer): number => player.gamesWon)).toEqual([2, 0]);
      expect(completed.players.some((player: IScoringFixturePlayer): boolean => player.isServing)).toBe(false);
      expect(scoreScoringFixturePoint(completedEvents, SCORING_FIXTURE_FIRST_SERVER)).toBe(completedEvents);
    });

    it('starts a deciding game when the other player takes game two', (): void => {
      const afterFirst = scoreScoringFixturePoint(buildScoringFixtureEvents(), SCORING_FIXTURE_FIRST_SERVER);
      const afterSecond = scoreScoringFixturePoint(afterFirst, SCORING_FIXTURE_FIRST_SERVER);
      const decidingGame: IScoringFixture = buildScoringFixture(afterSecond);

      expect(decidingGame.gameNumber).toBe(3);
      expect(decidingGame.players.map((player: IScoringFixturePlayer): number => player.gamesWon)).toEqual([1, 1]);
      expect(decidingGame.players.map((player: IScoringFixturePlayer): number => player.score)).toEqual([0, 0]);
    });
  });
});
