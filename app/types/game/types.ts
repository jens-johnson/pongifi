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
 * ███████████████████████████████████████████████ #types/game/types.ts ████████████████████████████████████████████████
 *
 * Structural mirrors of the game rows the app renders, kept narrow so queried rows satisfy them directly.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { EConfirmationStatus, EGameStatus, EParticipantOutcome, ERecordingMode } from '#shared/domain';
import type { EGameType, ESide } from '#shared/rules-engine';

/**
 * A game as history lists and player pages render it. A structural mirror of the `games` row; the score never appears
 * here because a game's score belongs to its participants, and is always reproducible from the event log
 * @public
 */
export interface IGameSummary {
  /* The game's identifier */
  id: string;
  /* The league it was played in */
  leagueId: string;
  /* Which of the three formats it was */
  type: EGameType;
  /* Where it sits in its lifecycle */
  status: EGameStatus;
  /* Whether the result has been accepted; independent of status */
  confirmationStatus: EConfirmationStatus;
  /* Whether it was recorded live or entered afterwards */
  recordingMode: ERecordingMode;
  /* Which game of a best-of-N this is */
  gameNumber: number;
  /* The match it belongs to, where it belongs to one */
  matchId: string | null;
  /* When play finished; null while a game is unfinished */
  endedAt: Date | null;
}

/**
 * A seat in a game, joined to the player occupying it. Exactly one of `userId` and `guestName` is set: a guest is a
 * per-game label rather than an identity, and two games with a guest called "Dave" are not the same Dave
 * @public
 */
export interface IGameParticipantSummary {
  /* The participant row's identifier */
  id: string;
  /* The member occupying the seat, or null when a guest does */
  userId: string | null;
  /* The member's display name, or the guest's label */
  displayName: string;
  /* Whether this seat is a guest */
  isGuest: boolean;
  /* Which side they played, for singles and doubles */
  side: ESide | null;
  /* Their place in the rotation, for cutthroat */
  rotationPosition: number | null;
  /* Their final score; a cache of the replayed log, written on completion */
  finalScore: number | null;
  /* How they finished */
  outcome: EParticipantOutcome | null;
}
