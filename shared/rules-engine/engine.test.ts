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
 * ████████████████████████████████████████ #shared/rules-engine/engine.test.ts ████████████████████████████████████████
 *
 * Unit tests for the rules engine. The rule list in spec III.II is the corpus; every rule with a scoring or ordering
 * consequence has a case here.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { DEFAULT_SERVICE_INTERVAL, DEFAULT_WINNING_MARGIN } from './constants';
import { replayMatch } from './engine';
import { EventType, GameType, MatchStatus, RallyWinner, Side } from './enums';
import type { IMatchSettings, IMatchState, TMatchEvent } from './types';

/**
 * Builds a settings snapshot, defaulting to standard singles
 * @internal
 * @function
 * @param overrides - Fields to override
 * @returns A settings snapshot
 */
function settingsFor(overrides: Partial<IMatchSettings> = {}): IMatchSettings {
  return {
    gameType: GameType.SINGLES,
    targetScore: 11,
    winningMargin: DEFAULT_WINNING_MARGIN,
    serviceInterval: DEFAULT_SERVICE_INTERVAL,
    matchFormat: 1,
    cutthroatTimeCap: 0,
    expediteEnabled: false,
    ...overrides,
  };
}

/**
 * Opens a log with its MATCH_INIT event
 * @internal
 * @function
 * @param rotation - Participant ids in service order
 * @returns A one-event log
 */
function opening(rotation: string[]): TMatchEvent[] {
  return [{ type: EventType.MATCH_INIT, rotation }];
}

/**
 * Plays out a sequence of side wins, translating each into the RALLY event that produces it. Tests read in terms of who
 * scored rather than who was serving, which is how the rules are written
 * @internal
 * @function
 * @param settings - The settings snapshot
 * @param rotation - The opening rotation
 * @param winners - The side that wins each successive rally
 * @returns The resulting log and the state after it
 */
function playSides(
  settings: IMatchSettings,
  rotation: string[],
  winners: Side[],
): { events: TMatchEvent[]; state: IMatchState } {
  const sides: Record<string, Side> = Object.fromEntries(
    rotation.map((participant, index) => [participant, index % 2 === 0 ? Side.A : Side.B]),
  );
  const events = opening(rotation);

  for (const side of winners) {
    const current = replayMatch(settings, events);

    if (current.isComplete) {
      break;
    }

    events.push({
      type: EventType.RALLY,
      wonBy: sides[current.server] === side ? RallyWinner.SERVING : RallyWinner.RECEIVING,
    });
  }

  return { events, state: replayMatch(settings, events) };
}

/**
 * A run of rallies all won by the same side
 * @internal
 * @function
 * @param side - The winning side
 * @param count - How many rallies
 * @returns The side repeated
 */
function run(side: Side, count: number): Side[] {
  return Array.from({ length: count }, () => side);
}

/**
 * Alternating side wins, which drives a game to deuce
 * @internal
 * @function
 * @param count - How many rallies
 * @returns Alternating sides, starting with A
 */
function alternating(count: number): Side[] {
  return Array.from({ length: count }, (_unused, index) => (index % 2 === 0 ? Side.A : Side.B));
}

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(replayMatch), (): void => {
    /* ═══ Log Structure ══════════════════════════════════════════════════════════════════════════════════════════ */

    describe('log structure', (): void => {
      it('refuses a log that does not open with MATCH_INIT', (): void => {
        expect(() => replayMatch(settingsFor(), [{ type: EventType.LET }])).toThrow(/must open with a MATCH_INIT/);
      });

      it('refuses a rotation whose size does not match the game type', (): void => {
        expect(() => replayMatch(settingsFor(), opening(['p1', 'p2', 'p3']))).toThrow(/needs a rotation of 2/);
      });

      it('refuses a rotation listing the same participant twice', (): void => {
        expect(() => replayMatch(settingsFor(), opening(['p1', 'p1']))).toThrow(/same participant twice/);
      });

      it('refuses a second MATCH_INIT event', (): void => {
        expect(() =>
          replayMatch(settingsFor(), [
            ...opening(['p1', 'p2']),
            { type: EventType.MATCH_INIT, rotation: ['p1', 'p2'] },
          ]),
        ).toThrow(/only contain one MATCH_INIT/);
      });

      it('refuses an event appended after the match is decided', (): void => {
        const { events } = playSides(settingsFor(), ['p1', 'p2'], run(Side.A, 11));

        expect(() => replayMatch(settingsFor(), [...events, { type: EventType.LET }])).toThrow(
          /cannot follow a completed match/,
        );
      });

      it('replays deterministically; the same log always yields the same state', (): void => {
        const { events } = playSides(settingsFor(), ['p1', 'p2'], alternating(15));

        expect(replayMatch(settingsFor(), events)).toEqual(replayMatch(settingsFor(), events));
      });
    });

    /* ═══ Scoring — III.II.I ═════════════════════════════════════════════════════════════════════════════════════ */

    describe('scoring', (): void => {
      it.each([11, 15, 21])('plays a singles game to a target of %i (III.II.I.I)', (targetScore): void => {
        const settings = settingsFor({ targetScore });
        const { state } = playSides(settings, ['p1', 'p2'], run(Side.A, targetScore));

        expect(state.isComplete).toBe(true);
        expect(state.winner).toBe(Side.A);
      });

      it('does not end a game on the target score without a two-point lead (III.II.I.II)', (): void => {
        const settings = settingsFor();
        /* Alternate to 10-10, then a single point makes it 11-10 */
        const { state } = playSides(settings, ['p1', 'p2'], [...alternating(20), Side.A]);

        expect(state.scores).toEqual({ [Side.A]: 11, [Side.B]: 10 });
        expect(state.isComplete).toBe(false);
      });

      it('ends a game once the margin is reached beyond the target (III.II.I.II)', (): void => {
        const settings = settingsFor();
        const { state } = playSides(settings, ['p1', 'p2'], [...alternating(20), Side.A, Side.A]);

        expect(state.scores).toEqual({ [Side.A]: 12, [Side.B]: 10 });
        expect(state.isComplete).toBe(true);
        expect(state.winner).toBe(Side.A);
      });

      it('awards a point to the receiving side too, since scoring is by rally (III.II.I.III)', (): void => {
        const settings = settingsFor();
        const state = replayMatch(settings, [
          ...opening(['p1', 'p2']),
          { type: EventType.RALLY, wonBy: RallyWinner.RECEIVING },
        ]);

        expect(state.scores).toEqual({ [Side.A]: 0, [Side.B]: 1 });
      });
    });

    /* ═══ Service and Ends — III.II.VII ══════════════════════════════════════════════════════════════════════════ */

    describe('service and ends', (): void => {
      it('changes service every two points by default (III.II.VII.II)', (): void => {
        const settings = settingsFor();
        const rotation = ['p1', 'p2'];

        expect(replayMatch(settings, opening(rotation)).server).toBe('p1');
        expect(playSides(settings, rotation, run(Side.A, 1)).state.server).toBe('p1');
        expect(playSides(settings, rotation, run(Side.A, 2)).state.server).toBe('p2');
        expect(playSides(settings, rotation, run(Side.A, 4)).state.server).toBe('p1');
      });

      it('honours a league-configured service interval (IV.II)', (): void => {
        const settings = settingsFor({ serviceInterval: 5, targetScore: 21 });
        const rotation = ['p1', 'p2'];

        expect(playSides(settings, rotation, run(Side.A, 4)).state.server).toBe('p1');
        expect(playSides(settings, rotation, run(Side.A, 5)).state.server).toBe('p2');
      });

      it('alternates service every point once both sides reach one below the target (III.II.VII.III)', (): void => {
        const settings = settingsFor();
        const rotation = ['p1', 'p2'];
        const atDeuce = playSides(settings, rotation, alternating(20));

        expect(atDeuce.state.isDeuce).toBe(true);

        const serverAtDeuce = atDeuce.state.server;
        const afterOne = playSides(settings, rotation, [...alternating(20), Side.A]);

        expect(afterOne.state.server).not.toBe(serverAtDeuce);
      });

      it('changes ends between games (III.II.VII.IV)', (): void => {
        const settings = settingsFor({ matchFormat: 3 });
        const opened = replayMatch(settings, opening(['p1', 'p2']));
        const { state } = playSides(settings, ['p1', 'p2'], run(Side.A, 11));

        expect(state.gameNumber).toBe(2);
        expect(state.ends).not.toEqual(opened.ends);
      });

      it('gives the previous game’s receiver the first service of the next (III.II.VII.VI)', (): void => {
        const settings = settingsFor({ matchFormat: 3 });
        const { state } = playSides(settings, ['p1', 'p2'], run(Side.A, 11));

        expect(state.server).toBe('p2');
      });

      it('changes ends at half the target in the deciding game (III.II.VII.V)', (): void => {
        const settings = settingsFor({ matchFormat: 3 });
        /* Take game one for A and game two for B, which makes game three the decider */
        const decider = [...run(Side.A, 11), ...run(Side.B, 11)];
        const beforeThreshold = playSides(settings, ['p1', 'p2'], [...decider, ...run(Side.A, 4)]);
        const atThreshold = playSides(settings, ['p1', 'p2'], [...decider, ...run(Side.A, 5)]);

        expect(beforeThreshold.state.gameNumber).toBe(3);
        expect(atThreshold.state.gameNumber).toBe(3);
        expect(atThreshold.state.ends).not.toEqual(beforeThreshold.state.ends);
      });

      it('changes ends only once in the deciding game', (): void => {
        const settings = settingsFor({ matchFormat: 3 });
        const decider = [...run(Side.A, 11), ...run(Side.B, 11)];
        const atThreshold = playSides(settings, ['p1', 'p2'], [...decider, ...run(Side.A, 5)]);
        const beyond = playSides(settings, ['p1', 'p2'], [...decider, ...run(Side.A, 8)]);

        expect(beyond.state.ends).toEqual(atThreshold.state.ends);
      });
    });

    /* ═══ Lets and Service Faults — III.II.VI, III.II.III ════════════════════════════════════════════════════════ */

    describe('lets and service doubts', (): void => {
      it('awards no point and leaves service unchanged on a let (III.II.VI.V)', (): void => {
        const settings = settingsFor();
        const withLet = replayMatch(settings, [
          ...opening(['p1', 'p2']),
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
          { type: EventType.LET },
        ]);
        const withoutLet = replayMatch(settings, [
          ...opening(['p1', 'p2']),
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
        ]);

        expect(withLet.scores).toEqual(withoutLet.scores);
        expect(withLet.server).toBe(withoutLet.server);
      });

      it('treats the first doubtful service of a match as a warning and a replay (III.II.III.VIII)', (): void => {
        const settings = settingsFor();
        const state = replayMatch(settings, [...opening(['p1', 'p2']), { type: EventType.SERVICE_DOUBT }]);

        expect(state.scores).toEqual({ [Side.A]: 0, [Side.B]: 0 });
      });

      it('treats every later doubtful service as a point to the receiver (III.II.III.VIII)', (): void => {
        const settings = settingsFor();
        const state = replayMatch(settings, [
          ...opening(['p1', 'p2']),
          { type: EventType.SERVICE_DOUBT },
          { type: EventType.SERVICE_DOUBT },
        ]);

        expect(state.scores).toEqual({ [Side.A]: 0, [Side.B]: 1 });
      });

      it('leaves the score untouched for time-outs and towel breaks (III.II.VIII)', (): void => {
        const settings = settingsFor();
        const state = replayMatch(settings, [
          ...opening(['p1', 'p2']),
          { type: EventType.TIMEOUT },
          { type: EventType.TOWEL_BREAK },
        ]);

        expect(state.scores).toEqual({ [Side.A]: 0, [Side.B]: 0 });
        expect(state.server).toBe('p1');
      });
    });

    /* ═══ Expedite — III.II.VIII.V ═══════════════════════════════════════════════════════════════════════════════ */

    describe('expedite', (): void => {
      it('offers expedite only when the league enables it (III.II.VIII.V)', (): void => {
        expect(replayMatch(settingsFor(), opening(['p1', 'p2'])).legalNextEvents).not.toContain(
          EventType.EXPEDITE_INTRODUCED,
        );
        expect(replayMatch(settingsFor({ expediteEnabled: true }), opening(['p1', 'p2'])).legalNextEvents).toContain(
          EventType.EXPEDITE_INTRODUCED,
        );
      });

      it('alternates service every point once introduced (III.II.VIII.V)', (): void => {
        const settings = settingsFor({ expediteEnabled: true });
        const state = replayMatch(settings, [
          ...opening(['p1', 'p2']),
          { type: EventType.EXPEDITE_INTRODUCED },
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
        ]);

        expect(state.isExpedite).toBe(true);
        expect(state.server).toBe('p2');
      });
    });

    /* ═══ Match Format — III.II.I.IV ═════════════════════════════════════════════════════════════════════════════ */

    describe('match format', (): void => {
      it('takes a best-of-three once a side wins two games (III.II.I.IV)', (): void => {
        const settings = settingsFor({ matchFormat: 3 });
        const { state } = playSides(settings, ['p1', 'p2'], [...run(Side.A, 11), ...run(Side.A, 11)]);

        expect(state.gamesWon).toEqual({ [Side.A]: 2, [Side.B]: 0 });
        expect(state.isComplete).toBe(true);
        expect(state.winner).toBe(Side.A);
      });

      it('keeps a best-of-three alive at one game each', (): void => {
        const settings = settingsFor({ matchFormat: 3 });
        const { state } = playSides(settings, ['p1', 'p2'], [...run(Side.A, 11), ...run(Side.B, 11)]);

        expect(state.gamesWon).toEqual({ [Side.A]: 1, [Side.B]: 1 });
        expect(state.gameNumber).toBe(3);
        expect(state.isComplete).toBe(false);
      });
    });

    /* ═══ Doubles — III.II.V ═════════════════════════════════════════════════════════════════════════════════════ */

    describe('doubles', (): void => {
      const rotation = ['a1', 'b1', 'a2', 'b2'];
      const doubles = settingsFor({ gameType: GameType.DOUBLES });

      it('opens with the first pair serving to the first receiver', (): void => {
        const state = replayMatch(doubles, opening(rotation));

        expect(state.server).toBe('a1');
        expect(state.receiver).toBe('b1');
      });

      it('makes the previous receiver the server and the previous server’s partner the receiver (III.II.V.III)', (): void => {
        const after = (points: number): IMatchState => playSides(doubles, rotation, run(Side.A, points)).state;

        expect([after(2).server, after(2).receiver]).toEqual(['b1', 'a2']);
        expect([after(4).server, after(4).receiver]).toEqual(['a2', 'b2']);
        expect([after(6).server, after(6).receiver]).toEqual(['b2', 'a1']);
        expect([after(8).server, after(8).receiver]).toEqual(['a1', 'b1']);
      });

      it('scores to the side rather than the individual', (): void => {
        const { state } = playSides(doubles, rotation, run(Side.A, 3));

        expect(state.scores).toEqual({ [Side.A]: 3, [Side.B]: 0 });
      });

      it('has the receiving pair serve first in the next game, receiving from their previous server (III.II.V.IV)', (): void => {
        const settings = settingsFor({ gameType: GameType.DOUBLES, matchFormat: 3 });
        const { state } = playSides(settings, rotation, run(Side.A, 11));

        expect(state.gameNumber).toBe(2);
        expect(state.server).toBe('b1');
        expect(state.receiver).toBe('a1');
      });

      it('reverses the receiving order at the change of ends in the deciding game (III.II.V.IV)', (): void => {
        const settings = settingsFor({ gameType: GameType.DOUBLES, matchFormat: 3 });
        const decider = [...run(Side.A, 11), ...run(Side.B, 11)];
        const before = playSides(settings, rotation, [...decider, ...run(Side.A, 4)]).state;
        const after = playSides(settings, rotation, [...decider, ...run(Side.A, 5)]).state;

        expect(after.ends).not.toEqual(before.ends);
        /* The serving side is unchanged across that single point, but its receiver has swapped partners */
        expect(after.receiver).not.toBe(before.receiver);
      });
    });

    /* ═══ Cutthroat — III.II.IX ══════════════════════════════════════════════════════════════════════════════════ */

    describe('cutthroat', (): void => {
      const rotation = ['p1', 'p2', 'p3'];
      const cutthroat = settingsFor({
        gameType: GameType.CUTTHROAT,
        targetScore: 7,
        matchFormat: 1,
      });

      /**
       * Plays a run of rallies with fixed outcomes
       * @internal
       * @function
       * @param outcomes - The winner of each successive rally
       * @returns The resulting state
       */
      const play = (outcomes: RallyWinner[]): IMatchState =>
        replayMatch(cutthroat, [
          ...opening(rotation),
          ...outcomes.map((wonBy) => ({ type: EventType.RALLY as const, wonBy })),
        ]);

      it('scores every player independently and starts everyone at zero', (): void => {
        const state = replayMatch(cutthroat, opening(rotation));

        expect(state.scores).toEqual({
          p1: 0,
          p2: 0,
          p3: 0,
        });
        expect(state.server).toBe('p1');
      });

      it('lets only the server score, and keeps the serve when they win (III.II.IX.III)', (): void => {
        const state = play([RallyWinner.SERVING, RallyWinner.SERVING]);

        expect(state.scores).toEqual({
          p1: 2,
          p2: 0,
          p3: 0,
        });
        expect(state.server).toBe('p1');
      });

      it('awards nobody a point when the server loses, and passes the serve (III.II.IX.III)', (): void => {
        const state = play([RallyWinner.RECEIVING]);

        expect(state.scores).toEqual({
          p1: 0,
          p2: 0,
          p3: 0,
        });
        expect(state.server).toBe('p2');
      });

      it('passes the serve in the drawn rotation order, not to the rally winner (III.II.IX.IV)', (): void => {
        expect(play([RallyWinner.RECEIVING]).rotationPosition).toBe(1);
        expect(play([RallyWinner.RECEIVING, RallyWinner.RECEIVING]).rotationPosition).toBe(2);
        expect(play(Array.from({ length: 3 }, () => RallyWinner.RECEIVING)).rotationPosition).toBe(0);
      });

      it('leaves the serve in place on a let (III.II.IX.XI)', (): void => {
        const state = replayMatch(cutthroat, [
          ...opening(rotation),
          { type: EventType.RALLY, wonBy: RallyWinner.RECEIVING },
          { type: EventType.LET },
        ]);

        expect(state.server).toBe('p2');
        expect(state.scores).toEqual({
          p1: 0,
          p2: 0,
          p3: 0,
        });
      });

      it('reports no ends and no single receiver (III.II.IX.X)', (): void => {
        const state = replayMatch(cutthroat, opening(rotation));

        expect(state.ends).toBeNull();
        expect(state.receiver).toBeNull();
      });

      it('needs a two-point lead over the second-highest score (III.II.IX.VIII)', (): void => {
        /* p1 takes six, hands over, p2 takes six, hands back, p1 reaches seven: 7-6-0 is not yet a win */
        const toSixEach: RallyWinner[] = [
          ...Array.from({ length: 6 }, () => RallyWinner.SERVING),
          RallyWinner.RECEIVING,
          ...Array.from({ length: 6 }, () => RallyWinner.SERVING),
          RallyWinner.RECEIVING,
          RallyWinner.RECEIVING,
          RallyWinner.SERVING,
        ];
        const state = play(toSixEach);

        expect(state.scores).toEqual({
          p1: 7,
          p2: 6,
          p3: 0,
        });
        expect(state.isComplete).toBe(false);
      });

      it('ends once the leader is two clear of the runner-up (III.II.IX.VIII)', (): void => {
        const state = play(Array.from({ length: 7 }, () => RallyWinner.SERVING));

        expect(state.scores).toEqual({
          p1: 7,
          p2: 0,
          p3: 0,
        });
        expect(state.isComplete).toBe(true);
        expect(state.winner).toBe('p1');
      });

      it('gives the game to the outright leader when the time cap elapses (III.II.IX.IX)', (): void => {
        const state = replayMatch(cutthroat, [
          ...opening(rotation),
          ...Array.from({ length: 3 }, () => ({ type: EventType.RALLY as const, wonBy: RallyWinner.SERVING })),
          { type: EventType.TIME_CAP_REACHED },
        ]);

        expect(state.isComplete).toBe(true);
        expect(state.winner).toBe('p1');
      });

      it('plays on in rotation when the cap finds the lead tied, until a leader wins as server (III.II.IX.IX)', (): void => {
        const tied = replayMatch(cutthroat, [...opening(rotation), { type: EventType.TIME_CAP_REACHED }]);

        expect(tied.isComplete).toBe(false);

        const resolved = replayMatch(cutthroat, [
          ...opening(rotation),
          { type: EventType.TIME_CAP_REACHED },
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
        ]);

        expect(resolved.isComplete).toBe(true);
        expect(resolved.winner).toBe('p1');
      });

      it('hands the serve to a tied leader when the cap finds someone else serving (III.II.IX.IX)', (): void => {
        /* p1 and p2 each take a point and hand over, leaving p3 serving with the lead tied at one apiece */
        const tiedWithOutsiderServing: TMatchEvent[] = [
          ...opening(rotation),
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
          { type: EventType.RALLY, wonBy: RallyWinner.RECEIVING },
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
          { type: EventType.RALLY, wonBy: RallyWinner.RECEIVING },
        ];

        expect(replayMatch(cutthroat, tiedWithOutsiderServing).server).toBe('p3');

        const capped = replayMatch(cutthroat, [...tiedWithOutsiderServing, { type: EventType.TIME_CAP_REACHED }]);

        expect(capped.isComplete).toBe(false);
        expect(capped.server).toBe('p1');
      });

      it('passes the serve on to the next tied leader when a capped rally is lost (III.II.IX.IX)', (): void => {
        const tiedWithOutsiderServing: TMatchEvent[] = [
          ...opening(rotation),
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
          { type: EventType.RALLY, wonBy: RallyWinner.RECEIVING },
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
          { type: EventType.RALLY, wonBy: RallyWinner.RECEIVING },
          { type: EventType.TIME_CAP_REACHED },
        ];
        const lost = replayMatch(cutthroat, [
          ...tiedWithOutsiderServing,
          { type: EventType.RALLY, wonBy: RallyWinner.RECEIVING },
        ]);

        /* p3 is not in contention, so the serve skips them entirely */
        expect(lost.isComplete).toBe(false);
        expect(lost.server).toBe('p2');

        const won = replayMatch(cutthroat, [
          ...tiedWithOutsiderServing,
          { type: EventType.RALLY, wonBy: RallyWinner.RECEIVING },
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
        ]);

        expect(won.isComplete).toBe(true);
        expect(won.winner).toBe('p2');
      });

      it('offers the time cap only when the league configures one', (): void => {
        expect(replayMatch(cutthroat, opening(rotation)).legalNextEvents).not.toContain(EventType.TIME_CAP_REACHED);
        expect(
          replayMatch(settingsFor({ ...cutthroat, cutthroatTimeCap: 15 }), opening(rotation)).legalNextEvents,
        ).toContain(EventType.TIME_CAP_REACHED);
      });

      it('never offers expedite, which the time cap replaces (III.II.IX.IX)', (): void => {
        const settings = settingsFor({ ...cutthroat, expediteEnabled: true });

        expect(replayMatch(settings, opening(rotation)).legalNextEvents).not.toContain(EventType.EXPEDITE_INTRODUCED);
      });
    });

    /* ═══ Retirement — III.II.X.II ═══════════════════════════════════════════════════════════════════════════════ */

    describe('retirement', (): void => {
      it('concedes the match to the opposing side (III.II.X.II)', (): void => {
        const settings = settingsFor();
        const { events } = playSides(settings, ['p1', 'p2'], run(Side.A, 3));
        const state = replayMatch(settings, [...events, { type: EventType.RETIREMENT, participantId: 'p1' }]);

        expect(state.status).toBe(MatchStatus.RETIRED);
        expect(state.winner).toBe(Side.B);
        expect(state.scores).toEqual({ [Side.A]: 3, [Side.B]: 0 });
      });

      it('gives a retired cutthroat game to the highest score at that moment (III.II.X.II)', (): void => {
        const cutthroat = settingsFor({ gameType: GameType.CUTTHROAT, targetScore: 7 });
        const state = replayMatch(cutthroat, [
          ...opening(['p1', 'p2', 'p3']),
          { type: EventType.RALLY, wonBy: RallyWinner.SERVING },
          { type: EventType.RETIREMENT, participantId: 'p3' },
        ]);

        expect(state.status).toBe(MatchStatus.RETIRED);
        expect(state.winner).toBe('p1');
      });

      it('refuses a retirement by someone who is not playing', (): void => {
        expect(() =>
          replayMatch(settingsFor(), [
            ...opening(['p1', 'p2']),
            { type: EventType.RETIREMENT, participantId: 'nobody' },
          ]),
        ).toThrow(/not a participant/);
      });
    });

    /* ═══ Legal Next Events — XI.IV ══════════════════════════════════════════════════════════════════════════════ */

    describe('legal next events', (): void => {
      it('offers the ordinary events while a match is live', (): void => {
        const state = replayMatch(settingsFor(), opening(['p1', 'p2']));

        expect(state.legalNextEvents).toEqual(
          expect.arrayContaining([
            EventType.RALLY,
            EventType.LET,
            EventType.SERVICE_DOUBT,
            EventType.TIMEOUT,
            EventType.TOWEL_BREAK,
            EventType.RETIREMENT,
          ]),
        );
      });

      it('offers nothing once the match is decided', (): void => {
        const { state } = playSides(settingsFor(), ['p1', 'p2'], run(Side.A, 11));

        expect(state.legalNextEvents).toEqual([]);
      });
    });
  });
});
