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

import type { IResultActionState } from './actions';
import {
  actionsBlocked,
  awaitingCheck,
  CONFLICT_MESSAGE,
  failAction,
  idleAction,
  REFUSED_MESSAGE,
  ResultActionPhase,
  startAction,
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

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(startAction), (): void => {
    it('takes a fresh operation for a first press', (): void => {
      const state: IResultActionState = startAction(idleAction(), ResultAction.CONFIRM, FIRST);

      expect(state).toMatchObject({
        action: ResultAction.CONFIRM,
        message: null,
        operationId: FIRST,
        phase: ResultActionPhase.SENDING,
      });
    });

    it('keeps the operation when the same action is pressed again after an uncertain outcome', (): void => {
      // The whole point of Check: asking the server about the operation that may already have landed, rather than
      // starting a second one that would act twice
      const uncertain: IResultActionState = failAction(
        startAction(idleAction(), ResultAction.CONFIRM, FIRST),
        rejection(502),
      );

      expect(startAction(uncertain, ResultAction.CONFIRM, SECOND).operationId).toBe(FIRST);
    });

    it('takes a fresh operation when a different action is pressed', (): void => {
      // A confirm that may have landed does not make a dispute part of the same operation
      const uncertain: IResultActionState = failAction(
        startAction(idleAction(), ResultAction.CONFIRM, FIRST),
        rejection(502),
      );

      expect(startAction(uncertain, ResultAction.DISPUTE, SECOND).operationId).toBe(SECOND);
    });

    it('clears a previous message so a refusal does not outlive the press it belonged to', (): void => {
      const refused: IResultActionState = failAction(
        startAction(idleAction(), ResultAction.CONFIRM, FIRST),
        rejection(403, 'Your role in this league does not allow that.'),
      );

      expect(startAction(refused, ResultAction.DISPUTE, SECOND).message).toBeNull();
    });
  });

  describe(symbolName(failAction), (): void => {
    it('keeps an uncertain outcome uncertain, and keeps its operation', (): void => {
      // No answer and a 5xx are the same answer: it may have committed
      for (const error of [rejection(502), rejection(500), new Error('network down')]) {
        const state: IResultActionState = failAction(startAction(idleAction(), ResultAction.VOID, FIRST), error);

        expect(state.phase).toBe(ResultActionPhase.UNCERTAIN);
        expect(state.message).toBe(UNCERTAIN_MESSAGE);
        expect(state.operationId).toBe(FIRST);
      }
    });

    it('drops the operation on a conflict, because the result moved rather than the request failing', (): void => {
      const state: IResultActionState = failAction(
        startAction(idleAction(), ResultAction.CONFIRM, FIRST),
        rejection(409, 'You have already answered this result.'),
      );

      expect(state.phase).toBe(ResultActionPhase.CONFLICT);
      expect(state.message).toBe(CONFLICT_MESSAGE);
      expect(state.operationId).toBeNull();
    });

    it('prefers the server’s words to ours on a refusal', (): void => {
      // The server writes these for the person who pressed the button; ours is only for a refusal that brought none
      expect(
        failAction(startAction(idleAction(), ResultAction.VOID, FIRST), rejection(403, 'Not your call.')).message,
      ).toBe('Not your call.');
      expect(failAction(startAction(idleAction(), ResultAction.VOID, FIRST), rejection(422)).message).toBe(
        REFUSED_MESSAGE,
      );
    });

    it('drops the operation on a plain refusal, since nothing was written', (): void => {
      const state: IResultActionState = failAction(
        startAction(idleAction(), ResultAction.DISPUTE, FIRST),
        rejection(422, 'That note is too long.'),
      );

      expect(state.phase).toBe(ResultActionPhase.REFUSED);
      expect(state.operationId).toBeNull();
    });
  });

  describe(symbolName(actionsBlocked), (): void => {
    it('holds the page while something is in flight or unresolved', (): void => {
      // Pressing Void while a Confirm may or may not have landed is how somebody ends up having done both
      const sending: IResultActionState = startAction(idleAction(), ResultAction.CONFIRM, FIRST);

      expect(actionsBlocked(sending)).toBe(true);
      expect(actionsBlocked(failAction(sending, rejection(502)))).toBe(true);
    });

    it('releases the page once the outcome is known, however it turned out', (): void => {
      const sending: IResultActionState = startAction(idleAction(), ResultAction.CONFIRM, FIRST);

      expect(actionsBlocked(idleAction())).toBe(false);
      expect(actionsBlocked(failAction(sending, rejection(409)))).toBe(false);
      expect(actionsBlocked(failAction(sending, rejection(403)))).toBe(false);
    });
  });

  describe(symbolName(awaitingCheck), (): void => {
    it('offers Check on the button that was pressed, and nowhere else', (): void => {
      const uncertain: IResultActionState = failAction(
        startAction(idleAction(), ResultAction.CONFIRM, FIRST),
        rejection(502),
      );

      expect(awaitingCheck(uncertain, ResultAction.CONFIRM)).toBe(true);
      expect(awaitingCheck(uncertain, ResultAction.DISPUTE)).toBe(false);
      expect(awaitingCheck(idleAction(), ResultAction.CONFIRM)).toBe(false);
    });
  });
});
