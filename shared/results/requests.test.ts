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
 * █████████████████████████████████████████ #shared/results/requests.test.ts ██████████████████████████████████████████
 *
 * Unit tests for the envelope around a result request: what this page sends, and what it refuses.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { ResultAction, ResultEnding, Seat } from './enums';
import type { IAmendRequestBody, IAnswerRequestBody, IRecordRequestBody, TRequestValidation } from './requests';
import { validateAmendBody, validateAnswerBody, validateRecordBody } from './requests';
import type { IResultSubmission } from './types';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * An operation id of the shape a page generates
 * @internal
 * @constant
 */
const OPERATION: string = '3f1d4f2e-0f3a-4a1e-9f0b-2c9d5a7e1b44';

/**
 * A second one, for the cases about which id a body carries
 * @internal
 * @constant
 */
const OTHER: string = '9a0f7c21-77f7-4f7a-b3d1-6a1f0c2e5d38';

/**
 * A submission of the shape the form sends. What its values may be is `findSubmissionProblem`'s question; these cases
 * are about the envelope around it
 * @internal
 * @function
 * @returns The submission
 */
function submission(): IResultSubmission {
  return {
    ending: ResultEnding.COMPLETED,
    gameType: 'SINGLES' as IResultSubmission['gameType'],
    games: [
      {
        a: 11,
        b: 4,
        gameNumber: 1,
      },
    ],
    playedAt: '2026-09-20T12:00:00.000Z',
    retiredSeat: null,
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: OPERATION,
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: OTHER,
      },
    ],
  };
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(validateRecordBody), (): void => {
    it('reads a body the form sends', (): void => {
      const outcome: TRequestValidation<IRecordRequestBody> = validateRecordBody({
        acknowledgement: 'a3f1c0de',
        clientOperationId: OPERATION,
        expectedLeagueRevision: 3,
        submission: submission(),
      });

      expect(outcome.ok && outcome.value.clientOperationId).toBe(OPERATION);
      expect(outcome.ok && outcome.value.acknowledgement).toBe('a3f1c0de');
      expect(outcome.ok && outcome.value.expectedLeagueRevision).toBe(3);
    });

    it('treats an absent acknowledgement as having been shown nothing', (): void => {
      // The direction that warns rather than the one that writes: a body that forgets this field gets the warning
      const outcome: TRequestValidation<IRecordRequestBody> = validateRecordBody({
        clientOperationId: OPERATION,
        expectedLeagueRevision: 1,
        submission: submission(),
      });

      expect(outcome.ok && outcome.value.acknowledgement).toBeNull();
    });

    it('refuses a body carrying a key this request does not own', (): void => {
      // A body written by something other than this page. Accepting it quietly would let a field name mean two
      // things the first time somebody adds one
      const outcome: TRequestValidation<IRecordRequestBody> = validateRecordBody({
        clientOperationId: OPERATION,
        expectedLeagueRevision: 1,
        settingsSnapshot: { targetScore: 11 },
        submission: submission(),
      });

      expect(outcome).toEqual({
        message: expect.any(String),
        ok: false,
        statusCode: 400,
      });
    });

    it('refuses an operation id, a revision or a submission that is not one', (): void => {
      const bodies: unknown[] = [
        {
          clientOperationId: 'not-a-uuid',
          expectedLeagueRevision: 1,
          submission: submission(),
        },
        {
          clientOperationId: OPERATION,
          expectedLeagueRevision: 0,
          submission: submission(),
        },
        {
          clientOperationId: OPERATION,
          expectedLeagueRevision: 1.5,
          submission: submission(),
        },
        {
          clientOperationId: OPERATION,
          expectedLeagueRevision: 1,
          submission: { games: [] },
        },
        {
          clientOperationId: OPERATION,
          expectedLeagueRevision: 1,
          submission: 'a result',
        },
        [],
        null,
      ];

      expect(bodies.map((body: unknown): boolean => validateRecordBody(body).ok)).toEqual(
        bodies.map((): false => false),
      );
    });

    it('refuses an acknowledgement that is not a token', (): void => {
      const outcome: TRequestValidation<IRecordRequestBody> = validateRecordBody({
        acknowledgement: { canonicalMatchId: OTHER },
        clientOperationId: OPERATION,
        expectedLeagueRevision: 1,
        submission: submission(),
      });

      expect(outcome.ok).toBe(false);
    });
  });

  describe(symbolName(validateAmendBody), (): void => {
    it('reads a body carrying the revision it expects', (): void => {
      const outcome: TRequestValidation<IAmendRequestBody> = validateAmendBody({
        clientOperationId: OPERATION,
        expectedRevision: 2,
        submission: submission(),
      });

      expect(outcome.ok && outcome.value.expectedRevision).toBe(2);
    });

    it('refuses a league revision in place of a result revision', (): void => {
      // The two are different counters and an amendment is judged against the result's; a body that named the
      // league's would be checked against the wrong thing
      const outcome: TRequestValidation<IAmendRequestBody> = validateAmendBody({
        clientOperationId: OPERATION,
        expectedLeagueRevision: 2,
        submission: submission(),
      });

      expect(outcome.ok).toBe(false);
    });
  });

  describe(symbolName(validateAnswerBody), (): void => {
    it('reads each of the three answers', (): void => {
      const answers: TRequestValidation<IAnswerRequestBody>[] = Object.values(ResultAction).map(
        (action: ResultAction): TRequestValidation<IAnswerRequestBody> =>
          validateAnswerBody({
            action,
            clientOperationId: OPERATION,
            expectedRevision: 1,
            note: null,
          }),
      );

      expect(answers.map((answer): unknown => answer.ok && answer.value.action)).toEqual(Object.values(ResultAction));
    });

    it('carries a note through without judging its length', (): void => {
      // Over-long is a 422 with a field message, not a body nobody can read; what is kept here is one character more
      // than the column holds, which is exactly what the service needs to see to refuse it
      const outcome: TRequestValidation<IAnswerRequestBody> = validateAnswerBody({
        action: ResultAction.DISPUTE,
        clientOperationId: OPERATION,
        expectedRevision: 1,
        note: 'x'.repeat(400),
      });

      expect(outcome.ok && outcome.value.note?.length).toBe(281);
    });

    it('refuses an action this page does not have', (): void => {
      const outcome: TRequestValidation<IAnswerRequestBody> = validateAnswerBody({
        action: 'AMEND',
        clientOperationId: OPERATION,
        expectedRevision: 1,
        note: null,
      });

      expect(outcome.ok).toBe(false);
    });
  });
});
