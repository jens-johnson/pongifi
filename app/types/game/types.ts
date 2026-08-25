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

import type { ConfirmationStatus, GameStatus, ParticipantOutcome, RecordingMode } from '#shared/domain';
import type { GameType, Side } from '#shared/rules-engine';

/**
 * A seat in a game, joined to the player occupying it. Exactly one of `userId` and `guestName` is set: a guest is a
 * per-game label rather than an identity, and two games with a guest called "Dave" are not the same Dave
 * @public
 */
export interface IGameParticipantSummary {
  /* The member's display name, or the guest's label */
  displayName: string;

  /* Their final score; a cache of the replayed log, written on completion */
  finalScore: number | null;

  /* The participant row's identifier */
  id: string;

  /* Whether this seat is a guest */
  isGuest: boolean;

  /* How they finished */
  outcome: ParticipantOutcome | null;

  /* Their place in the rotation, for cutthroat */
  rotationPosition: number | null;

  /* Which side they played, for singles and doubles */
  side: Side | null;

  /* The member occupying the seat, or null when a guest does */
  userId: string | null;
}

/**
 * A game as history lists and player pages render it. A structural mirror of the `games` row; the score never appears
 * here because a game's score belongs to its participants, and is always reproducible from the event log
 * @public
 */
export interface IGameSummary {
  /* Whether the result has been accepted; independent of status */
  confirmationStatus: ConfirmationStatus;

  /* When play finished; null while a game is unfinished */
  endedAt: Date | null;

  /* Which game of a best-of-N this is */
  gameNumber: number;

  /* The game's identifier */
  id: string;

  /* The league it was played in */
  leagueId: string;

  /* The match it belongs to, where it belongs to one */
  matchId: string | null;

  /* Whether it was recorded live or entered afterwards */
  recordingMode: RecordingMode;

  /* Where it sits in its lifecycle */
  status: GameStatus;

  /* Which of the three formats it was */
  type: GameType;
}
