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
 * ███████████████████████████████████████████ #shared/rules-engine/types.ts ███████████████████████████████████████████
 *
 * Types for the rules engine: the settings snapshot, the match event union, and the state a replay produces.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { EventType, GameType, MatchStatus, RallyWinner, Side } from './enums';

/**
 * The fully resolved settings a match is played under; frozen onto the game record when play starts so a historical
 * match stays reproducible after league settings change
 * @public
 */
export interface IMatchSettings {
  /* Minutes before a cutthroat game is capped; zero disables the cap */
  cutthroatTimeCap: number;

  /* Whether the expedite system may be introduced */
  expediteEnabled: boolean;

  /* Which of the three formats is being played */
  gameType: GameType;

  /* Best-of-N; always 1 for cutthroat */
  matchFormat: number;

  /* Points between changes of service before deuce */
  serviceInterval: number;

  /* The score a game is played to */
  targetScore: number;

  /* The lead required to win; 2 under the standard rules */
  winningMargin: number;
}

/**
 * Sequence zero of every match log. Carries the outcome of the lot and the service rotation, so the log is
 * self-sufficient and replays identically without reference to anything outside it
 * @public
 */
export interface IMatchInitEvent {
  /* Whether side B starts at end one; meaningless for cutthroat, which never changes ends */
  endsSwapped?: boolean;

  /**
   * Participant ids in service order. Singles is `[server, receiver]`; doubles is `[A1, B1, A2, B2]`, so even indices
   * are side A and odd indices side B; cutthroat is the three players in their drawn rotation order
   */
  rotation: string[];

  /* Discriminates the event union */
  type: EventType.MATCH_INIT;
}

/**
 * A completed rally
 * @public
 */
export interface IRallyEvent {
  /* Discriminates the event union */
  type: EventType.RALLY;

  /* Which side won it */
  wonBy: RallyWinner;
}

/**
 * A withdrawal, conceding the match
 * @public
 */
export interface IRetirementEvent {
  /* The participant withdrawing */
  participantId: string;

  /* Discriminates the event union */
  type: EventType.RETIREMENT;
}

/**
 * An event that carries no payload beyond its type
 * @public
 */
export interface ISimpleEvent {
  /* Discriminates the event union */
  type: Exclude<EventType, EventType.MATCH_INIT | EventType.RALLY | EventType.RETIREMENT>;
}

/**
 * The state of a match after replaying its log
 * @public
 */
export interface IMatchState {
  /* Which side is at which end; null for cutthroat */
  ends: TEnds;

  /* Which game of the match is being played, from 1 */
  gameNumber: number;

  /* Games won so far by each side; cutthroat is single-game and never populates this */
  gamesWon: Record<Side, number>;

  /* Whether the match has reached a result */
  isComplete: boolean;

  /* Whether both sides have reached one point below the target, so service alternates every point */
  isDeuce: boolean;

  /* Whether the expedite system is in force */
  isExpedite: boolean;

  /* Event types that may legally be appended next */
  legalNextEvents: EventType[];

  /* The participant receiving; null once the match is over */
  receiver: string | null;

  /* The server's index in the cutthroat rotation; null for singles and doubles */
  rotationPosition: number | null;

  /**
   * Current game scores, keyed by scoring unit: `Side` for singles and doubles, participant id for cutthroat, where
   * every player scores independently
   */
  scores: Record<string, number>;

  /* The participant holding service */
  server: string;

  /* How the match stands */
  status: MatchStatus;

  /* The winning side, or the winning participant in cutthroat; null until the match is decided */
  winner: string | null;
}

/**
 * Any event in a match log; a discriminated union keyed on `type`
 * @public
 */
export type TMatchEvent = IMatchInitEvent | IRallyEvent | IRetirementEvent | ISimpleEvent;

/**
 * Which end each side currently occupies; null for cutthroat, where the rotation moves every player through both ends
 * and a fixed side-to-end mapping has no meaning
 * @public
 */
export type TEnds = Record<Side, 1 | 2> | null;
