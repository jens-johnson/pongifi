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
 * ████████████████████████████████████████ #server/utils/results/http.test.ts █████████████████████████████████████████
 *
 * Unit tests for how a refused result write is answered.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { H3Error, H3Event } from 'h3';
import { describe, expect, it, vi } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { ResultRefusal } from './enums';
import type { IResultRefusalResponse } from './http';
import { answerResultRefusal, RESULT_REFUSAL_MESSAGE, RESULT_REFUSAL_STATUS } from './http';
import type { IResultCurrentState } from './types';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Where a match stands, as a conflict carries it
 * @internal
 * @constant
 */
const CURRENT: IResultCurrentState = {
  canonicalMatchId: 'b5e2d1ef-0000-4000-8000-000000000002',
  revision: 2,
  resultRevisionId: 'c6f3e2a0-0000-4000-8000-000000000003',
  state: 'DISPUTED' as IResultCurrentState['state'],
};

/**
 * An event whose status the answer records
 * @internal
 * @function
 * @returns The event
 */
function buildEvent(): H3Event {
  return { node: { res: {} } } as unknown as H3Event;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(answerResultRefusal), (): void => {
    it('answers a conflict as a body carrying where the match stands now', (): void => {
      const event: H3Event = buildEvent();
      const answer: IResultRefusalResponse = answerResultRefusal(event, ResultRefusal.STALE_RESULT, CURRENT);

      // A thrown error carries a message alone, and a page told only that it is stale has nothing to redraw to
      expect(answer).toEqual({
        current: CURRENT,
        message: RESULT_REFUSAL_MESSAGE[ResultRefusal.STALE_RESULT],
        refusal: ResultRefusal.STALE_RESULT,
        statusCode: 409,
      });
    });

    it('keeps the four conflicts apart by name rather than by status', (): void => {
      const conflicts: ResultRefusal[] = [
        ResultRefusal.ALREADY_ANSWERED,
        ResultRefusal.OPERATION_BODY_CHANGED,
        ResultRefusal.STALE_LEAGUE_RULES,
        ResultRefusal.STALE_RESULT,
      ];
      const answered: IResultRefusalResponse[] = conflicts.map((refusal: ResultRefusal): IResultRefusalResponse =>
        answerResultRefusal(buildEvent(), refusal),
      );

      expect(answered.map((answer): number => answer.statusCode)).toEqual([409, 409, 409, 409]);
      expect(answered.map((answer): ResultRefusal => answer.refusal)).toEqual(conflicts);
      expect(new Set(answered.map((answer): string => answer.message)).size).toBe(conflicts.length);
    });

    it('throws every refusal that leaves the page nothing to render but the message', (): void => {
      const thrown: ResultRefusal[] = [
        ResultRefusal.FORBIDDEN,
        ResultRefusal.INVALID_SUBMISSION,
        ResultRefusal.NOT_FOUND,
        ResultRefusal.SEAT_NOT_A_MEMBER,
        ResultRefusal.UNPLAYABLE,
      ];

      for (const refusal of thrown) {
        expect((): unknown => answerResultRefusal(buildEvent(), refusal)).toThrowError(
          expect.objectContaining({ statusCode: RESULT_REFUSAL_STATUS[refusal] } satisfies Partial<H3Error>),
        );
      }
    });

    it('names a status and a sentence for every refusal the service can give', (): void => {
      // A refusal added to the service without an answer here would reach a page as an unhandled 500
      for (const refusal of Object.values(ResultRefusal)) {
        expect(RESULT_REFUSAL_STATUS[refusal]).toBeTypeOf('number');
        expect(RESULT_REFUSAL_MESSAGE[refusal]?.length).toBeGreaterThan(0);
      }
    });

    it('says nothing about a match the caller may not see', (): void => {
      // The 404 a non-member gets for a result has to read like the 404 for a league that does not exist
      expect((): unknown => answerResultRefusal(buildEvent(), ResultRefusal.NOT_FOUND)).toThrowError(
        expect.objectContaining({ statusCode: 404 } satisfies Partial<H3Error>),
      );
      expect(RESULT_REFUSAL_MESSAGE[ResultRefusal.NOT_FOUND]).not.toMatch(/revision|league|member/i);
    });
  });
});

vi.mock('h3', async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
  ...(await importOriginal()),
  setResponseStatus: vi.fn(),
}));
