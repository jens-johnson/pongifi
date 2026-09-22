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
 * ███████████████████████████████ #components/widgets/results/record-form/constants.ts ████████████████████████████████
 *
 * The Record form's own copy: what its Save button reads, and what it says about a refusal.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IResultFormContext } from '#shared/results';
import { toLocalDateTime } from '~/utils/results/format';

/**
 * What a play time outside the league's entry window says.
 *
 * The window is stated in hours rather than as two timestamps, because the person is deciding whether the match
 * they are thinking of is still enterable, not reading a range. The hours come from the context rather than from
 * the distance between its two instants: in Amend mode that distance is the window plus however long the result
 * has been waiting to be corrected
 * @public
 * @function
 * @param context - The rules this entry is judged by, which carry the window
 * @returns The message
 */
export function PLAYED_AT_MESSAGE(context: IResultFormContext): string {
  return `Results can be recorded up to ${context.windowHours} hours after they were played.`;
}

/**
 * What the Save button reads before anything has been sent
 * @public
 * @constant
 */
export const RECORD_SAVE_LABEL: string = 'Record result';

/**
 * What the same button reads when the form was opened to correct a result rather than to enter one
 * @public
 * @constant
 */
export const RECORD_AMEND_LABEL: string = 'Save amendment';

/**
 * What the Save button reads while a save is in flight, which is also when it is disabled.
 *
 * Save is single-shot: the label is how somebody knows a second press is not needed, and the disabled state is what
 * makes sure a second press does nothing
 * @public
 * @constant
 */
export const RECORD_SAVING_LABEL: string = 'Recording…';

/**
 * What the Save button reads while an outcome is unknown.
 *
 * The same button rather than a second one: pressing it re-sends the request the first attempt made, which the
 * server answers from that operation's receipt rather than by recording a second result
 * @public
 * @constant
 */
export const RECORD_CHECK_LABEL: string = 'Check';

/**
 * What an outcome nobody can be sure of says.
 *
 * Deliberately not an error: a request that got no answer, and a 5xx, may both have committed, and telling somebody
 * the save failed is how a second identical result gets entered
 * @public
 * @constant
 */
export const RECORD_UNCERTAIN_MESSAGE: string = 'Pongifi could not tell whether the result was recorded. Check';

/**
 * What a refusal that arrived without a message of its own says
 * @public
 * @constant
 */
export const RECORD_REFUSED_MESSAGE: string = 'Pongifi could not record this result right now.';

/**
 * What the link on a reused operation carrying a changed body says.
 *
 * The refusal's own message tells the person to open the result that exists; without this the sentence names
 * something the page never offered
 * @public
 * @constant
 */
export const RECORD_EXISTING_LINK: string = 'Open the result that exists';

/**
 * What one of the matches a duplicate warning listed is called.
 *
 * Named by when it says it was played, in the viewer's own time and in the form the Game page shows one. A warning
 * about two matches is two links, and a list whose lines all read the same thing is a list nobody can choose from
 * @public
 * @function
 * @param playedAt - When the match says it was played
 * @returns The link's text
 */
export function RECORD_DUPLICATE_LINK(playedAt: string): string {
  return `Result recorded for ${toLocalDateTime(playedAt)}`;
}

/**
 * What is added when a check itself was refused.
 *
 * A refused check says nothing about the save it was checking on. Every refusal the page can recognize from the
 * outside — a malformed body, an ended session, a request from elsewhere, a membership since lost, a spent write
 * allowance — is decided before the server ever looks for the earlier operation's receipt, so it establishes only
 * that the check did not run
 * @public
 * @constant
 */
export const RECORD_STILL_UNRESOLVED_MESSAGE: string = 'Your earlier save may still have gone through. Check again.';

/**
 * The refusal statuses this route decides after it has consulted the operation's receipt.
 *
 * The dividing line for a refused check. A 409 and a 422 are reached inside the transaction, under the league's
 * lock, after `replayOperation` has looked for a receipt, so either of them is an authoritative reconciliation of
 * the save being checked on rather than a refusal of the check. Which way it settles is not the same for both: a
 * 422, and a 409 about the league's rules, are reached because the lookup found nothing, while a changed-body 409
 * is the lookup itself — it is authoritative precisely because a receipt exists, for a body that is not this one.
 * Every other refusal is decided in front of the lookup and resolves nothing
 * @public
 * @constant
 */
export const RECORD_POST_RECEIPT_STATUSES: readonly number[] = [409, 422];
