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

import type { EEventType, EGameType, EMatchStatus, ERallyWinner, ESide } from './enums';

/**
 * The fully resolved settings a match is played under; frozen onto the game record when play starts so a historical
 * match stays reproducible after league settings change
 * @public
 */
export interface IMatchSettings {
  /* Which of the three formats is being played */
  gameType: EGameType;
  /* The score a game is played to */
  targetScore: number;
  /* The lead required to win; 2 under the standard rules */
  winningMargin: number;
  /* Points between changes of service before deuce */
  serviceInterval: number;
  /* Best-of-N; always 1 for cutthroat */
  matchFormat: number;
  /* Minutes before a cutthroat game is capped; zero disables the cap */
  cutthroatTimeCap: number;
  /* Whether the expedite system may be introduced */
  expediteEnabled: boolean;
}

/**
 * Sequence zero of every match log. Carries the outcome of the lot and the service rotation, so the log is
 * self-sufficient and replays identically without reference to anything outside it
 * @public
 */
export interface IMatchInitEvent {
  type: EEventType.MATCH_INIT;
  /**
   * Participant ids in service order. Singles is `[server, receiver]`; doubles is `[A1, B1, A2, B2]`, so even indices
   * are side A and odd indices side B; cutthroat is the three players in their drawn rotation order
   */
  rotation: string[];
  /* Whether side B starts at end one; meaningless for cutthroat, which never changes ends */
  endsSwapped?: boolean;
}

/**
 * A completed rally
 * @public
 */
export interface IRallyEvent {
  type: EEventType.RALLY;
  /* Which side won it */
  wonBy: ERallyWinner;
}

/**
 * An event that carries no payload beyond its type
 * @public
 */
export interface ISimpleEvent {
  type: Exclude<EEventType, EEventType.MATCH_INIT | EEventType.RALLY | EEventType.RETIREMENT>;
}

/**
 * A withdrawal, conceding the match
 * @public
 */
export interface IRetirementEvent {
  type: EEventType.RETIREMENT;
  /* The participant withdrawing */
  participantId: string;
}

/**
 * Any event in a match log; a discriminated union keyed on `type`
 * @public
 */
export type TMatchEvent = IMatchInitEvent | IRallyEvent | ISimpleEvent | IRetirementEvent;

/**
 * Which end each side currently occupies; null for cutthroat, where the rotation moves every player through both ends
 * and a fixed side-to-end mapping has no meaning
 * @public
 */
export type TEnds = Record<ESide, 1 | 2> | null;

/**
 * The state of a match after replaying its log
 * @public
 */
export interface IMatchState {
  /**
   * Current game scores, keyed by scoring unit: `ESide` for singles and doubles, participant id for cutthroat, where
   * every player scores independently
   */
  scores: Record<string, number>;
  /* The participant holding service */
  server: string;
  /* The participant receiving; null once the match is over */
  receiver: string | null;
  /* The server's index in the cutthroat rotation; null for singles and doubles */
  rotationPosition: number | null;
  /* Which side is at which end; null for cutthroat */
  ends: TEnds;
  /* Which game of the match is being played, from 1 */
  gameNumber: number;
  /* Games won so far by each side; cutthroat is single-game and never populates this */
  gamesWon: Record<ESide, number>;
  /* Whether the match has reached a result */
  isComplete: boolean;
  /* How the match stands */
  status: EMatchStatus;
  /* The winning side, or the winning participant in cutthroat; null until the match is decided */
  winner: string | null;
  /* Whether both sides have reached one point below the target, so service alternates every point */
  isDeuce: boolean;
  /* Whether the expedite system is in force */
  isExpedite: boolean;
  /* Event types that may legally be appended next */
  legalNextEvents: EEventType[];
}
