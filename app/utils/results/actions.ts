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
 * action whose outcome is uncertain may have committed, so the operation id is held and every other action waits
 * until the person resolves it
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
 * What a pressed action is doing, and what it is still holding
 * @public
 */
export interface IResultActionState {
  /* Which action this is about, or null when nothing has been pressed */
  action: ResultAction | null;

  /* What to tell the person, or null when there is nothing to say */
  message: string | null;

  /**
   * The operation this press belongs to, held from the press until the outcome is known.
   *
   * Kept across a retry on purpose: the same id is what lets the server answer a second attempt from the first
   * attempt's receipt rather than acting twice
   */
  operationId: string | null;

  /* Where it has got to */
  phase: ResultActionPhase;
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
 * What the void dialog asks before anything is sent
 * @public
 * @constant
 */
export const VOID_QUESTION: string = 'Void this result? It stops counting and cannot be undone.';

/**
 * What an outcome nobody can be sure of says.
 *
 * Deliberately not an error: the write may have committed, and telling somebody it failed would invite a second
 * one. Check re-reads the result and shows them what is actually there
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
 * Nothing pressed, nothing outstanding
 * @public
 * @function
 * @returns The state a page starts in, and returns to
 */
export function idleAction(): IResultActionState {
  return {
    action: null,
    message: null,
    operationId: null,
    phase: ResultActionPhase.IDLE,
  };
}

/**
 * The state a press starts in.
 *
 * A retry of an uncertain action keeps the id it was pressed with; a fresh press takes a new one. That is the whole
 * difference between asking the server "did my action land?" and asking it to act again
 * @public
 * @function
 * @param state - Where the page is now
 * @param action - What was pressed
 * @param operationId - A fresh operation id, used only when this is not a retry of the same action
 * @returns The state while it is in flight
 */
export function startAction(state: IResultActionState, action: ResultAction, operationId: string): IResultActionState {
  const retrying: boolean = state.phase === ResultActionPhase.UNCERTAIN && state.action === action;

  return {
    action,
    message: null,
    operationId: retrying ? state.operationId : operationId,
    phase: ResultActionPhase.SENDING,
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

  const { data, statusMessage }: { data?: { message?: unknown }; statusMessage?: unknown } = error as {
    data?: { message?: unknown };
    statusMessage?: unknown;
  };
  const carried: unknown = data?.message ?? statusMessage;

  return typeof carried === 'string' && carried.length > 0 ? carried : REFUSED_MESSAGE;
}

/**
 * Where a failed press leaves the page.
 *
 * A conflict is not a failure the person caused and not one they can retry: the result moved, so the page redraws
 * to what is there now and they choose again. An uncertain outcome keeps its operation id so that pressing again
 * asks about the same operation rather than starting a second one
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
      message: CONFLICT_MESSAGE,
      operationId: null,
      phase: ResultActionPhase.CONFLICT,
    };
  }

  return {
    action: state.action,
    message: messageOf(error),
    operationId: null,
    phase: ResultActionPhase.REFUSED,
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
