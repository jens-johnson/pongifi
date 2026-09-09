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

import {
  DISPLAY_NAME_EMPTY_MESSAGE,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_REJECTED_STATUS,
  DISPLAY_NAME_TOO_LONG_MESSAGE,
  PROFILE_BODY_REJECTED_STATUS,
  PROFILE_BODY_SHAPE_MESSAGE,
  PROFILE_BODY_UNKNOWN_FIELD_MESSAGE,
} from './constants';
import type { IProfileWriteBodyFailure, TProfileWriteBodyResult } from './types';
import { validateDisplayName, validateProfileWriteBody } from './validators';

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

  describe(symbolName(validateProfileWriteBody), (): void => {
    it('accepts a body carrying only the allowlisted field', (): void => {
      expect(validateProfileWriteBody({ displayName: ORDINARY_NAME })).toEqual({ ok: true, value: ORDINARY_NAME });
    });

    it('trims the name it returns, so the endpoints persist what the validator approved', (): void => {
      expect(validateProfileWriteBody({ displayName: `  ${ORDINARY_NAME}  ` })).toEqual({
        ok: true,
        value: ORDINARY_NAME,
      });
    });

    it('rejects a body carrying a field the endpoint does not accept', (): void => {
      // Filtering would answer 200 while silently dropping the field the client cared about
      expect(validateProfileWriteBody({ displayName: ORDINARY_NAME, email: 'attacker@example.com' })).toEqual({
        ok: false,
        message: PROFILE_BODY_UNKNOWN_FIELD_MESSAGE,
        statusCode: PROFILE_BODY_REJECTED_STATUS,
      });
    });

    it('does not echo a rejected field name back into the message', (): void => {
      const result: TProfileWriteBodyResult = validateProfileWriteBody({ '<img src=x>': 'anything' });

      expect(result.ok).toBe(false);
      expect((result as IProfileWriteBodyFailure).message).not.toContain('<img');
    });

    it('rejects a body that is not an object', (): void => {
      expect(validateProfileWriteBody('Maya')).toEqual({
        ok: false,
        message: PROFILE_BODY_SHAPE_MESSAGE,
        statusCode: PROFILE_BODY_REJECTED_STATUS,
      });
    });

    it('rejects a null body, which typeof alone would call an object', (): void => {
      expect(validateProfileWriteBody(null)).toEqual({
        ok: false,
        message: PROFILE_BODY_SHAPE_MESSAGE,
        statusCode: PROFILE_BODY_REJECTED_STATUS,
      });
    });

    it('rejects an array body, whose indices would otherwise read as unknown fields', (): void => {
      expect(validateProfileWriteBody([ORDINARY_NAME])).toEqual({
        ok: false,
        message: PROFILE_BODY_SHAPE_MESSAGE,
        statusCode: PROFILE_BODY_REJECTED_STATUS,
      });
    });

    it('refuses an unusable name with the name rule status, not the malformed-body status', (): void => {
      expect(validateProfileWriteBody({ displayName: '   ' })).toEqual({
        ok: false,
        message: DISPLAY_NAME_EMPTY_MESSAGE,
        statusCode: DISPLAY_NAME_REJECTED_STATUS,
      });
    });

    it('treats a body with no fields at all as a well-formed request holding an unusable name', (): void => {
      expect(validateProfileWriteBody({})).toEqual({
        ok: false,
        message: DISPLAY_NAME_EMPTY_MESSAGE,
        statusCode: DISPLAY_NAME_REJECTED_STATUS,
      });
    });
  });
});
