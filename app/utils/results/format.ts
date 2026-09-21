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
 * █████████████████████████████████████████████ #utils/results/format.ts ██████████████████████████████████████████████
 *
 * What a result page says: its heading, its status lines and its rating column.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IMatchView, IMatchViewParticipant, IMatchViewSide, IResultIdentity } from '#shared/results';
import { REDACTED_NOTE_TEXT, ResultSettleReason, ResultState } from '#shared/results';
import { GameType, Side } from '#shared/rules-engine';

/**
 * How a side is named: one person, or a pair joined the way the spec joins them.
 *
 * The names come from the read, which resolves each one against that account's current state, so a deleted account
 * arrives already written as one and nothing here has to know it
 * @public
 * @function
 * @param participants - The seats of one side, in seat order
 * @returns The side's name
 */
export function namesOf(participants: IMatchViewParticipant[]): string {
  return participants
    .map((participant: IMatchViewParticipant): string => participant.identity.displayName)
    .join(' and ');
}

/**
 * The seats of one side, in seat order
 * @public
 * @function
 * @param match - The match
 * @param side - Which side
 * @returns Its participants
 */
export function seatsOf(match: IMatchView, side: Side): IMatchViewParticipant[] {
  return match.participants.filter((participant: IMatchViewParticipant): boolean => participant.side === side);
}

/**
 * An instant in the viewer's own time, as the rest of the app shows one
 * @public
 * @function
 * @param instant - The instant, or null when there is none
 * @returns What to render, or an empty string when there is nothing
 */
export function toLocalDateTime(instant: string | null | undefined): string {
  if (!instant) {
    return '';
  }

  return new Date(instant).toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

/**
 * The heading: who beat whom once that is settled, and who played whom while it is not.
 *
 * A result somebody is still allowed to contest is not announced as a fact, which is why an unconfirmed and a
 * disputed match both read "v" (page spec, Page Skeleton)
 * @public
 * @function
 * @param match - The match
 * @returns The heading
 */
export function toHeading(match: IMatchView): string {
  const a: string = namesOf(seatsOf(match, Side.A));
  const b: string = namesOf(seatsOf(match, Side.B));

  if (match.state === ResultState.UNCONFIRMED || match.state === ResultState.DISPUTED) {
    return `${a} v ${b}`;
  }

  return match.gamesWon.a > match.gamesWon.b ? `${a} beat ${b}` : `${b} beat ${a}`;
}

/**
 * What the browser tab says.
 *
 * Always "v", and always the league, however the match ended. A tab is read beside other tabs, so it has to say
 * which league this belongs to; and a title that changed from "v" to "beat" on acceptance would make the same match
 * two different-looking tabs in somebody's history
 * @public
 * @function
 * @param match - The match
 * @returns The title, without the product name
 */
export function toTitle(match: IMatchView): string {
  return `${namesOf(seatsOf(match, Side.A))} v ${namesOf(seatsOf(match, Side.B))} · ${match.leagueName}`;
}

/**
 * Which side a seat plays on, for a list that cannot use the score table's column headings
 * @public
 * @function
 * @param participant - The seat
 * @returns The side's label
 */
export function toSideLabel(participant: IMatchViewParticipant): string {
  return participant.side === Side.A ? 'Side A' : 'Side B';
}

/**
 * The line under the heading: the format, the length and the games won
 * @public
 * @function
 * @param match - The match
 * @returns The line
 */
export function toSummary(match: IMatchView): string {
  const format: string = match.gameType === GameType.DOUBLES ? 'Doubles' : 'Singles';
  const line: string = `${format} · Best of ${match.rules.matchFormat} · ${match.gamesWon.a}-${match.gamesWon.b}`;
  const retired: IMatchViewParticipant | undefined = match.participants.find(
    (participant: IMatchViewParticipant): boolean => participant.seat === match.retiredSeat,
  );

  // A retired match is not a match somebody won on the scoreboard, so the line that states the score also states
  // why it ended where it did
  return retired ? `${line} · ${retired.identity.displayName} retired` : line;
}

/**
 * How one waiting side's line names who may answer it.
 *
 * Any one of them confirms the side, so the names are joined with "or". A member who has left keeps their place in
 * the line with the reason, because the side still waits for somebody and the page should say who it waited for
 * @public
 * @function
 * @param side - The side still waiting
 * @returns The sentence, without the deadline that follows it
 */
export function toAwaitingLine(side: IMatchViewSide): string {
  if (side.awaitsViewer) {
    return side.viewerTeammate
      ? `Awaiting your confirmation (or ${side.viewerTeammate.displayName}'s)`
      : 'Awaiting your confirmation';
  }

  const named: string = side.confirmers
    .map((confirmer: IResultIdentity): string =>
      confirmer.member ? confirmer.displayName : `${confirmer.displayName} (no longer a member)`,
    )
    .join(' or ');

  return `Awaiting confirmation from ${named}`;
}

/**
 * What an accepted result says about how it was accepted.
 *
 * Three settlements that a reader must be able to tell apart: somebody confirmed it, the deadline passed with nobody
 * disputing, or nobody was ever asked
 * @public
 * @function
 * @param match - The match
 * @returns The sentence
 */
export function toAcceptedLine(match: IMatchView): string {
  const when: string = toLocalDateTime(match.settledAt);

  if (match.settledReason === ResultSettleReason.DEADLINE_PASSED) {
    return `Accepted automatically ${when}`;
  }

  return match.settledReason === ResultSettleReason.NO_CONFIRMATION_NEEDED
    ? `Confirmed on submission ${when}`
    : `Confirmed ${when}`;
}

/**
 * What the accepted line says about ratings, which is not always that they moved
 * @public
 * @function
 * @param match - The match
 * @returns The sentence
 */
export function toRatingLine(match: IMatchView): string {
  if (match.rating.rated) {
    return 'Ratings updated';
  }

  return match.rating.unratedReason === 'GUEST' ? 'Unrated (guest)' : 'Unrated (ratings are off in this league)';
}

/**
 * What a dispute says it said, or that its words have been removed
 * @public
 * @function
 * @param match - The match
 * @returns The dispute line
 */
export function toDisputeLine(match: IMatchView): string {
  if (!match.dispute) {
    return '';
  }

  const opening: string = `Disputed by ${match.dispute.by.displayName} ${toLocalDateTime(match.dispute.at)}`;

  if (match.dispute.redacted) {
    return `${opening}: ${REDACTED_NOTE_TEXT}`;
  }

  return match.dispute.note ? `${opening}: ${match.dispute.note}` : opening;
}

/**
 * What follows a dispute, which depends on what this viewer can do about it and on whether amending is still
 * possible at all
 * @public
 * @function
 * @param match - The match
 * @returns The sentence
 */
export function toResolutionLine(match: IMatchView): string {
  if (!match.viewer.administrator) {
    return 'A commissioner or manager will resolve it.';
  }

  return match.amendmentOpen
    ? 'Resolve it by amending the result or voiding it.'
    : 'Amending is no longer possible; you can void it.';
}

/**
 * What the rating column shows for one seat: a change, that one is owed, or that none is coming
 * @public
 * @function
 * @param match - The match
 * @param participant - The seat
 * @returns The cell
 */
export function toRatingCell(match: IMatchView, participant: IMatchViewParticipant): string {
  if (!match.rating.rated) {
    return 'Unrated';
  }

  if (!participant.rating) {
    return 'Pending';
  }

  const { after, before, delta, provisional } = participant.rating;
  const change: string = `${Math.round(before)} → ${Math.round(after)} (${delta > 0 ? '+' : ''}${Math.round(delta)})`;

  return provisional ? `${change} · Provisional` : change;
}
