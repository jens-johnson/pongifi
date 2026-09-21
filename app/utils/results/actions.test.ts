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
 * ██████████████████████████████████████████ #utils/results/actions.test.ts ███████████████████████████████████████████
 *
 * Unit tests for what a pressed result action holds, and what it lets the page do next.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { ResultAction } from '#shared/results';
import { symbolName } from '#shared/utils/symbol';

import type { IResultActionRequest, IResultActionState } from './actions';
import {
  actionsBlocked,
  awaitingCheck,
  CONFLICT_MESSAGE,
  failAction,
  idleAction,
  REFUSED_MESSAGE,
  ResultActionPhase,
  startAction,
  STILL_UNRESOLVED_MESSAGE,
  UNCERTAIN_MESSAGE,
} from './actions';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The operation a first press takes
 * @internal
 * @constant
 */
const FIRST: string = 'a4f1c0de-0000-4000-8000-000000000001';

/**
 * The operation a later press would take, if it were a new one
 * @internal
 * @constant
 */
const SECOND: string = 'b5e2d1ef-0000-4000-8000-000000000002';

/**
 * The match a press is aimed at
 * @internal
 * @constant
 */
const MATCH: string = 'd7a4f3b1-0000-4000-8000-000000000004';

/**
 * What a spent write allowance says
 * @internal
 * @constant
 */
const TOO_MANY: string = 'Too many saves.';

/**
 * A match the page moved on to
 * @internal
 * @constant
 */
const LATER_MATCH: string = 'e8b5a4c2-0000-4000-8000-000000000005';

/**
 * A request of the shape a press makes
 * @internal
 * @function
 * @param action - Which answer
 * @param overrides - What the case changes
 * @returns The request
 */
function request(action: ResultAction, overrides: Partial<IResultActionRequest> = {}): IResultActionRequest {
  return {
    action,
    clientOperationId: FIRST,
    expectedRevision: 3,
    note: null,
    ...overrides,
  };
}

/**
 * A rejection carrying a status, as the fetch layer raises it
 * @internal
 * @function
 * @param statusCode - What the server answered
 * @param message - What it said, if anything
 * @returns The rejection
 */
function rejection(statusCode: number, message: string | null = null): unknown {
  return { data: message === null ? undefined : { message }, statusCode };
}

/**
 * An answer whose outcome nobody can be sure of
 * @internal
 * @function
 * @param action - Which answer was pressed
 * @returns The state the page is left in
 */
function uncertain(action: ResultAction = ResultAction.CONFIRM): IResultActionState {
  return failAction(startAction(idleAction(), request(action), MATCH), rejection(502));
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(startAction), (): void => {
    it('takes the request it was given for a first press', (): void => {
      const state: IResultActionState = startAction(idleAction(), request(ResultAction.CONFIRM), MATCH);

      expect(state).toMatchObject({
        action: ResultAction.CONFIRM,
        message: null,
        phase: ResultActionPhase.SENDING,
        targetMatchId: MATCH,
      });
      expect(state.request?.clientOperationId).toBe(FIRST);
    });

    it('re-sends the first attempt’s request, not one rebuilt from where the page is now', (): void => {
      // The server keys an operation on the id and a digest of the body. A check that rebuilt its body from a page
      // that has since re-read would carry a different revision, and be a conflict rather than the same operation
      const moved: IResultActionRequest = request(ResultAction.CONFIRM, {
        clientOperationId: SECOND,
        expectedRevision: 4,
      });
      const retried: IResultActionState = startAction(uncertain(), moved, LATER_MATCH);

      expect(retried.request).toEqual(request(ResultAction.CONFIRM));
      expect(retried.targetMatchId).toBe(MATCH);
    });

    it('holds a dispute’s original words through a check, whatever has been typed since', (): void => {
      const first: IResultActionState = failAction(
        startAction(idleAction(), request(ResultAction.DISPUTE, { note: 'that was not the score' }), MATCH),
        rejection(502),
      );
      const edited: IResultActionRequest = request(ResultAction.DISPUTE, {
        clientOperationId: SECOND,
        note: 'actually it was 11-9',
      });

      expect(startAction(first, edited, MATCH).request?.note).toBe('that was not the score');
    });

    it('takes a fresh request when a different action is pressed', (): void => {
      // A confirm that may have landed does not make a dispute part of the same operation
      const next: IResultActionRequest = request(ResultAction.DISPUTE, { clientOperationId: SECOND });

      expect(startAction(uncertain(), next, MATCH).request?.clientOperationId).toBe(SECOND);
    });

    it('clears a previous message so a refusal does not outlive the press it belonged to', (): void => {
      const refused: IResultActionState = failAction(
        startAction(idleAction(), request(ResultAction.CONFIRM), MATCH),
        rejection(403, 'Your role in this league does not allow that.'),
      );

      expect(startAction(refused, request(ResultAction.DISPUTE), MATCH).message).toBeNull();
    });
  });

  describe(symbolName(failAction), (): void => {
    it('keeps an uncertain outcome uncertain, and keeps its request', (): void => {
      // No answer and a 5xx are the same answer: it may have committed
      for (const error of [rejection(502), rejection(500), new Error('network down')]) {
        const state: IResultActionState = failAction(
          startAction(idleAction(), request(ResultAction.VOID), MATCH),
          error,
        );

        expect(state.phase).toBe(ResultActionPhase.UNCERTAIN);
        expect(state.message).toBe(UNCERTAIN_MESSAGE);
        expect(state.request?.clientOperationId).toBe(FIRST);
      }
    });

    it('leaves an answer outstanding when the check itself was refused', (): void => {
      // The write allowance, the session and the membership are all checked before the server looks for the earlier
      // operation's receipt. A refusal there proves the check did not run, and nothing about the answer it asked
      // about — so calling it resolved would invent an outcome
      for (const status of [429, 401, 403, 404, 400]) {
        const checked: IResultActionState = failAction(uncertain(), rejection(status, TOO_MANY));

        expect(checked.phase).toBe(ResultActionPhase.UNCERTAIN);
        expect(checked.request?.clientOperationId).toBe(FIRST);
        expect(checked.targetMatchId).toBe(MATCH);
        expect(checked.message).toContain(STILL_UNRESOLVED_MESSAGE);
      }
    });

    it('says why the check could not run as well as that it did not', (): void => {
      const checked: IResultActionState = failAction(uncertain(), rejection(429, TOO_MANY));

      expect(checked.message).toBe(`${TOO_MANY} ${STILL_UNRESOLVED_MESSAGE}`);
    });

    it('lets a conflict resolve an uncertainty, because the server decided it against the receipt', (): void => {
      // A conflict is reached under the match's lock, after the operation's receipt was consulted: a replayed
      // answer that had committed would have been answered from that receipt instead. It is an authoritative answer
      const checked: IResultActionState = failAction(uncertain(), rejection(409, 'You have already answered this.'));

      expect(checked.phase).toBe(ResultActionPhase.CONFLICT);
      expect(checked.request).toBeNull();
      expect(checked.targetMatchId).toBeNull();
    });

    it('drops the request on a conflict, because the result moved rather than the request failing', (): void => {
      const state: IResultActionState = failAction(
        startAction(idleAction(), request(ResultAction.CONFIRM), MATCH),
        rejection(409, 'You have already answered this result.'),
      );

      expect(state.phase).toBe(ResultActionPhase.CONFLICT);
      expect(state.message).toBe(CONFLICT_MESSAGE);
      expect(state.request).toBeNull();
    });

    it('prefers the server’s words to ours on a refusal', (): void => {
      const press: IResultActionState = startAction(idleAction(), request(ResultAction.VOID), MATCH);

      expect(failAction(press, rejection(403, 'Not your call.')).message).toBe('Not your call.');
      expect(failAction(press, rejection(422)).message).toBe(REFUSED_MESSAGE);
    });

    it('drops the request on a first refusal, since nothing was written', (): void => {
      const state: IResultActionState = failAction(
        startAction(idleAction(), request(ResultAction.DISPUTE), MATCH),
        rejection(422, 'That note is too long.'),
      );

      expect(state.phase).toBe(ResultActionPhase.REFUSED);
      expect(state.request).toBeNull();
    });
  });

  describe(symbolName(actionsBlocked), (): void => {
    it('holds the page while something is in flight or unresolved', (): void => {
      // Pressing Void while a Confirm may or may not have landed is how somebody ends up having done both
      expect(actionsBlocked(startAction(idleAction(), request(ResultAction.CONFIRM), MATCH))).toBe(true);
      expect(actionsBlocked(uncertain())).toBe(true);
    });

    it('keeps holding the page when a check was refused', (): void => {
      expect(actionsBlocked(failAction(uncertain(), rejection(429, TOO_MANY)))).toBe(true);
    });

    it('releases the page once the outcome is known, however it turned out', (): void => {
      const sending: IResultActionState = startAction(idleAction(), request(ResultAction.CONFIRM), MATCH);

      expect(actionsBlocked(idleAction())).toBe(false);
      expect(actionsBlocked(failAction(sending, rejection(409)))).toBe(false);
      expect(actionsBlocked(failAction(sending, rejection(403)))).toBe(false);
    });
  });

  describe(symbolName(awaitingCheck), (): void => {
    it('offers Check on the button that was pressed, and nowhere else', (): void => {
      expect(awaitingCheck(uncertain(), ResultAction.CONFIRM)).toBe(true);
      expect(awaitingCheck(uncertain(), ResultAction.DISPUTE)).toBe(false);
      expect(awaitingCheck(idleAction(), ResultAction.CONFIRM)).toBe(false);
    });

    it('keeps offering Check after the check was refused', (): void => {
      const checked: IResultActionState = failAction(uncertain(), rejection(429, TOO_MANY));

      expect(awaitingCheck(checked, ResultAction.CONFIRM)).toBe(true);
    });
  });
});
