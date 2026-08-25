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
 * ██████████████████████████████████████████ #shared/rating-engine/types.ts ███████████████████████████████████████████
 *
 * Types for the rating engine: the inputs a game presents, the changes it produces, and what decides its eligibility.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { EConfirmationStatus, EGameStatus, EParticipantOutcome, ERatingScope } from '#shared/domain';
import type { EGameType, ESide } from '#shared/rules-engine';

/**
 * A player as the rating engine sees them going into a game
 * @public
 */
export interface IRatedParticipant {
  /* Stable identifier for the player; guests never appear, since a guest game is unrated for everyone */
  participantId: string;
  /* Their rating in the scope being computed, before this game */
  rating: number;
  /* Rated games they have completed in that scope */
  gamesPlayed: number;
  /* Their final score in this game */
  score: number;
  /* Which side they played; required for singles and doubles, absent for cutthroat */
  side?: ESide;
  /**
   * How they finished. Supplied for singles and doubles, where the winner is not always the higher score: a retirement
   * credits the side that stayed, whatever the scoreboard said. Cutthroat ignores it and ranks on score, which is what
   * its pairwise decomposition needs
   */
  outcome?: EParticipantOutcome;
}

/**
 * Everything the engine needs to rate one game
 * @public
 */
export interface IRateGameInput {
  /* Which of the three formats was played */
  gameType: EGameType;
  /* The players, with their ratings going in */
  participants: IRatedParticipant[];
  /* The lead a win required, which anchors the margin multiplier */
  winningMargin: number;
  /* Rated games needed before a rating leaves provisional status */
  provisionalGames: number;
}

/**
 * What one game did to one player's rating
 * @public
 */
export interface IRatingChange {
  /* The player */
  participantId: string;
  /* Their rating before the game */
  ratingBefore: number;
  /* Their rating after it */
  ratingAfter: number;
  /* The change, carried separately so a history view need not subtract */
  delta: number;
  /* Rated games completed in this scope, including this one */
  gamesPlayed: number;
  /* Whether the rating is still provisional after this game */
  isProvisional: boolean;
}

/**
 * The facts about a game that decide what it feeds. Deliberately separate from the game row: eligibility is a pure
 * question about a handful of flags, and keeping it that way makes the matrix in VIII.VII directly testable
 * @public
 */
export interface IGameEligibility {
  /* Where the game sits in its lifecycle */
  status: EGameStatus;
  /* Whether the result has been accepted */
  confirmationStatus: EConfirmationStatus;
  /* Whether any seat was filled by a guest */
  hasGuest: boolean;
  /* Whether the league rates games at all */
  ratingEnabled: boolean;
  /* Whether the game was recorded live rather than entered afterwards */
  isLiveRecorded: boolean;
  /* Whether a per-game override marked this game unrated (IV.V) */
  isUnratedOverride?: boolean;
}

/**
 * A game as the recomputation pass reads it: its eligibility, its participants, and enough to order it
 * @public
 */
export interface IRatableGame extends IRateGameInput {
  /* The game that caused the resulting snapshots */
  gameId: string;
  /* What this game feeds */
  eligibility: IGameEligibility;
}

/**
 * A snapshot the recomputation pass produces, ready to be written to the append-only store
 * @public
 */
export interface IRatingSnapshotDraft extends IRatingChange {
  /* The game that caused it */
  gameId: string;
  /* Which ladder it belongs to */
  scope: ERatingScope;
}
