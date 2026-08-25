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
 * █████████████████████████████████████████ #server/utils/http/utils.test.ts ██████████████████████████████████████████
 *
 * Unit tests for the upstream guard: passthrough, 502 translation with cause, and h3-error passthrough.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { isError } from 'h3';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { runUpstream } from './utils';

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(runUpstream), (): void => {
    it('passes the resolved value through untouched', async (): Promise<void> => {
      await expect(runUpstream(Promise.resolve({ id: 7 }), 'unused')).resolves.toEqual({ id: 7 });
    });

    it('translates an unexpected rejection into a 502 with the given message and cause', async (): Promise<void> => {
      const failure: Error = new Error('socket hang up');

      try {
        await runUpstream(Promise.reject(failure), 'Upstream call failed.');
        expect.unreachable('the guard must rethrow');
      } catch (error: unknown) {
        // The rejection surfaces as a clean gateway error carrying the original failure as its cause
        expect(isError(error)).toBe(true);
        expect(error).toMatchObject({
          statusCode: 502,
          statusMessage: 'Upstream call failed.',
          cause: failure,
        });
      }
    });

    it('lets a deliberate h3 error pass through without double-wrapping', async (): Promise<void> => {
      const deliberate = { statusCode: 409, statusMessage: 'Conflict.' };
      const { createError } = await import('h3');

      await expect(runUpstream(Promise.reject(createError(deliberate)), 'unused')).rejects.toMatchObject(deliberate);
    });
  });
});
