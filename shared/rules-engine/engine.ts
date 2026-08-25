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
 * ██████████████████████████████████████████ #shared/rules-engine/engine.ts ███████████████████████████████████████████
 *
 * The rules engine: a pure fold of an ordered match log into the current state of play, shared by client and server.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * replayMatch(settingsSnapshot, orderedEvents) -> IMatchState
 *
 * ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • https://app.notion.com/p/Pongifi-MVP-Pitch-Document-3c7a683b42b780239fd1eb463b76dbf7
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import { PARTICIPANT_COUNT, SINGLE_POINT_SERVICE_INTERVAL } from './constants';
import { EEventType, EGameType, EMatchStatus, ERallyWinner, ESide } from './enums';
import type { IMatchInitEvent, IMatchSettings, IMatchState, TEnds, TMatchEvent } from './types';

/**
 * The engine's working state while folding a log; a superset of the public state, carrying the bookkeeping a replay
 * needs but a consumer does not
 * @internal
 */
interface IInternalState {
  settings: IMatchSettings;
  rotation: string[];
  /**
   * Which side each participant belongs to, fixed for the whole match. Sides cannot be derived from rotation index
   * parity: the rotation swaps adjacent pairs between games, which inverts the parity every game
   */
  sides: Record<string, ESide>;
  serverIndex: number;
  scores: Record<string, number>;
  gameNumber: number;
  gamesWon: Record<ESide, number>;
  endsSwapped: boolean;
  decidingEndsChanged: boolean;
  pointsSinceServiceChange: number;
  serviceDoubtIssued: boolean;
  isExpedite: boolean;
  timeCapReached: boolean;
  status: EMatchStatus;
  winner: string | null;
}

/* ─── Rotation Helpers ────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The side a participant plays for
 * @internal
 * @function
 * @param state - The working state
 * @param participant - The participant to look up
 * @throws Error when the participant is not in this match
 * @returns The participant's side
 */
function sideOf(state: IInternalState, participant: string): ESide {
  const side = state.sides[participant];

  if (!side) {
    throw new Error(`${participant} is not a participant in this match.`);
  }

  return side;
}

/**
 * The opposing side
 * @internal
 * @function
 * @param side - The side to invert
 * @returns The other side
 */
function opposing(side: ESide): ESide {
  return side === ESide.A ? ESide.B : ESide.A;
}

/**
 * The rotation for the following game. The pair that received first serves first (III.II.VII.VI), and the first
 * receiver is the player who served to them in the preceding game (III.II.V.IV); swapping each adjacent pair satisfies
 * both at once and reduces to a straight swap in singles
 * @internal
 * @function
 * @param rotation - The rotation the completed game was played under
 * @returns The rotation for the next game
 */
function rotateForNextGame(rotation: string[]): string[] {
  const next: string[] = [...rotation];

  for (let index = 0; index + 1 < next.length; index += 2) {
    [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
  }

  return next;
}

/* ─── Scoring Helpers ─────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the current game has been won, and by which scoring unit. A game needs both the target score and the winning
 * margin; in cutthroat the margin is measured against the second-highest score rather than a single opponent
 * (III.II.IX.VIII)
 * @internal
 * @function
 * @param state - The working state
 * @returns The winning scoring unit, or null while the game is still live
 */
function gameWinner(state: IInternalState): string | null {
  const { settings, scores } = state;
  const ranked = Object.entries(scores).sort(([, left], [, right]) => right - left);
  const [leader, runnerUp] = ranked;

  if (!leader) {
    return null;
  }

  const [unit, best] = leader;
  const second = runnerUp ? runnerUp[1] : 0;

  return best >= settings.targetScore && best - second >= settings.winningMargin ? unit : null;
}

/**
 * Whether both sides have reached one point below the target, after which service alternates every point
 * (III.II.VII.III). Cutthroat has no deuce; only the server can score, so the condition cannot arise meaningfully
 * @internal
 * @function
 * @param state - The working state
 * @returns Whether the game is at deuce
 */
function isDeuce(state: IInternalState): boolean {
  if (state.settings.gameType === EGameType.CUTTHROAT) {
    return false;
  }

  const threshold = state.settings.targetScore - 1;

  return Object.values(state.scores).every((score) => score >= threshold);
}

/**
 * How many games a side must win to take the match
 * @internal
 * @function
 * @param matchFormat - Best-of-N
 * @returns The number of games needed
 */
function gamesToWin(matchFormat: number): number {
  return Math.floor(matchFormat / 2) + 1;
}

/* ─── Ends ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Which side occupies which end. Cutthroat returns null: the rotation already moves every player through both ends, so
 * a fixed side-to-end mapping would be meaningless (III.II.IX.X)
 * @internal
 * @function
 * @param state - The working state
 * @returns The side-to-end mapping, or null for cutthroat
 */
function currentEnds(state: IInternalState): TEnds {
  if (state.settings.gameType === EGameType.CUTTHROAT) {
    return null;
  }

  return state.endsSwapped ? { [ESide.A]: 2, [ESide.B]: 1 } : { [ESide.A]: 1, [ESide.B]: 2 };
}

/**
 * Applies the mid-game change of ends in the deciding game, which falls when one side reaches half the target score
 * rounded down (III.II.VII.V). In the deciding game the receiving pair also reverses its receiving order at that
 * change (III.II.V.IV), which is a swap of the two receiving positions in the rotation
 * @internal
 * @function
 * @param state - The working state, mutated in place
 */
function applyDecidingGameEndsChange(state: IInternalState): void {
  const { settings } = state;

  if (settings.gameType === EGameType.CUTTHROAT || state.decidingEndsChanged) {
    return;
  }

  /**
   * The rule concerns "the final possible game of a match" (III.II.VII.V), which only distinguishes a game when a match
   * has more than one. Applying it to a best-of-one would swap ends and, in doubles, scramble the receiving order
   * mid-game in the casual games that are Pongifi's default
   */
  if (settings.matchFormat < 2 || state.gameNumber !== settings.matchFormat) {
    return;
  }

  const threshold = Math.floor(settings.targetScore / 2);
  const best = Math.max(...Object.values(state.scores));

  if (best < threshold) {
    return;
  }

  state.endsSwapped = !state.endsSwapped;
  state.decidingEndsChanged = true;

  /* The receiving pair reverses its receiving order; positions 1 and 3 are that pair in a doubles rotation */
  if (settings.gameType === EGameType.DOUBLES) {
    [state.rotation[1], state.rotation[3]] = [state.rotation[3]!, state.rotation[1]!];
  }
}

/* ─── Event Application ──────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Starts the next game of a match: the rotation carries over swapped, ends change, and scores reset. Expedite persists,
 * since once introduced it applies for the remainder of the match (III.II.VIII.V)
 * @internal
 * @function
 * @param state - The working state, mutated in place
 */
function startNextGame(state: IInternalState): void {
  state.rotation = rotateForNextGame(state.rotation);
  state.serverIndex = 0;
  state.pointsSinceServiceChange = 0;
  state.gameNumber += 1;
  state.endsSwapped = !state.endsSwapped;
  state.decidingEndsChanged = false;
  state.scores = Object.fromEntries(Object.keys(state.scores).map((unit) => [unit, 0]));
}

/**
 * Records a point for a scoring unit and resolves everything that follows it: game completion, match completion, the
 * change of ends in a deciding game, and the change of service
 * @internal
 * @function
 * @param state - The working state, mutated in place
 * @param unit - The scoring unit taking the point
 * @param advanceService - Whether this point counts toward the change of service
 */
function awardPoint(state: IInternalState, unit: string, advanceService: boolean): void {
  state.scores[unit] = (state.scores[unit] ?? 0) + 1;

  const winner = gameWinner(state);

  if (winner) {
    if (state.settings.gameType === EGameType.CUTTHROAT) {
      state.status = EMatchStatus.COMPLETE;
      state.winner = winner;

      return;
    }

    const side = winner as ESide;

    state.gamesWon[side] += 1;

    if (state.gamesWon[side] >= gamesToWin(state.settings.matchFormat)) {
      state.status = EMatchStatus.COMPLETE;
      state.winner = side;

      return;
    }

    startNextGame(state);

    return;
  }

  applyDecidingGameEndsChange(state);

  if (!advanceService) {
    return;
  }

  state.pointsSinceServiceChange += 1;

  const interval = isDeuce(state) || state.isExpedite ? SINGLE_POINT_SERVICE_INTERVAL : state.settings.serviceInterval;

  if (state.pointsSinceServiceChange >= interval) {
    state.pointsSinceServiceChange = 0;
    state.serverIndex = (state.serverIndex + 1) % state.rotation.length;
  }
}

/**
 * The participants tied for the lead once a cutthroat time cap has elapsed
 * @internal
 * @function
 * @param state - The working state
 * @returns The leading participants, in rotation order
 */
function tiedLeaders(state: IInternalState): string[] {
  const best = Math.max(...Object.values(state.scores));

  return state.rotation.filter((participant) => state.scores[participant] === best);
}

/**
 * Moves service to the next tied leader, used only while a capped cutthroat game is being played out (III.II.IX.IX)
 * @internal
 * @function
 * @param state - The working state, mutated in place
 * @param includeCurrent - Whether the server may keep the serve if they are already among the leaders
 */
function advanceToNextLeader(state: IInternalState, includeCurrent = false): void {
  const leaders = new Set(tiedLeaders(state));

  if (includeCurrent && leaders.has(state.rotation[state.serverIndex]!)) {
    return;
  }

  for (let step = 1; step <= state.rotation.length; step += 1) {
    const index = (state.serverIndex + step) % state.rotation.length;

    if (leaders.has(state.rotation[index]!)) {
      state.serverIndex = index;

      return;
    }
  }
}

/**
 * Applies a completed rally
 * @internal
 * @function
 * @param state - The working state, mutated in place
 * @param wonBy - Which side won the rally
 */
function applyRally(state: IInternalState, wonBy: ERallyWinner): void {
  const server = state.rotation[state.serverIndex]!;

  if (state.settings.gameType === EGameType.CUTTHROAT) {
    /* Only the server can score; losing the rally passes the serve and awards nothing (III.II.IX.III) */
    if (wonBy === ERallyWinner.SERVING) {
      if (state.timeCapReached) {
        state.status = EMatchStatus.COMPLETE;
        state.winner = server;

        return;
      }

      awardPoint(state, server, false);

      return;
    }

    if (state.timeCapReached) {
      advanceToNextLeader(state);

      return;
    }

    state.serverIndex = (state.serverIndex + 1) % state.rotation.length;

    return;
  }

  const servingSide = sideOf(state, server);
  const scoringSide = wonBy === ERallyWinner.SERVING ? servingSide : opposing(servingSide);

  awardPoint(state, scoringSide, true);
}

/**
 * Applies a doubtful service. The first of a match is a warning and a replay; every one after it is a fault and a point
 * to the receiver (III.II.III.VIII)
 * @internal
 * @function
 * @param state - The working state, mutated in place
 */
function applyServiceDoubt(state: IInternalState): void {
  if (state.serviceDoubtIssued) {
    applyRally(state, ERallyWinner.RECEIVING);

    return;
  }

  state.serviceDoubtIssued = true;
}

/**
 * Applies an elapsed cutthroat time cap. An outright leader takes the game; a tied lead plays on in rotation order
 * until one of the tied players wins a rally as server (III.II.IX.IX)
 * @internal
 * @function
 * @param state - The working state, mutated in place
 */
function applyTimeCap(state: IInternalState): void {
  const leaders = tiedLeaders(state);

  if (leaders.length === 1) {
    state.status = EMatchStatus.COMPLETE;
    state.winner = leaders[0]!;

    return;
  }

  state.timeCapReached = true;
  advanceToNextLeader(state, true);
}

/**
 * Applies a withdrawal. The opposing side is credited with the win; in cutthroat the game ends immediately and the
 * highest score at that moment wins (III.II.X.II)
 * @internal
 * @function
 * @param state - The working state, mutated in place
 * @param participantId - The participant withdrawing
 * @throws Error when the participant is not in this match
 */
function applyRetirement(state: IInternalState, participantId: string): void {
  if (!(participantId in state.sides)) {
    throw new Error(`${participantId} is not a participant in this match.`);
  }

  state.status = EMatchStatus.RETIRED;

  if (state.settings.gameType === EGameType.CUTTHROAT) {
    const [leader] = tiedLeaders(state);

    state.winner = leader ?? null;

    return;
  }

  state.winner = opposing(sideOf(state, participantId));
}

/**
 * Applies a single event to the working state
 * @internal
 * @function
 * @param state - The working state, mutated in place
 * @param event - The event to apply
 * @throws Error when the log carries a second MATCH_INIT
 */
function applyEvent(state: IInternalState, event: TMatchEvent): void {
  switch (event.type) {
    case EEventType.MATCH_INIT:
      throw new Error('A match log may only contain one MATCH_INIT event.');

    case EEventType.RALLY:
      applyRally(state, event.wonBy);
      break;

    case EEventType.SERVICE_DOUBT:
      applyServiceDoubt(state);
      break;

    case EEventType.EXPEDITE_INTRODUCED:
      state.isExpedite = true;
      break;

    case EEventType.TIME_CAP_REACHED:
      applyTimeCap(state);
      break;

    case EEventType.RETIREMENT:
      applyRetirement(state, event.participantId);
      break;

    /* Lets, time-outs, and towel breaks award no point and do not advance the service rotation (III.II.VI.V) */
    case EEventType.LET:
    case EEventType.TIMEOUT:
    case EEventType.TOWEL_BREAK:
      break;
  }
}

/* ─── Replay ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Builds the starting state from the match's opening event
 * @internal
 * @function
 * @param settings - The frozen settings snapshot
 * @param init - The match's MATCH_INIT event
 * @throws Error when the rotation does not match the game type's participant count
 * @returns The working state before any rally
 */
function initialState(settings: IMatchSettings, init: IMatchInitEvent): IInternalState {
  const expected = PARTICIPANT_COUNT[settings.gameType];

  if (init.rotation.length !== expected) {
    throw new Error(
      `${settings.gameType} needs a rotation of ${expected} participants; received ${init.rotation.length}.`,
    );
  }

  if (new Set(init.rotation).size !== init.rotation.length) {
    throw new Error('A rotation cannot list the same participant twice.');
  }

  const scores: Record<string, number> =
    settings.gameType === EGameType.CUTTHROAT
      ? Object.fromEntries(init.rotation.map((participant) => [participant, 0]))
      : { [ESide.A]: 0, [ESide.B]: 0 };

  /* The opening rotation interleaves the sides, so parity is correct exactly once: at match start */
  const sides: Record<string, ESide> = Object.fromEntries(
    init.rotation.map((participant, index) => [participant, index % 2 === 0 ? ESide.A : ESide.B]),
  );

  return {
    settings,
    rotation: [...init.rotation],
    sides,
    serverIndex: 0,
    scores,
    gameNumber: 1,
    gamesWon: { [ESide.A]: 0, [ESide.B]: 0 },
    endsSwapped: init.endsSwapped ?? false,
    decidingEndsChanged: false,
    pointsSinceServiceChange: 0,
    serviceDoubtIssued: false,
    isExpedite: false,
    timeCapReached: false,
    status: EMatchStatus.IN_PROGRESS,
    winner: null,
  };
}

/**
 * Which events may legally be appended next
 * @internal
 * @function
 * @param state - The working state
 * @returns The legal event types
 */
function legalNextEvents(state: IInternalState): EEventType[] {
  if (state.status !== EMatchStatus.IN_PROGRESS) {
    return [];
  }

  const legal: EEventType[] = [
    EEventType.RALLY,
    EEventType.LET,
    EEventType.SERVICE_DOUBT,
    EEventType.TIMEOUT,
    EEventType.TOWEL_BREAK,
    EEventType.RETIREMENT,
  ];

  if (state.settings.gameType === EGameType.CUTTHROAT) {
    if (state.settings.cutthroatTimeCap > 0 && !state.timeCapReached) {
      legal.push(EEventType.TIME_CAP_REACHED);
    }
  } else if (state.settings.expediteEnabled && !state.isExpedite) {
    legal.push(EEventType.EXPEDITE_INTRODUCED);
  }

  return legal;
}

/**
 * Projects the working state onto the public shape
 * @internal
 * @function
 * @param state - The working state
 * @returns The public match state
 */
function project(state: IInternalState): IMatchState {
  const isCutthroat = state.settings.gameType === EGameType.CUTTHROAT;
  const complete = state.status !== EMatchStatus.IN_PROGRESS;

  return {
    scores: { ...state.scores },
    server: state.rotation[state.serverIndex]!,
    /* Cutthroat's receiving side is a pair rather than a player, so it has no single receiver to name */
    receiver: complete || isCutthroat ? null : state.rotation[(state.serverIndex + 1) % state.rotation.length]!,
    rotationPosition: isCutthroat ? state.serverIndex : null,
    ends: currentEnds(state),
    gameNumber: state.gameNumber,
    gamesWon: { ...state.gamesWon },
    isComplete: complete,
    status: state.status,
    winner: state.winner,
    isDeuce: isDeuce(state),
    isExpedite: state.isExpedite,
    legalNextEvents: legalNextEvents(state),
  };
}

/**
 * Replays a match log into its current state. The engine is pure: given the same settings and the same ordered events
 * it always returns the same state, which is what makes rating recomputation reproducible (VIII.VIII). Time-dependent
 * rules arrive as explicit events rather than clock reads for the same reason
 * @public
 * @function
 * @param settings - The frozen settings snapshot the match is played under
 * @param events - The ordered match log, beginning with MATCH_INIT
 * @throws Error when the log does not open with MATCH_INIT, carries a malformed rotation, or continues past a result
 * @returns The state after the final event
 */
export function replayMatch(settings: IMatchSettings, events: TMatchEvent[]): IMatchState {
  const [first, ...rest] = events;

  if (!first || first.type !== EEventType.MATCH_INIT) {
    throw new Error('A match log must open with a MATCH_INIT event.');
  }

  const state = initialState(settings, first);

  for (const event of rest) {
    if (state.status !== EMatchStatus.IN_PROGRESS) {
      throw new Error(`A ${event.type} event cannot follow a completed match.`);
    }

    applyEvent(state, event);
  }

  return project(state);
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suites can title their describe blocks from the source symbol
defineSymbol(replayMatch, {
  name: 'Replay Match',
  description: 'Folds an ordered match log into the current state of play.',
});
