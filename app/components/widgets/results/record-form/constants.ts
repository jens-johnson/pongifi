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

import { AMENDED_PLAYED_AT_MESSAGE, type IResultFormContext, RECORDED_PLAYED_AT_MESSAGE } from '#shared/results';
import { toLocalDateTime } from '~/utils/results/format';

/**
 * What a play time this form refuses says, in the words the route that would refuse it answers with.
 *
 * The hours come from the context rather than from the distance between its two instants: in Amend mode that
 * distance is the window plus however long the result has been waiting to be corrected.
 *
 * A correction states the other rule entirely: its bound runs from the play time the first revision stated, back by
 * the frozen window and forward only as far as now, so "recorded up to n hours after they were played" would name a
 * rule this form is not applying. Told by the mode rather than read off the context, because a stale-rules refusal
 * replaces the context with the league's own and a correction is still a correction after it
 * @public
 * @function
 * @param context - The rules this entry is judged by, which carry the window
 * @param amending - Whether the form was opened to correct a result rather than to enter one
 * @returns The message
 */
export function PLAYED_AT_MESSAGE(context: IResultFormContext, amending: boolean): string {
  return amending ? AMENDED_PLAYED_AT_MESSAGE(context.windowHours) : RECORDED_PLAYED_AT_MESSAGE(context.windowHours);
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
 * What the same button reads while a correction is in flight.
 *
 * A correction records nothing new: it replaces a revision of a result that already exists, and a button reading
 * Recording… on a form headed Amend a result names the wrong act
 * @public
 * @constant
 */
export const RECORD_AMEND_SAVING_LABEL: string = 'Saving…';

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
 * What the link under a correction that can no longer be made says.
 *
 * The result this form was opened on has moved — amended or voided by somebody else, settled, or past the window it
 * could be corrected within — so no press carrying the revision it was opened at can ever succeed. The result is
 * where the state that ended this correction is written, and it is the only thing left to do from here
 * @public
 * @constant
 */
export const RECORD_SUPERSEDED_LINK: string = 'Open the result';

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
