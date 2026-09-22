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
 * █████████████████████████████████████████████ #shared/results/types.ts ██████████████████████████████████████████████
 *
 * The shapes a recorded result is submitted, frozen and reconstructed in.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ResultRecorder } from '#shared/domain';
import type { GameType, Side, TMatchEvent } from '#shared/rules-engine';

import type { ResultEnding, ResultSettleReason, ResultState, Seat, SideSatisfaction } from './enums';

/**
 * One seat as the recorder filled it: a member, or a guest label that belongs to this result alone
 * @public
 */
export interface IResultSeat {
  /* The label a guest was entered under, trimmed; null when the seat holds a member */
  guestName: string | null;

  /* Which seat this is */
  seat: Seat;

  /* The member in the seat; null when the seat holds a guest */
  userId: string | null;
}

/**
 * One game of the match, as scores rather than as a log
 * @public
 */
export interface IGameScoreRow {
  /* Side A's final score */
  a: number;

  /* Side B's final score */
  b: number;

  /* Which game of the match this is, from 1 */
  gameNumber: number;
}

/**
 * A result as the form submits it, before anything is frozen or reconstructed
 * @public
 */
export interface IResultSubmission {
  /* Whether the match was played out or ended by a withdrawal */
  ending: ResultEnding;

  /* Which format was played */
  gameType: GameType;

  /* The games, in order from 1 */
  games: IGameScoreRow[];

  /* When the match was played, as an ISO instant */
  playedAt: string;

  /* The seat that withdrew; null unless the ending is a retirement */
  retiredSeat: Seat | null;

  /* The seats, one per position the format fills */
  seats: IResultSeat[];
}

/**
 * The administration policy frozen onto a result at creation. Scoring rules freeze separately, as `IMatchSettings`:
 * the two answer different questions and a league can move either without the other
 * @public
 */
export interface IResultPolicySnapshot {
  /* Rated games before a rating leaves provisional status */
  provisionalGames: number;

  /* Whether this league's games move ratings at all */
  ratingEnabled: boolean;

  /* Whether the other participants have to accept a recorded result */
  requireConfirmation: boolean;

  /* Hours after the stated play time during which the result may be amended */
  resultAmendmentWindow: number;

  /* Hours a result stays unconfirmed before it is eligible for automatic acceptance */
  resultConfirmationWindow: number;

  /* The shape this snapshot was written under */
  version: number;

  /* Who may record a result in this league */
  whoCanRecordResults: ResultRecorder;
}

/**
 * One game's reconstructed log, with the facts the replay proved about it
 * @public
 */
export interface IReconstructedGame {
  /* The events belonging to this game, in sequence order; game one carries the match's MATCH_INIT at sequence zero */
  events: TMatchEvent[];

  /* Which game of the match this is, from 1 */
  gameNumber: number;

  /* Whether this game was played to a result, or left unfinished by a withdrawal */
  isComplete: boolean;

  /* The final scores, captured before the engine resets them at a game boundary */
  scores: Record<Side, number>;

  /* The side credited with this game; null only for an unfinished game nobody won on the table */
  winner: Side | null;
}

/**
 * A whole match's reconstruction: the log split by game, exactly as it is persisted
 * @public
 */
export interface IReconstruction {
  /* The games, in order from 1 */
  games: IReconstructedGame[];

  /* Whether the match itself reached a result rather than ending in a withdrawal */
  isComplete: boolean;

  /* The builder version that produced this log */
  version: number;

  /* The side that took the match */
  winner: Side;
}

/**
 * What the Record page opens on in Amend mode: the result being corrected, what was said against it, and the
 * revision the correction is judged against.
 *
 * Present only when the page was asked for a correction. Everything else on the context comes from the match's own
 * frozen snapshots in that case rather than from the league, because an amended result is still judged under the
 * rules the match was played under (page spec, Record, Amend mode)
 * @public
 */
export interface IResultAmendment {
  /* The match being corrected: where the save goes, and where the way back leads */
  canonicalMatchId: string;

  /* What the dispute said, for the line between the caption and the form */
  dispute: { at: string; by: IResultIdentity; note: string | null; redacted: boolean } | null;

  /* The revision the page was showing, which the save carries instead of a league configuration revision */
  expectedRevision: number;

  /* The disputed revision's own submission, which the form opens pre-filled from */
  submission: IResultSubmission;
}

/**
 * What the Record page needs before a person can type anything: the rules the entry will be judged by, the roster it
 * may seat, and the database's own clock.
 *
 * The clock is here because it is the only honest source of now. A device five minutes fast would otherwise offer a
 * default play time the server refuses as the future, and the person would have to guess why (contract, Record Clock
 * Addendum)
 * @public
 */
export interface IResultFormContext {
  /* The result being corrected, when the page was opened to correct one; null for an ordinary entry */
  amendment: IResultAmendment | null;

  /**
   * Whether this account may record in this league at all, the sentence to show when it may not, and whether it has
   * to be seated in what it records.
   *
   * `mustPlay` is the server's answer rather than something the form reads out of the label: a commissioner or a
   * manager records any match, and a player only reaches this form under a policy that also requires them to be in it
   */
  authority: { may: boolean; mustPlay: boolean; who: string };

  /* The league's configuration revision these rules came from; the save carries it back */
  configurationRevision: number;

  /* The formats this league records in this slice */
  formats: GameType[];

  /* The league's name, for the caption and the title */
  leagueName: string;

  /* The database's wall clock when the form was issued, which is what the play time is initialized from */
  now: string;

  /* The oldest play time this league still accepts, from that clock and the frozen entry window */
  earliest: string;

  /* The rules the entry is judged by, as the caption states them */
  rules: { matchFormat: number; targetScore: Record<string, number>; winningMargin: number };

  /* The ACTIVE members a seat may hold, as the members panel names them */
  roster: { displayName: string; id: string }[];
}

/**
 * How a person is named on a result page.
 *
 * Resolved when the page is drawn rather than copied when the match was recorded, so a deleted account reads as
 * deleted everywhere at once and no row has to be rewritten to make that true (VI.IV)
 * @public
 */
export interface IResultIdentity {
  /* What to show: their display name, the guest's label, or the words for an account that is gone */
  displayName: string;

  /* Whether this seat was a guest rather than an account */
  guest: boolean;

  /* The account, when there is one and it still exists */
  id: string | null;

  /* Whether that account is an active member of this league now */
  member: boolean;

  /* Whether the account has been deleted, which is why it is not named */
  removed: boolean;
}

/**
 * One side of a match as the game page reads it
 * @public
 */
export interface IMatchViewSide {
  /* Whether this side is one the viewer could answer for, which is what turns the status line personal */
  awaitsViewer: boolean;

  /* Who confirmed for this side, when somebody did */
  confirmedBy: IResultIdentity | null;

  /* The accounts frozen as able to answer for it, in seat order, whether or not they still can */
  confirmers: IResultIdentity[];

  /* The other eligible account on this side, when the viewer is one of two, for the "(or …'s)" suffix */
  viewerTeammate: IResultIdentity | null;

  /* How it came to be satisfied, or that it is still waiting */
  satisfiedBy: SideSatisfaction;

  /* Which side of the table */
  side: Side;
}

/**
 * One seat, as the participants table shows it
 * @public
 */
export interface IMatchViewParticipant {
  /* Whether this account's confirmation is what answered their side */
  confirmed: boolean;

  /* Who is in the seat */
  identity: IResultIdentity;

  /* The rating this match moved, read from the league's active generation; null until it is accepted or when unrated */
  rating: { after: number; before: number; delta: number; provisional: boolean } | null;

  /* The seat */
  seat: Seat;

  /* Which side it plays on */
  side: Side;
}

/**
 * One game of the match, as the score table shows it
 * @public
 */
export interface IMatchViewGame {
  /* Side A's final score */
  a: number;

  /* Side B's final score */
  b: number;

  /* Which game of the match */
  gameNumber: number;

  /* Whether this is the game a withdrawal ended */
  retired: boolean;

  /* Which side won it, by the scoreboard or by the withdrawal */
  winner: Side | null;
}

/**
 * One line of an amended result's history
 * @public
 */
export interface IMatchViewRevision {
  /* Who recorded or amended it */
  by: IResultIdentity;

  /* Whether this revision was the original entry or a correction of the one before it */
  kind: 'AMENDED' | 'RECORDED';

  /* Who disputed that revision, when somebody did */
  disputedBy: IResultIdentity | null;

  /* When they disputed it */
  disputedAt: string | null;

  /* The scores it stated, in game order */
  scores: string;

  /* Which revision this is */
  revision: number;

  /* When it was recorded or amended */
  at: string;
}

/**
 * A match as its page reads it: what happened, where it stands, and what this viewer may do about it
 * @public
 */
export interface IMatchView {
  /**
   * Whether an amendment is still possible at all, measured from the play time the first revision stated.
   *
   * Separate from what this viewer may do: the disputed sentence changes on it for an administrator, who is told to
   * resolve it by amending or voiding while it is open and that amending is no longer possible once it is not
   */
  amendmentOpen: boolean;

  /* The match, which is the page it lives at */
  canonicalMatchId: string;

  /* When it is due to be accepted if nobody disputes it */
  confirmationDeadline: string | null;

  /* What the dispute said, when the current revision is disputed */
  dispute: { at: string; by: IResultIdentity; note: string | null; redacted: boolean } | null;

  /* Whether the match was played out or ended by a withdrawal */
  ending: ResultEnding;

  /* The games of the current revision, in order */
  games: IMatchViewGame[];

  /* Games won, by side */
  gamesWon: { a: number; b: number };

  /* The format the match was played in */
  gameType: GameType;

  /* Every revision, oldest first, for an amended result */
  history: IMatchViewRevision[];

  /**
   * The league's name.
   *
   * On the view because the page's title states it, and a title is read in a tab beside other tabs: "Ada v Ben"
   * alone does not say which league it belongs to
   */
  leagueName: string;

  /* The seats */
  participants: IMatchViewParticipant[];

  /* The seat that withdrew, when the match ended in a retirement; null otherwise */
  retiredSeat: Seat | null;

  /* When the match was played */
  playedAt: string;

  /* Whether this match moved ratings, and why not when it did not */
  rating: { rated: boolean; unratedReason: 'GUEST' | 'RATINGS_OFF' | null };

  /* Who recorded the current revision */
  recordedBy: IResultIdentity;

  /* Which revision the page is showing */
  revision: number;

  /* The rules the match was played under, from its own snapshot rather than the league's current settings */
  rules: { matchFormat: number; targetScore: number; winningMargin: number };

  /* When it was accepted, and why */
  settledAt: string | null;

  /* Why it settled */
  settledReason: ResultSettleReason | null;

  /* The sides and who may answer for them */
  sides: IMatchViewSide[];

  /* Where the result stands */
  state: ResultState;

  /* When the current revision was submitted */
  submittedAt: string;

  /* What this viewer may do, decided against their role and membership now */
  viewer: {
    /* Whether this account holds a role that resolves disputes, which the disputed sentence turns on */
    administrator: boolean;
    mayAmend: boolean;
    mayConfirm: boolean;
    mayDispute: boolean;
    mayVoid: boolean;
    seated: boolean;
  };

  /* Who voided it, when somebody did */
  voided: { at: string; by: IResultIdentity } | null;
}
