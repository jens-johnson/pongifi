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
 * ██████████████████████████████████████████ #shared/results/reconstruct.ts ███████████████████████████████████████████
 *
 * Builds the synthetic log an entered final score implies, and proves it legal by replaying it.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IMatchSettings, TMatchEvent } from '#shared/rules-engine';
import { EventType, GameType, MatchStatus, RallyWinner, replayMatch, Side } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import { DOUBLES_SEATS, MAX_ENTERED_SCORE, MAX_GAME_ROWS, RECONSTRUCTION_VERSION, SINGLES_SEATS } from './constants';
import type { Seat } from './enums';
import { ResultEnding } from './enums';
import type { IReconstructedGame, IReconstruction, IResultSubmission } from './types';
import { sideOfSeat } from './utils';

/**
 * The seats each format fills, in the canonical interleaved order the engine reads sides from
 * @internal
 * @constant
 */
const SEATS_BY_TYPE: Readonly<Partial<Record<GameType, readonly Seat[]>>> = {
  [GameType.DOUBLES]: DOUBLES_SEATS,
  [GameType.SINGLES]: SINGLES_SEATS,
};

/**
 * The scores of a game in progress, by side
 * @internal
 */
type TRunningScores = Record<Side, number>;

/**
 * Whether awarding the next point to a side would end the game there.
 *
 * The engine's own game-winning test, applied to the score the point would produce. Both sides can never answer true
 * at once, which is what makes the builder's choice forced rather than a search
 * @internal
 * @function
 * @param settings - The frozen scoring rules
 * @param scores - The scores before the point
 * @param side - The side taking it
 * @returns Whether the game ends on that point
 */
function endsGame(settings: IMatchSettings, scores: TRunningScores, side: Side): boolean {
  const taking: number = scores[side] + 1;
  const other: number = side === Side.A ? scores[Side.B] : scores[Side.A];

  return taking >= settings.targetScore && taking - other >= settings.winningMargin;
}

/**
 * Orders one game's points so that no prefix of them ends the game early.
 *
 * At every step at most one side can end the game, so the other is always a safe choice; when the only side with
 * points left is the one that would end it, the entered scores are unreachable under these rules and the game is
 * refused rather than approximated. The last point is the exception: a completed game has to end on it
 * @internal
 * @function
 * @param settings - The frozen scoring rules
 * @param target - The game's final scores
 * @param mustComplete - Whether the game was played to a result
 * @throws Error when no legal ordering of those points exists
 * @returns The scoring side of each point, in order
 */
function orderPoints(settings: IMatchSettings, target: TRunningScores, mustComplete: boolean): Side[] {
  const remaining: TRunningScores = { ...target };
  const scores: TRunningScores = { [Side.A]: 0, [Side.B]: 0 };
  const order: Side[] = [];
  const total: number = target[Side.A] + target[Side.B];

  while (order.length < total) {
    const isLast: boolean = order.length === total - 1;
    const choices: Side[] = [Side.A, Side.B].filter((side: Side): boolean => remaining[side] > 0);
    const chosen: Side | undefined = isLast
      ? choices[0]
      : choices.find((side: Side): boolean => !endsGame(settings, scores, side));

    if (!chosen) {
      throw new Error(
        `No legal ordering reaches ${target[Side.A]}-${target[Side.B]} under a target of ${settings.targetScore} and a margin of ${settings.winningMargin}.`,
      );
    }

    remaining[chosen] -= 1;
    scores[chosen] += 1;
    order.push(chosen);
  }

  if (mustComplete && !endsGameAt(settings, scores, target)) {
    throw new Error(
      `${target[Side.A]}-${target[Side.B]} is not a finished game under a target of ${settings.targetScore} and a margin of ${settings.winningMargin}.`,
    );
  }

  return order;
}

/**
 * Whether the entered scores are themselves a finished game
 * @internal
 * @function
 * @param settings - The frozen scoring rules
 * @param scores - The scores the ordering reached
 * @param target - The scores that were entered
 * @returns Whether the game is over at those scores
 */
function endsGameAt(settings: IMatchSettings, scores: TRunningScores, target: TRunningScores): boolean {
  const leader: Side = target[Side.A] >= target[Side.B] ? Side.A : Side.B;
  const trailer: Side = leader === Side.A ? Side.B : Side.A;

  return (
    scores[leader] === target[leader] &&
    scores[trailer] === target[trailer] &&
    target[leader] >= settings.targetScore &&
    target[leader] - target[trailer] >= settings.winningMargin
  );
}

/**
 * Turns the side that scored into the rally outcome the engine records, which is written from the server's point of
 * view rather than from a side's. The serving side is read from the replayed state, never assumed
 * @internal
 * @function
 * @param servingSide - The side holding service for this point
 * @param scoringSide - The side taking it
 * @returns The rally's outcome
 */
function toRallyWinner(servingSide: Side, scoringSide: Side): RallyWinner {
  return servingSide === scoringSide ? RallyWinner.SERVING : RallyWinner.RECEIVING;
}

/**
 * Refuses a submission whose shape could not describe a match at all, before any point is ordered.
 * @internal
 * @function
 * @param settings - The frozen scoring rules
 * @param submission - The submission
 * @throws Error naming the first thing that is wrong
 */
function assertShape(settings: IMatchSettings, submission: IResultSubmission): void {
  const seats: readonly Seat[] | undefined = SEATS_BY_TYPE[submission.gameType];

  if (!seats) {
    throw new Error(`${submission.gameType} results cannot be entered as a final score.`);
  }

  const filled: Seat[] = submission.seats.map((seat): Seat => seat.seat);

  if (filled.length !== seats.length || new Set(filled).size !== filled.length) {
    throw new Error(`${submission.gameType} needs exactly ${seats.length} distinct seats.`);
  }

  if (!seats.every((seat: Seat): boolean => filled.includes(seat))) {
    throw new Error(`${submission.gameType} is played by ${seats.join(', ')}.`);
  }

  if (submission.games.length < 1 || submission.games.length > MAX_GAME_ROWS) {
    throw new Error(`A result carries between 1 and ${MAX_GAME_ROWS} games.`);
  }

  if (submission.games.length > settings.matchFormat) {
    throw new Error(`A best-of-${settings.matchFormat} match cannot carry ${submission.games.length} games.`);
  }

  submission.games.forEach((game, index): void => {
    if (game.gameNumber !== index + 1) {
      throw new Error('Games are numbered from 1 with no gaps.');
    }

    [game.a, game.b].forEach((score): void => {
      if (!Number.isInteger(score) || score < 0 || score > MAX_ENTERED_SCORE) {
        throw new Error(`A score is a whole number between 0 and ${MAX_ENTERED_SCORE}.`);
      }
    });
  });

  if ((submission.retiredSeat !== null) !== (submission.ending === ResultEnding.RETIRED)) {
    throw new Error('A retirement names exactly one seat, and no other ending names any.');
  }

  if (submission.retiredSeat !== null && !filled.includes(submission.retiredSeat)) {
    throw new Error('The seat that withdrew is not one of this match’s seats.');
  }
}

/**
 * Builds the reconstruction of an entered result and proves it legal by replaying it.
 *
 * The log is synthetic and says so: it carries one MATCH_INIT, the rallies the entered scores imply, and a single
 * RETIREMENT when somebody withdrew. Nothing else is invented — no timings, no lets, no service doubts — because a
 * retroactive result knows the scores and nothing more (VII.IV). Service and ends are reconstruction values, read
 * back out of the engine rather than claimed about the real match.
 *
 * Every point is replayed as it is appended, so the proof is over every prefix rather than over the final state: a
 * game that would have ended earlier under these rules, a game after the match was already won, and a score no legal
 * rally order reaches are all refused here rather than stored and discovered later. Each game's final scores are
 * captured before the point that ends it, because the engine resets them at the boundary
 * @public
 * @function
 * @param settings - The scoring rules frozen onto the result
 * @param submission - The normalized submission
 * @throws Error when no legal match under these rules produces the entered scores
 * @returns The reconstruction, split by game, in the shape it is persisted in
 */
export function reconstructResult(settings: IMatchSettings, submission: IResultSubmission): IReconstruction {
  assertShape(settings, submission);

  const rotation: string[] = (SEATS_BY_TYPE[submission.gameType] ?? []).map((seat: Seat): string => seat);
  const events: TMatchEvent[] = [{ rotation, type: EventType.MATCH_INIT }];
  const games: IReconstructedGame[] = [];

  submission.games.forEach((row, index): void => {
    const isFinalRow: boolean = index === submission.games.length - 1;
    const mustComplete: boolean = !(isFinalRow && submission.ending === ResultEnding.RETIRED);
    const target: TRunningScores = { [Side.A]: row.a, [Side.B]: row.b };
    const gameEvents: TMatchEvent[] = [];

    orderPoints(settings, target, mustComplete).forEach((scoringSide: Side): void => {
      const before = replayMatch(settings, events);

      if (before.isComplete) {
        throw new Error('The match was already decided before this point.');
      }

      if (before.gameNumber !== row.gameNumber) {
        throw new Error(`Game ${row.gameNumber} was expected but the replay is in game ${before.gameNumber}.`);
      }

      const rally: TMatchEvent = {
        type: EventType.RALLY,
        wonBy: toRallyWinner(sideOfSeat(before.server as Seat), scoringSide),
      };

      events.push(rally);
      gameEvents.push(rally);
    });

    const after = replayMatch(settings, events);
    const winner: Side | null = mustComplete ? (target[Side.A] > target[Side.B] ? Side.A : Side.B) : null;

    if (mustComplete && !after.isComplete && after.gameNumber !== row.gameNumber + 1) {
      throw new Error(`Game ${row.gameNumber} did not end on its last point.`);
    }

    if (!mustComplete && after.isComplete) {
      throw new Error('A retired match cannot have been decided on the table.');
    }

    if (mustComplete && after.isComplete && !isFinalRow) {
      throw new Error(`The match was decided in game ${row.gameNumber}; later games cannot exist.`);
    }

    games.push({
      events: index === 0 ? [events[0]!, ...gameEvents] : gameEvents,
      gameNumber: row.gameNumber,
      isComplete: mustComplete,
      scores: target,
      winner,
    });
  });

  if (submission.ending === ResultEnding.RETIRED && submission.retiredSeat) {
    events.push({ participantId: submission.retiredSeat, type: EventType.RETIREMENT });
    games.at(-1)?.events.push({ participantId: submission.retiredSeat, type: EventType.RETIREMENT });
  }

  const final = replayMatch(settings, events);

  if (!final.isComplete) {
    throw new Error('The entered games do not decide the match.');
  }

  if (submission.ending === ResultEnding.RETIRED && final.status !== MatchStatus.RETIRED) {
    throw new Error('A retirement must be the event that ends the match.');
  }

  const decided: IReconstructedGame | undefined = games.at(-1);

  if (decided && !decided.winner) {
    decided.winner = final.winner as Side;
  }

  return {
    games,
    isComplete: final.status === MatchStatus.COMPLETE,
    version: RECONSTRUCTION_VERSION,
    winner: final.winner as Side,
  };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(reconstructResult, {
  name: 'Reconstruct Result',
  description: 'Builds and proves the synthetic log an entered final score implies.',
});
