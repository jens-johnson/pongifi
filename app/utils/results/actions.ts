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
 * █████████████████████████████████████████████ #utils/results/actions.ts █████████████████████████████████████████████
 *
 * What a pressed result action is doing, and what the page may do while it is doing it.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { ResultAction } from '#shared/results';
import { classifyWriteFailure, WriteFailure } from '~/utils/leagues/write-failure';

/**
 * Where a pressed action has got to.
 *
 * Four states rather than a boolean, because "we do not know" is a distinct answer that the page has to keep: an
 * action whose outcome is uncertain may have committed, so its request is held and every other action waits until
 * the person resolves it
 * @public
 * @enum
 */
export enum ResultActionPhase {
  /* The result changed underneath the page; it redraws and the person chooses again */
  CONFLICT = 'CONFLICT',

  /* Nothing pressed */
  IDLE = 'IDLE',

  /* Refused outright, and nothing was written */
  REFUSED = 'REFUSED',

  /* In flight */
  SENDING = 'SENDING',

  /* No answer, or the server failed: this may or may not have committed */
  UNCERTAIN = 'UNCERTAIN',
}

/**
 * The body a press sent, kept exactly as it was sent.
 *
 * The server keys an operation on the account, the operation id and a digest of the body, so a retry that rebuilt
 * its body from whatever the page is showing now is not a retry at all: the same id carrying a different body is a
 * conflict, and the answer the person is waiting on stays unresolved
 * @public
 */
export interface IResultActionRequest {
  /* Which answer this is */
  action: ResultAction;

  /* The operation this press belongs to, from first attempt to resolved outcome */
  clientOperationId: string;

  /* The revision the page was showing when it was pressed */
  expectedRevision: number;

  /* The words a dispute carried, or null */
  note: string | null;
}

/**
 * What a pressed action is doing, and what it is still holding
 * @public
 */
export interface IResultActionState {
  /* Which action this is about, or null when nothing has been pressed */
  action: ResultAction | null;

  /* What to tell the person, or null when there is nothing to say */
  message: string | null;

  /* Where it has got to */
  phase: ResultActionPhase;

  /**
   * Whether this press is a check on an earlier answer rather than a new one.
   *
   * Carried on the state because the phase cannot say it: a check in flight is SENDING like any other press, and
   * what it may conclude from a refusal is entirely different
   */
  recovering: boolean;

  /**
   * The request this press made, held from the press until the outcome is known.
   *
   * Held whole rather than by its operation id alone: a retry has to re-send the body the first attempt sent, or
   * the server cannot recognize it as the same operation
   */
  request: IResultActionRequest | null;

  /**
   * The endpoint the request was sent to, whole.
   *
   * Held rather than the pieces it is built from, for the same reason as the body: a page that re-read between the
   * press and the retry may be showing a different match in a different league, and a URL reassembled from those
   * would aim the retry at a target the original operation was never made against. One field cannot be
   * half-remembered the way two can
   */
  endpoint: string | null;
}

/**
 * What each action's button says
 * @public
 * @constant
 */
export const ACTION_LABEL: Record<ResultAction, string> = {
  [ResultAction.CONFIRM]: 'Confirm result',
  [ResultAction.DISPUTE]: 'Dispute result',
  [ResultAction.VOID]: 'Void this result',
};

/**
 * What the control that opens a correction reads.
 *
 * Not one of the answers: amending is a navigation to the Record page in Amend mode, not a write this page makes.
 * It sits beside them because it is one of the two resolutions a disputed result offers (page spec, Game, Actions)
 * @public
 * @constant
 */
export const AMEND_LABEL: string = 'Amend result';

/**
 * What the void dialog asks before anything is sent
 * @public
 * @constant
 */
export const VOID_QUESTION: string = 'Void this result? It stops counting and cannot be undone.';

/**
 * What an outcome nobody can be sure of says.
 *
 * Deliberately not an error: the write may have committed, and telling somebody it failed would invite a second
 * one. Check re-sends the same request, which the server answers from the first attempt's receipt
 * @public
 * @constant
 */
export const UNCERTAIN_MESSAGE: string = 'This may not have gone through. Check';

/**
 * What a result that moved underneath the page says
 * @public
 * @constant
 */
export const CONFLICT_MESSAGE: string = 'This result changed while you were looking at it.';

/**
 * What a refusal that arrived without a message of its own says
 * @public
 * @constant
 */
export const REFUSED_MESSAGE: string = 'Pongifi could not save this right now.';

/**
 * What is added when a check itself was refused.
 *
 * A refused check says nothing about the answer it was checking on. Every refusal the page can recognize from the
 * outside — a spent write allowance, an ended session, a membership since lost — is decided before the server ever
 * looks for the earlier operation's receipt, so it establishes only that the check did not run
 * @public
 * @constant
 */
export const STILL_UNRESOLVED_MESSAGE: string = 'Your earlier answer may still have gone through. Check again.';

/**
 * Nothing pressed, nothing outstanding
 * @public
 * @function
 * @returns The state a page starts in, and returns to
 */
export function idleAction(): IResultActionState {
  return {
    action: null,
    endpoint: null,
    message: null,
    phase: ResultActionPhase.IDLE,
    recovering: false,
    request: null,
  };
}

/**
 * The state a press starts in.
 *
 * A retry of an uncertain action re-sends the request it was pressed with, to the endpoint it was sent to; a
 * fresh press takes the new one. That is the whole difference between asking the server "did my answer land?" and
 * asking it to answer again
 * @public
 * @function
 * @param state - Where the page is now
 * @param request - The request this press would make, used only when this is not a retry
 * @param endpoint - Where this press would be sent, used only when this is not a retry
 * @returns The state while it is in flight
 */
export function startAction(
  state: IResultActionState,
  request: IResultActionRequest,
  endpoint: string,
): IResultActionState {
  const retrying: boolean = state.phase === ResultActionPhase.UNCERTAIN && state.action === request.action;

  return {
    action: request.action,
    endpoint: retrying ? state.endpoint : endpoint,
    message: null,
    phase: ResultActionPhase.SENDING,
    recovering: retrying,
    request: retrying ? state.request : request,
  };
}

/**
 * Reads the message a refusal carried, preferring the server's words to ours.
 *
 * The server writes these for the person who pressed the button, so a refusal that brought one says it rather than
 * a generic line
 * @internal
 * @function
 * @param error - The rejection
 * @returns What to show
 */
function messageOf(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return REFUSED_MESSAGE;
  }

  const { data, statusMessage } = error as { data?: { message?: unknown }; statusMessage?: unknown };
  const carried: unknown = data?.message ?? statusMessage;

  return typeof carried === 'string' && carried.length > 0 ? carried : REFUSED_MESSAGE;
}

/**
 * Where a failed press leaves the page.
 *
 * A conflict is not a failure the person caused and not one they can retry: the result moved, and the server decided
 * that under the match's lock having already consulted the operation's receipt — so it is an authoritative answer
 * about this press too, and the page redraws to what is there now.
 *
 * Nothing else is authoritative. A spent write allowance, an ended session and a membership since lost are all
 * decided before the server looks for a receipt, so an answer that was already uncertain stays uncertain through
 * them: the page says why the check could not run and keeps holding the request, rather than inventing an outcome
 * for an answer that may well have landed
 * @public
 * @function
 * @param state - The state the press was made from
 * @param error - The rejection
 * @returns Where the page goes
 */
export function failAction(state: IResultActionState, error: unknown): IResultActionState {
  const failure: WriteFailure = classifyWriteFailure(error);

  if (failure === WriteFailure.UNCERTAIN) {
    return {
      ...state,
      message: UNCERTAIN_MESSAGE,
      phase: ResultActionPhase.UNCERTAIN,
    };
  }

  if (failure === WriteFailure.CONFLICT) {
    return {
      action: state.action,
      endpoint: null,
      message: CONFLICT_MESSAGE,
      phase: ResultActionPhase.CONFLICT,
      recovering: false,
      request: null,
    };
  }

  // A refused check resolves nothing; the earlier answer is still outstanding and the page keeps holding it. Read
  // from both, because a check that is still in flight is SENDING and only `recovering` says what it is
  if (state.recovering || state.phase === ResultActionPhase.UNCERTAIN) {
    return {
      ...state,
      message: `${messageOf(error)} ${STILL_UNRESOLVED_MESSAGE}`,
      phase: ResultActionPhase.UNCERTAIN,
    };
  }

  return {
    action: state.action,
    endpoint: null,
    message: messageOf(error),
    phase: ResultActionPhase.REFUSED,
    recovering: false,
    request: null,
  };
}

/**
 * Whether everything else on the page has to wait.
 *
 * An action in flight, and one whose outcome is unknown, both hold the page: pressing Void while a Confirm may or
 * may not have landed is how somebody ends up having done both
 * @public
 * @function
 * @param state - Where the page is now
 * @returns Whether the other actions are unavailable
 */
export function actionsBlocked(state: IResultActionState): boolean {
  return state.phase === ResultActionPhase.SENDING || state.phase === ResultActionPhase.UNCERTAIN;
}

/**
 * Whether this action's own button is the one that resolves an uncertain outcome
 * @public
 * @function
 * @param state - Where the page is now
 * @param action - The button being drawn
 * @returns Whether this button reads Check rather than its own label
 */
export function awaitingCheck(state: IResultActionState, action: ResultAction): boolean {
  return state.phase === ResultActionPhase.UNCERTAIN && state.action === action;
}
