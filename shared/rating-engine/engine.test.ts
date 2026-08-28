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
 * ███████████████████████████████████████ #shared/rating-engine/engine.test.ts ████████████████████████████████████████
 *
 * Unit tests for the rating engine: the Elo primitives, all three game types, provisional status, and recomputation.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { ConfirmationStatus, GameStatus, ParticipantOutcome, RatingScope } from '#shared/domain';
import { GameType, Side } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import { ELEVATED_K_FACTOR, ESTABLISHED_K_FACTOR, PROVISIONAL_K_FACTOR, STARTING_RATING } from './constants';
import { expectedScore, kFactor, rateGame, replayRatings } from './engine';
import type { IGameEligibility, IRatableGame, IRatedParticipant, IRateGameInput } from './types';

/**
 * An established player on the opening rating, so a test states only what it varies
 * @internal
 * @function
 * @param participantId - The player's identifier
 * @param score - Their final score
 * @param overrides - Anything else to vary
 * @returns A rated participant
 */
function player(participantId: string, score: number, overrides: Partial<IRatedParticipant> = {}): IRatedParticipant {
  return {
    participantId,
    score,
    rating: STARTING_RATING,
    gamesPlayed: 50,
    ...overrides,
  };
}

/**
 * A singles or doubles game under standard settings
 * @internal
 * @function
 * @param gameType - Which format
 * @param participants - The players
 * @returns A rateable input
 */
function gameOf(gameType: GameType, participants: IRatedParticipant[]): IRateGameInput {
  return {
    gameType,
    participants,
    winningMargin: 2,
    provisionalGames: 10,
  };
}

/**
 * The delta one player took from a game
 * @internal
 * @function
 * @param input - The game
 * @param participantId - The player to read
 * @returns Their rating change
 */
function deltaFor(input: IRateGameInput, participantId: string): number {
  return rateGame(input).find((change) => change.participantId === participantId)!.delta;
}

/**
 * A settled, rated, live-recorded game
 * @internal
 * @function
 * @param overrides - Anything to vary
 * @returns Eligibility facts
 */
function eligibility(overrides: Partial<IGameEligibility> = {}): IGameEligibility {
  return {
    status: GameStatus.COMPLETE,
    confirmationStatus: ConfirmationStatus.CONFIRMED,
    hasGuest: false,
    ratingEnabled: true,
    isLiveRecorded: true,
    ...overrides,
  };
}

describe(getTestFileName(import.meta.url), (): void => {
  /* ═══ Elo Primitives — VIII.II ═════════════════════════════════════════════════════════════════════════════════ */

  describe('elo primitives', (): void => {
    it('expects an even contest between equal ratings', (): void => {
      expect(expectedScore(1200, 1200)).toBe(0.5);
    });

    it('gives a four-hundred point favourite roughly ten-to-one odds', (): void => {
      expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 4);
    });

    it('is symmetric; the two expectations always sum to one', (): void => {
      expect(expectedScore(1450, 1180) + expectedScore(1180, 1450)).toBeCloseTo(1, 10);
    });

    it.each([
      ['provisional', 1200, 3, PROVISIONAL_K_FACTOR],
      ['established below the threshold', 1200, 10, ESTABLISHED_K_FACTOR],
      ['established at the threshold', 2100, 10, ELEVATED_K_FACTOR],
      ['established above the threshold', 2400, 99, ELEVATED_K_FACTOR],
    ])('uses the %s k-factor (VIII.I)', (_label, rating, gamesPlayed, expected): void => {
      expect(kFactor(rating, gamesPlayed, 10)).toBe(expected);
    });
  });

  /* ═══ Singles — VIII.II ════════════════════════════════════════════════════════════════════════════════════════ */

  describe(symbolName(rateGame), (): void => {
    describe('singles', (): void => {
      it('behaves exactly like plain elo at the minimum winning margin (VIII.II)', (): void => {
        const input = gameOf(GameType.SINGLES, [
          player('winner', 11, { side: Side.A }),
          player('loser', 9, { side: Side.B }),
        ]);

        /* Equal ratings, so the expectation is a half and the exchange is half the base K */
        expect(deltaFor(input, 'winner')).toBeCloseTo(ESTABLISHED_K_FACTOR * 0.5, 10);
        expect(deltaFor(input, 'loser')).toBeCloseTo(-ESTABLISHED_K_FACTOR * 0.5, 10);
      });

      it('moves ratings further on a wider margin (VIII.II)', (): void => {
        const narrow = gameOf(GameType.SINGLES, [
          player('winner', 11, { side: Side.A }),
          player('loser', 9, { side: Side.B }),
        ]);
        const wide = gameOf(GameType.SINGLES, [
          player('winner', 11, { side: Side.A }),
          player('loser', 3, { side: Side.B }),
        ]);

        expect(deltaFor(wide, 'winner')).toBeGreaterThan(deltaFor(narrow, 'winner'));
      });

      it('damps the margin bonus as the winner’s rating advantage grows (VIII.II)', (): void => {
        const evenlyMatched = gameOf(GameType.SINGLES, [
          player('winner', 11, { side: Side.A }),
          player('loser', 3, { side: Side.B }),
        ]);
        const runningItUp = gameOf(GameType.SINGLES, [
          player('winner', 11, { side: Side.A, rating: 1800 }),
          player('loser', 3, { side: Side.B, rating: 1200 }),
        ]);
        const favouriteMultiplier =
          deltaFor(runningItUp, 'winner') / (1 - expectedScore(1800, 1200)) / ESTABLISHED_K_FACTOR;
        const evenMultiplier = deltaFor(evenlyMatched, 'winner') / 0.5 / ESTABLISHED_K_FACTOR;

        expect(favouriteMultiplier).toBeLessThan(evenMultiplier);
      });

      it('never moves a rating by more than twice the base k (VIII.II)', (): void => {
        const blowout = gameOf(GameType.SINGLES, [
          player('winner', 21, { side: Side.A, rating: 1000 }),
          player('loser', 0, { side: Side.B, rating: 1900 }),
        ]);

        expect(Math.abs(deltaFor(blowout, 'winner'))).toBeLessThanOrEqual(ESTABLISHED_K_FACTOR * 2);
      });

      it('keeps the exchange zero-sum when both players share a k tier (VIII.II)', (): void => {
        const input = gameOf(GameType.SINGLES, [
          player('winner', 11, { side: Side.A, rating: 1340 }),
          player('loser', 4, { side: Side.B, rating: 1105 }),
        ]);
        const total = rateGame(input).reduce((sum, change) => sum + change.delta, 0);

        expect(total).toBeCloseTo(0, 10);
      });

      it('rewards an underdog more than a favourite for the same win (VIII.II)', (): void => {
        const underdog = gameOf(GameType.SINGLES, [
          player('winner', 11, { side: Side.A, rating: 1000 }),
          player('loser', 6, { side: Side.B, rating: 1500 }),
        ]);
        const favourite = gameOf(GameType.SINGLES, [
          player('winner', 11, { side: Side.A, rating: 1500 }),
          player('loser', 6, { side: Side.B, rating: 1000 }),
        ]);

        expect(deltaFor(underdog, 'winner')).toBeGreaterThan(deltaFor(favourite, 'winner'));
      });

      /* ─── The spec bug this ticket fixes ───────────────────────────────────────────────────────────────────────── */

      it('still moves ratings when a retirement leaves no winning margin (VIII.VII)', (): void => {
        /* Taken literally the multiplier is log(1)/log(3) = 0 here, which would move nobody */
        const retiredLevel = gameOf(GameType.SINGLES, [
          player('stayed', 5, { side: Side.A, outcome: ParticipantOutcome.WIN }),
          player('withdrew', 5, { side: Side.B, outcome: ParticipantOutcome.LOSS }),
        ]);

        expect(deltaFor(retiredLevel, 'stayed')).toBeCloseTo(ESTABLISHED_K_FACTOR * 0.5, 10);
        expect(deltaFor(retiredLevel, 'withdrew')).toBeCloseTo(-ESTABLISHED_K_FACTOR * 0.5, 10);
      });

      it('credits the side that stayed even when the retiring player was ahead (III.II.X.II)', (): void => {
        const input = gameOf(GameType.SINGLES, [
          player('stayed', 3, { side: Side.A, outcome: ParticipantOutcome.WIN }),
          player('withdrew', 9, { side: Side.B, outcome: ParticipantOutcome.LOSS }),
        ]);

        expect(deltaFor(input, 'stayed')).toBeGreaterThan(0);
        expect(deltaFor(input, 'withdrew')).toBeLessThan(0);
      });

      it('refuses a field that does not match the game type', (): void => {
        expect(() => rateGame(gameOf(GameType.SINGLES, [player('solo', 11, { side: Side.A })]))).toThrow(
          /needs 2 players/,
        );
      });

      it('refuses a field stacked entirely on one side', (): void => {
        expect(() =>
          rateGame(
            gameOf(GameType.DOUBLES, [
              player('a1', 11, { side: Side.A }),
              player('a2', 11, { side: Side.A }),
              player('a3', 9, { side: Side.A }),
              player('a4', 9, { side: Side.A }),
            ]),
          ),
        ).toThrow(/players on both sides/);
      });

      it('refuses a player with no side', (): void => {
        expect(() => rateGame(gameOf(GameType.SINGLES, [player('a', 11, { side: Side.A }), player('b', 9)]))).toThrow(
          /has no side/,
        );
      });
    });

    /* ═══ Doubles — VIII.III ═════════════════════════════════════════════════════════════════════════════════════ */

    describe('doubles', (): void => {
      it('rates each player against the mean of the opposing pair (VIII.III)', (): void => {
        const paired = gameOf(GameType.DOUBLES, [
          player('a1', 11, { side: Side.A, rating: 1200 }),
          player('a2', 11, { side: Side.A, rating: 1200 }),
          player('b1', 9, { side: Side.B, rating: 1000 }),
          player('b2', 9, { side: Side.B, rating: 1400 }),
        ]);

        /* The opposing pair averages 1200, so this is an even contest despite neither opponent being rated 1200 */
        expect(deltaFor(paired, 'a1')).toBeCloseTo(ESTABLISHED_K_FACTOR * 0.5, 10);
      });

      it('gives both partners the full delta rather than a weighted share (VIII.III)', (): void => {
        const input = gameOf(GameType.DOUBLES, [
          player('strong', 11, { side: Side.A, rating: 1600 }),
          player('weak', 11, { side: Side.A, rating: 1000 }),
          player('b1', 8, { side: Side.B }),
          player('b2', 8, { side: Side.B }),
        ]);

        expect(deltaFor(input, 'strong')).toBeCloseTo(deltaFor(input, 'weak'), 10);
      });

      it('costs a strong player heavily for losing alongside a weak partner (VIII.III)', (): void => {
        const carried = gameOf(GameType.DOUBLES, [
          player('strong', 8, { side: Side.A, rating: 1600 }),
          player('weak', 8, { side: Side.A, rating: 1000 }),
          player('b1', 11, { side: Side.B }),
          player('b2', 11, { side: Side.B }),
        ]);

        /* The pair averages 1300 against 1200, so the loss is an upset and both partners wear it in full */
        expect(deltaFor(carried, 'strong')).toBeLessThan(-ESTABLISHED_K_FACTOR * 0.5);
      });
    });

    /* ═══ Cutthroat — VIII.IV ════════════════════════════════════════════════════════════════════════════════════ */

    describe('cutthroat', (): void => {
      it('rates on finishing order and ignores the margin entirely (VIII.IV)', (): void => {
        const narrow = gameOf(GameType.CUTTHROAT, [player('first', 7), player('second', 6), player('third', 5)]);
        const wide = gameOf(GameType.CUTTHROAT, [player('first', 7), player('second', 1), player('third', 0)]);

        expect(deltaFor(narrow, 'first')).toBeCloseTo(deltaFor(wide, 'first'), 10);
      });

      it('carries roughly one singles game of volatility, not two (VIII.IV)', (): void => {
        const input = gameOf(GameType.CUTTHROAT, [player('first', 7), player('second', 4), player('third', 2)]);

        /* Two comparisons, each at half K, both won against equal ratings */
        expect(deltaFor(input, 'first')).toBeCloseTo(ESTABLISHED_K_FACTOR * 0.5, 10);
      });

      it('leaves the middle finisher roughly level between equals (VIII.IV)', (): void => {
        const input = gameOf(GameType.CUTTHROAT, [player('first', 7), player('second', 4), player('third', 2)]);

        expect(deltaFor(input, 'second')).toBeCloseTo(0, 10);
        expect(deltaFor(input, 'third')).toBeCloseTo(-ESTABLISHED_K_FACTOR * 0.5, 10);
      });

      it('splits the comparison when two players share a score (VIII.IV)', (): void => {
        const input = gameOf(GameType.CUTTHROAT, [player('first', 7), player('tiedA', 4), player('tiedB', 4)]);

        expect(deltaFor(input, 'tiedA')).toBeCloseTo(deltaFor(input, 'tiedB'), 10);
      });

      it('is zero-sum across the three players when they share a k tier', (): void => {
        const input = gameOf(GameType.CUTTHROAT, [
          player('first', 7, { rating: 1310 }),
          player('second', 5, { rating: 1190 }),
          player('third', 2, { rating: 1255 }),
        ]);
        const total = rateGame(input).reduce((sum, change) => sum + change.delta, 0);

        expect(total).toBeCloseTo(0, 10);
      });

      it('refuses a field that is not three players', (): void => {
        expect(() => rateGame(gameOf(GameType.CUTTHROAT, [player('a', 7), player('b', 4)]))).toThrow(/needs 3 players/);
      });
    });

    /* ═══ Provisional Status — VIII.I ════════════════════════════════════════════════════════════════════════════ */

    describe('provisional status', (): void => {
      it('moves a provisional rating faster than an established one (VIII.I)', (): void => {
        const provisional = gameOf(GameType.SINGLES, [
          player('newcomer', 11, { side: Side.A, gamesPlayed: 0 }),
          player('regular', 9, { side: Side.B }),
        ]);

        expect(deltaFor(provisional, 'newcomer')).toBeCloseTo(PROVISIONAL_K_FACTOR * 0.5, 10);
        expect(deltaFor(provisional, 'regular')).toBeCloseTo(-ESTABLISHED_K_FACTOR * 0.5, 10);
      });

      it('leaves provisional status on the game that reaches the threshold (VIII.I)', (): void => {
        const [newcomer] = rateGame(
          gameOf(GameType.SINGLES, [
            player('newcomer', 11, { side: Side.A, gamesPlayed: 9 }),
            player('regular', 9, { side: Side.B }),
          ]),
        );

        expect(newcomer!.gamesPlayed).toBe(10);
        expect(newcomer!.isProvisional).toBe(false);
      });
    });
  });

  /* ═══ Recomputation — VIII.VIII ════════════════════════════════════════════════════════════════════════════════ */

  describe(symbolName(replayRatings), (): void => {
    /**
     * A rateable singles game between two named players
     * @internal
     * @function
     * @param gameId - The game's identifier
     * @param winnerId - Who won
     * @param loserId - Who lost
     * @param overrides - Eligibility to vary
     * @returns A rateable game
     */
    const singlesGame = (
      gameId: string,
      winnerId: string,
      loserId: string,
      overrides: Partial<IGameEligibility> = {},
    ): IRatableGame => ({
      gameId,
      gameType: GameType.SINGLES,
      winningMargin: 2,
      provisionalGames: 10,
      eligibility: eligibility(overrides),
      participants: [
        {
          participantId: winnerId,
          score: 11,
          rating: 0,
          gamesPlayed: 0,
          side: Side.A,
        },
        {
          participantId: loserId,
          score: 6,
          rating: 0,
          gamesPlayed: 0,
          side: Side.B,
        },
      ],
    });

    it('starts everyone on the opening rating', (): void => {
      const [first] = replayRatings([singlesGame('g1', 'ada', 'bo')], RatingScope.OVERALL);

      expect(first!.ratingBefore).toBe(STARTING_RATING);
      expect(first!.scope).toBe(RatingScope.OVERALL);
      expect(first!.gameId).toBe('g1');
    });

    it('carries a rating forward from one game to the next', (): void => {
      const drafts = replayRatings(
        [singlesGame('g1', 'ada', 'bo'), singlesGame('g2', 'ada', 'bo')],
        RatingScope.OVERALL,
      );
      const adaFirst = drafts.find((draft) => draft.gameId === 'g1' && draft.participantId === 'ada')!;
      const adaSecond = drafts.find((draft) => draft.gameId === 'g2' && draft.participantId === 'ada')!;

      expect(adaSecond.ratingBefore).toBe(adaFirst.ratingAfter);
      expect(adaSecond.gamesPlayed).toBe(2);
    });

    it('produces identical output for identical input, so recomputation is reproducible (VIII.VIII)', (): void => {
      const games = [singlesGame('g1', 'ada', 'bo'), singlesGame('g2', 'bo', 'cy'), singlesGame('g3', 'cy', 'ada')];

      expect(replayRatings(games, RatingScope.OVERALL)).toEqual(replayRatings(games, RatingScope.OVERALL));
    });

    it('is path-dependent; reordering the same games gives a different answer (VIII.VIII)', (): void => {
      const games = [singlesGame('g1', 'ada', 'bo'), singlesGame('g2', 'bo', 'cy'), singlesGame('g3', 'cy', 'ada')];
      const reversed = [...games].reverse();

      expect(replayRatings(games, RatingScope.OVERALL)).not.toEqual(replayRatings(reversed, RatingScope.OVERALL));
    });

    it('resumes from a seed, which is how a rebuild starts partway through a history', (): void => {
      const seed = new Map([['ada', { rating: 1400, gamesPlayed: 20 }]]);
      const [first] = replayRatings([singlesGame('g1', 'ada', 'bo')], RatingScope.OVERALL, seed);

      expect(first!.ratingBefore).toBe(1400);
      expect(first!.gamesPlayed).toBe(21);
    });

    it('skips a game that feeds nothing, without consuming a rating or a games-played count', (): void => {
      const drafts = replayRatings(
        [
          singlesGame('g1', 'ada', 'bo', { confirmationStatus: ConfirmationStatus.UNCONFIRMED }),
          singlesGame('g2', 'ada', 'bo'),
        ],
        RatingScope.OVERALL,
      );

      expect(drafts.map((draft) => draft.gameId)).toEqual(['g2', 'g2']);
      expect(drafts[0]!.ratingBefore).toBe(STARTING_RATING);
      expect(drafts[0]!.gamesPlayed).toBe(1);
    });
  });
});
