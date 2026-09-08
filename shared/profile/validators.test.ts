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
 * ████████████████████████████████████████ #shared/profile/validators.test.ts █████████████████████████████████████████
 *
 * Unit tests for display name validation and its boundaries.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { DISPLAY_NAME_EMPTY_MESSAGE, DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_TOO_LONG_MESSAGE } from './constants';
import { validateDisplayName } from './validators';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * An ordinary display name, used wherever the case under test is not about the name itself
 * @internal
 * @constant
 */
const ORDINARY_NAME: string = 'Maya Rodriguez';

/**
 * A name of exactly the maximum length, which is accepted rather than refused
 * @internal
 * @constant
 */
const LONGEST_ACCEPTED_NAME: string = 'a'.repeat(DISPLAY_NAME_MAX_LENGTH);

/**
 * A name one character past the maximum
 * @internal
 * @constant
 */
const FIRST_REFUSED_NAME: string = 'a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1);

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(validateDisplayName), (): void => {
    it('accepts an ordinary name and returns it unchanged', (): void => {
      expect(validateDisplayName(ORDINARY_NAME)).toEqual({ ok: true, value: ORDINARY_NAME });
    });

    it('trims surrounding whitespace before storing the name', (): void => {
      expect(validateDisplayName(`  ${ORDINARY_NAME}  `)).toEqual({ ok: true, value: ORDINARY_NAME });
    });

    it('keeps the punctuation and spacing players use inside a nickname', (): void => {
      expect(validateDisplayName('Maya "Topspin" R.')).toEqual({ ok: true, value: 'Maya "Topspin" R.' });
    });

    it('refuses an empty name', (): void => {
      expect(validateDisplayName('')).toEqual({ ok: false, message: DISPLAY_NAME_EMPTY_MESSAGE });
    });

    it('refuses a name that is only whitespace', (): void => {
      expect(validateDisplayName('   \t  ')).toEqual({ ok: false, message: DISPLAY_NAME_EMPTY_MESSAGE });
    });

    it('refuses a value that is not a string at all', (): void => {
      expect(validateDisplayName({ displayName: 'Maya' })).toEqual({
        ok: false,
        message: DISPLAY_NAME_EMPTY_MESSAGE,
      });
    });

    it('refuses a missing value', (): void => {
      expect(validateDisplayName(undefined)).toEqual({ ok: false, message: DISPLAY_NAME_EMPTY_MESSAGE });
    });

    it('accepts a name of exactly the maximum length', (): void => {
      expect(validateDisplayName(LONGEST_ACCEPTED_NAME)).toEqual({ ok: true, value: LONGEST_ACCEPTED_NAME });
    });

    it('refuses a name one character past the maximum', (): void => {
      expect(validateDisplayName(FIRST_REFUSED_NAME)).toEqual({
        ok: false,
        message: DISPLAY_NAME_TOO_LONG_MESSAGE,
      });
    });

    it('measures length after trimming, so padding cannot push a valid name over the limit', (): void => {
      expect(validateDisplayName(`   ${LONGEST_ACCEPTED_NAME}   `)).toEqual({
        ok: true,
        value: LONGEST_ACCEPTED_NAME,
      });
    });
  });
});
