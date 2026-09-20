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
 * ████████████████████████████████████████ #shared/results/reconstruct.test.ts ████████████████████████████████████████
 *
 * Unit tests for the reconstruction builder and every score it must refuse.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import type { IMatchSettings, TMatchEvent } from '#shared/rules-engine';
import { EventType, GameType, MatchStatus, replayMatch, Side } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import { ResultEnding, Seat } from './enums';
import { reconstructResult } from './reconstruct';
import type { IGameScoreRow, IReconstruction, IResultSeat, IResultSubmission } from './types';

/**
 * Standard scoring rules, varied per case
 * @internal
 * @function
 * @param overrides - What this case changes
 * @returns The frozen settings
 */
function settingsOf(overrides: Partial<IMatchSettings> = {}): IMatchSettings {
  return {
    cutthroatTimeCap: 0,
    expediteEnabled: false,
    gameType: GameType.SINGLES,
    matchFormat: 1,
    serviceInterval: 2,
    targetScore: 11,
    winningMargin: 2,
    ...overrides,
  };
}

/**
 * The seats a format fills, all held by members
 * @internal
 * @function
 * @param gameType - Which format
 * @returns The seats
 */
function seatsOf(gameType: GameType): IResultSeat[] {
  const seats: Seat[] = gameType === GameType.DOUBLES ? [Seat.A1, Seat.B1, Seat.A2, Seat.B2] : [Seat.A1, Seat.B1];

  return seats.map((seat: Seat): IResultSeat => ({
    guestName: null,
    seat,
    userId: `user-${seat}`,
  }));
}

/**
 * A submission built from scores alone
 * @internal
 * @function
 * @param rows - The per-game scores, as `[a, b]` pairs
 * @param overrides - What this case changes
 * @returns The submission
 */
function submissionOf(rows: [number, number][], overrides: Partial<IResultSubmission> = {}): IResultSubmission {
  const gameType: GameType = overrides.gameType ?? GameType.SINGLES;

  return {
    ending: ResultEnding.COMPLETED,
    gameType,
    games: rows.map(([a, b], index): IGameScoreRow => ({
      a,
      b,
      gameNumber: index + 1,
    })),
    playedAt: '2026-09-19T18:00:00.000Z',
    retiredSeat: null,
    seats: seatsOf(gameType),
    ...overrides,
  };
}

/**
 * Concatenates a reconstruction back into the one log the match-level adapter replays
 * @internal
 * @function
 * @param built - The reconstruction
 * @returns Every event, in order
 */
function wholeLog(built: IReconstruction): TMatchEvent[] {
  return built.games.flatMap((game): TMatchEvent[] => game.events);
}

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(reconstructResult), (): void => {
    it('reaches the entered score and ends the game exactly on its last point', (): void => {
      const built: IReconstruction = reconstructResult(settingsOf(), submissionOf([[11, 7]]));
      const log: TMatchEvent[] = wholeLog(built);

      expect(log[0]).toEqual({ rotation: [Seat.A1, Seat.B1], type: EventType.MATCH_INIT });
      expect(log).toHaveLength(19);
      expect(replayMatch(settingsOf(), log)).toMatchObject({ isComplete: true, winner: Side.A });
      expect(replayMatch(settingsOf(), log.slice(0, -1))).toMatchObject({ isComplete: false, scores: { A: 10, B: 7 } });
      expect(built.games[0]).toMatchObject({
        gameNumber: 1,
        isComplete: true,
        scores: { A: 11, B: 7 },
        winner: Side.A,
      });
    });

    it('carries a deuce past the target without ending the game early', (): void => {
      const built: IReconstruction = reconstructResult(settingsOf(), submissionOf([[15, 13]]));

      expect(wholeLog(built)).toHaveLength(29);
      expect(replayMatch(settingsOf(), wholeLog(built))).toMatchObject({ isComplete: true, winner: Side.A });
    });

    it('never lets a prefix of a game reach a result before its last point', (): void => {
      const settings: IMatchSettings = settingsOf();
      const log: TMatchEvent[] = wholeLog(reconstructResult(settings, submissionOf([[12, 10]])));

      log.slice(1, -1).forEach((_event: TMatchEvent, index: number): void => {
        expect(replayMatch(settings, log.slice(0, index + 2)).isComplete).toBe(false);
      });
    });

    it('splits a best-of-three by game and keeps each game’s own winner', (): void => {
      const settings: IMatchSettings = settingsOf({ matchFormat: 3 });
      const built: IReconstruction = reconstructResult(
        settings,
        submissionOf([
          [11, 4],
          [9, 11],
          [11, 8],
        ]),
      );

      expect(built.games.map((game): Side | null => game.winner)).toEqual([Side.A, Side.B, Side.A]);
      expect(built.games.map((game): number => game.events.length)).toEqual([16, 20, 19]);
      expect(replayMatch(settings, wholeLog(built))).toMatchObject({ gamesWon: { A: 2, B: 1 }, isComplete: true });
    });

    it('rotates doubles service through all four seats', (): void => {
      const settings: IMatchSettings = settingsOf({ gameType: GameType.DOUBLES });
      const built: IReconstruction = reconstructResult(
        settings,
        submissionOf([[11, 9]], { gameType: GameType.DOUBLES }),
      );
      const log: TMatchEvent[] = wholeLog(built);
      const servers: Set<string> = new Set(
        log.map((_event: TMatchEvent, index: number): string => replayMatch(settings, log.slice(0, index + 1)).server),
      );

      expect(log[0]).toEqual({ rotation: [Seat.A1, Seat.B1, Seat.A2, Seat.B2], type: EventType.MATCH_INIT });
      expect(servers).toEqual(new Set([Seat.A1, Seat.B1, Seat.A2, Seat.B2]));
    });

    it('records a first-game retirement at nil-all as one unfinished game', (): void => {
      const settings: IMatchSettings = settingsOf({ matchFormat: 7 });
      const built: IReconstruction = reconstructResult(
        settings,
        submissionOf([[0, 0]], { ending: ResultEnding.RETIRED, retiredSeat: Seat.A1 }),
      );

      expect(built.games).toHaveLength(1);
      expect(built.games[0]).toMatchObject({
        isComplete: false,
        scores: { A: 0, B: 0 },
        winner: Side.B,
      });
      expect(built.isComplete).toBe(false);
      expect(replayMatch(settings, wholeLog(built))).toMatchObject({ status: MatchStatus.RETIRED, winner: Side.B });
    });

    it('credits a retirement to the side that stayed, whatever the scoreboard said', (): void => {
      const settings: IMatchSettings = settingsOf({ matchFormat: 3 });
      const built: IReconstruction = reconstructResult(
        settings,
        submissionOf(
          [
            [11, 5],
            [3, 6],
          ],
          { ending: ResultEnding.RETIRED, retiredSeat: Seat.B1 },
        ),
      );

      expect(built.games.map((game): Side | null => game.winner)).toEqual([Side.A, Side.A]);
      expect(built.winner).toBe(Side.A);
    });

    it('refuses a score no legal rally order reaches', (): void => {
      expect((): IReconstruction => reconstructResult(settingsOf(), submissionOf([[13, 5]]))).toThrow(
        /No legal ordering/u,
      );
    });

    it('refuses a game that stops short of the winning margin', (): void => {
      expect((): IReconstruction => reconstructResult(settingsOf(), submissionOf([[11, 10]]))).toThrow(
        /not a finished game/u,
      );
    });

    it('refuses a game recorded after the match was already decided', (): void => {
      expect((): IReconstruction =>
        reconstructResult(
          settingsOf({ matchFormat: 3 }),
          submissionOf([
            [11, 4],
            [11, 6],
            [11, 8],
          ]),
        ),
      ).toThrow(/later games cannot exist/u);
    });

    it('refuses more games than the frozen format allows', (): void => {
      expect((): IReconstruction =>
        reconstructResult(
          settingsOf({ matchFormat: 1 }),
          submissionOf([
            [11, 4],
            [11, 6],
          ]),
        ),
      ).toThrow(/best-of-1/u);
    });

    it('refuses a completed match that nobody won', (): void => {
      expect((): IReconstruction => reconstructResult(settingsOf({ matchFormat: 3 }), submissionOf([[11, 4]]))).toThrow(
        /do not decide the match/u,
      );
    });

    it('holds at a configured margin and target other than the standard pair', (): void => {
      const settings: IMatchSettings = settingsOf({ targetScore: 21, winningMargin: 1 });
      const built: IReconstruction = reconstructResult(settings, submissionOf([[21, 20]]));

      expect(replayMatch(settings, wholeLog(built))).toMatchObject({ isComplete: true, winner: Side.A });
    });

    it('refuses a format that has no final-score form', (): void => {
      expect((): IReconstruction =>
        reconstructResult(
          settingsOf({ gameType: GameType.CUTTHROAT }),
          submissionOf([[11, 4]], { gameType: GameType.CUTTHROAT }),
        ),
      ).toThrow(/cannot be entered as a final score/u);
    });
  });
});
