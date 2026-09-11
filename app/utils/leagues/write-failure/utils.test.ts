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
 * ████████████████████████████████████ #utils/leagues/write-failure/utils.test.ts █████████████████████████████████████
 *
 * Unit tests for the write failure classifier.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { WriteFailure } from './enums';
import { classifyWriteFailure } from './utils';

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(classifyWriteFailure), (): void => {
    it('reads a lost answer and a server failure as uncertain', (): void => {
      expect(classifyWriteFailure(new TypeError('Failed to fetch'))).toBe(WriteFailure.UNCERTAIN);
      expect(classifyWriteFailure({ statusCode: 502 })).toBe(WriteFailure.UNCERTAIN);
      expect(classifyWriteFailure({ response: { status: 504 } })).toBe(WriteFailure.UNCERTAIN);
      expect(classifyWriteFailure(null)).toBe(WriteFailure.UNCERTAIN);
    });

    it('names the refusals a page treats differently, and reads every other 4xx as a plain refusal', (): void => {
      expect(classifyWriteFailure({ statusCode: 401 })).toBe(WriteFailure.UNAUTHORIZED);
      expect(classifyWriteFailure({ statusCode: 403 })).toBe(WriteFailure.FORBIDDEN);
      expect(classifyWriteFailure({ statusCode: 404 })).toBe(WriteFailure.NOT_FOUND);
      expect(classifyWriteFailure({ statusCode: 409 })).toBe(WriteFailure.CONFLICT);
      expect(classifyWriteFailure({ statusCode: 429 })).toBe(WriteFailure.RATE_LIMITED);
      expect(classifyWriteFailure({ statusCode: 422 })).toBe(WriteFailure.REFUSED);
    });
  });
});
