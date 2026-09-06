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
 * █████████████████████████████████████ #utils/features/scoring-fixture/utils.ts ██████████████████████████████████████
 *
 * Derives the Features scoring illustration from a replayed match log, so its service marker is provably correct.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IMatchState, TMatchEvent } from '#shared/rules-engine';
import { EventType, RallyWinner, replayMatch, Side } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import {
  SCORING_FIXTURE_FIRST_RECEIVER,
  SCORING_FIXTURE_FIRST_SERVER,
  SCORING_FIXTURE_GAME_ONE_LOSING_SCORE,
  SCORING_FIXTURE_GAME_TWO_POINTS,
  SCORING_FIXTURE_SETTINGS,
} from './constants';
import type { IScoringFixture, IScoringFixturePlayer } from './types';

/**
 * The side each player belongs to for the whole match. The opening rotation interleaves the sides, so index parity is
 * the mapping; it is fixed at match start because the rotation swaps between games
 * @internal
 * @function
 * @param rotation - The opening rotation, in service order
 * @returns Each player's side
 */
function sidesOf(rotation: string[]): Record<string, Side> {
  return Object.fromEntries(
    rotation.map((participant: string, index: number): [string, Side] => [
      participant,
      index % 2 === 0 ? Side.A : Side.B,
    ]),
  );
}

/**
 * The player on a side. Singles rotations are `[A, B]`, so the side is the index
 * @internal
 * @function
 * @param rotation - The opening rotation, in service order
 * @param side - The side to name
 * @returns The player's display name
 */
function playerOn(rotation: string[], side: Side): string {
  return side === Side.A ? rotation[0]! : rotation[1]!;
}

/**
 * Extends a log with the rallies that award points to the given sides in order.
 *
 * The fixture is written in terms of who scored, which is how a reader thinks about a scoreline, but the log records
 * whether the serving or the receiving side won each rally. Replaying the log so far is what resolves one into the
 * other, and it is why the fixture cannot drift from the engine: an appended point that the rules would not allow
 * produces a different state, and the unit test notices
 * @internal
 * @function
 * @param log - The log so far, opening with MATCH_INIT
 * @param sides - Each player's side
 * @param scorers - The side taking each successive point
 * @returns The extended log
 */
function appendPoints(log: TMatchEvent[], sides: Record<string, Side>, scorers: Side[]): TMatchEvent[] {
  return scorers.reduce<TMatchEvent[]>((events: TMatchEvent[], scorer: Side): TMatchEvent[] => {
    const current: IMatchState = replayMatch(SCORING_FIXTURE_SETTINGS, events);

    // a completed match cannot be appended to; the fixture never reaches this, and the test proves it
    if (current.isComplete) {
      return events;
    }

    return [
      ...events,
      {
        type: EventType.RALLY,
        wonBy: sides[current.server] === scorer ? RallyWinner.SERVING : RallyWinner.RECEIVING,
      },
    ];
  }, log);
}

/**
 * Points alternating between the sides, starting with side A; drives a game towards deuce
 * @internal
 * @function
 * @param count - How many points
 * @returns The scoring sides in order
 */
function alternating(count: number): Side[] {
  return Array.from({ length: count }, (_unused: unknown, index: number): Side => (index % 2 === 0 ? Side.A : Side.B));
}

/**
 * A run of points all taken by one side
 * @internal
 * @function
 * @param side - The scoring side
 * @param count - How many points
 * @returns The scoring side repeated
 */
function run(side: Side, count: number): Side[] {
  return Array.from({ length: count }, (): Side => side);
}

/**
 * Builds the match log the scoring illustration depicts: a completed first game and a second game level at deuce.
 *
 * Side B takes game one, which hands the serve to them in game two, and the twenty alternating points that follow
 * return the serve to them again
 * @internal
 * @function
 * @param sides - Each player's side
 * @returns The ordered match log
 */
function buildLog(sides: Record<string, Side>): TMatchEvent[] {
  const { targetScore } = SCORING_FIXTURE_SETTINGS;
  const opening: TMatchEvent[] = [
    { rotation: [SCORING_FIXTURE_FIRST_SERVER, SCORING_FIXTURE_FIRST_RECEIVER], type: EventType.MATCH_INIT },
  ];

  // game one runs level to the loser's score, then side B takes the rest of it
  const levelPoints: Side[] = alternating(SCORING_FIXTURE_GAME_ONE_LOSING_SCORE * 2);
  const closingPoints: Side[] = run(Side.B, targetScore - SCORING_FIXTURE_GAME_ONE_LOSING_SCORE);

  const throughGameOne: TMatchEvent[] = appendPoints(opening, sides, [...levelPoints, ...closingPoints]);

  return appendPoints(throughGameOne, sides, alternating(SCORING_FIXTURE_GAME_TWO_POINTS));
}

/**
 * Builds the immutable starting log for the interactive scoring demo
 * @public
 * @function
 * @returns A completed first game followed by a second game level at deuce
 */
export function buildScoringFixtureEvents(): TMatchEvent[] {
  const rotation: string[] = [SCORING_FIXTURE_FIRST_SERVER, SCORING_FIXTURE_FIRST_RECEIVER];

  return buildLog(sidesOf(rotation));
}

/**
 * Awards the next rally to one of the two demo players
 *
 * The UI names the person who won the point, while the event log records whether the serving or receiving side won.
 * Replaying the current log resolves that distinction before the event is appended.
 * @public
 * @function
 * @param events - The current demo event log
 * @param player - The player who won the rally
 * @returns A new event log, or the original log when the match is complete or the player is unknown
 */
export function scoreScoringFixturePoint(events: TMatchEvent[], player: string): TMatchEvent[] {
  const rotation: string[] = [SCORING_FIXTURE_FIRST_SERVER, SCORING_FIXTURE_FIRST_RECEIVER];
  const current: IMatchState = replayMatch(SCORING_FIXTURE_SETTINGS, events);

  if (current.isComplete || !rotation.includes(player)) {
    return events;
  }

  return [
    ...events,
    {
      type: EventType.RALLY,
      wonBy: current.server === player ? RallyWinner.SERVING : RallyWinner.RECEIVING,
    },
  ];
}

/**
 * Derives the labels on the scoring illustration by replaying a fixture match log through the rules engine.
 *
 * Nothing the diagram says about the state is written by hand. The score, who holds service, and whether the game is at
 * deuce all come out of `replayMatch`, so the service marker is provably where the rules put it rather than where it
 * looked right
 * @public
 * @function
 * @param events - The event log to derive, defaulting to the demo's opening state
 * @returns The state the illustration labels itself with
 */
export function buildScoringFixture(events: TMatchEvent[] = buildScoringFixtureEvents()): IScoringFixture {
  const rotation: string[] = [SCORING_FIXTURE_FIRST_SERVER, SCORING_FIXTURE_FIRST_RECEIVER];
  const state: IMatchState = replayMatch(SCORING_FIXTURE_SETTINGS, events);

  const { matchFormat, serviceInterval, targetScore, winningMargin } = SCORING_FIXTURE_SETTINGS;

  /**
   * The diagram lays the first receiver out on the near side, because they are the player holding service in the game
   * it depicts and the service marker should read first
   */
  const order: Side[] = [Side.B, Side.A];

  const players: IScoringFixturePlayer[] = order.map((side: Side): IScoringFixturePlayer => {
    const name: string = playerOn(rotation, side);

    return {
      gamesWon: state.gamesWon[side] ?? 0,
      isServing: !state.isComplete && state.server === name,
      name,
      score: state.scores[side] ?? 0,
    };
  });

  const gameOneWinner: string = playerOn(rotation, state.gamesWon[Side.A] > state.gamesWon[Side.B] ? Side.A : Side.B);
  const gameOneScore: string = `${targetScore}-${SCORING_FIXTURE_GAME_ONE_LOSING_SCORE}`;
  const live: string = players.map((player: IScoringFixturePlayer): number => player.score).join('-');
  const server: string = state.server;
  const winner: string | null =
    state.winner === Side.A || state.winner === Side.B ? playerOn(rotation, state.winner) : state.winner;

  let description: string;

  if (state.isComplete) {
    description =
      `Singles, best of ${matchFormat}. Game ${state.gameNumber} finished ${live}. ` +
      `${winner ?? 'The winning player'} won the match.`;
  } else if (state.isDeuce) {
    description =
      `Singles, best of ${matchFormat}. ${gameOneWinner} won game one ${gameOneScore}. ` +
      `Game ${state.gameNumber} stands at ${live}, which is deuce, so service changes every point instead of ` +
      `every ${serviceInterval}. ${server} is serving to ${state.receiver}.`;
  } else {
    description =
      `Singles, best of ${matchFormat}. Game ${state.gameNumber} stands at ${live}. ` +
      `${server} is serving to ${state.receiver}.`;
  }

  return {
    description,
    gameNumber: state.gameNumber,
    isDeuce: state.isDeuce,
    isComplete: state.isComplete,
    players,
    settingsCaption: `singles · first to ${targetScore}, win by ${winningMargin} · best of ${matchFormat}`,
    winner,
  };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(buildScoringFixture, {
  name: 'Build Scoring Fixture',
  description: 'Derives the Features scoring illustration from a replayed fixture match log.',
});
