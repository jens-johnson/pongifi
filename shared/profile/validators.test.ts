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

import { LeagueRole } from '#shared/domain';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import {
  DEFAULT_LEAGUE_MEMBERSHIP_SORT,
  DISPLAY_NAME_EMPTY_MESSAGE,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_REJECTED_STATUS,
  DISPLAY_NAME_TOO_LONG_MESSAGE,
  LEAGUE_MEMBERSHIP_MAX_PAGE,
  LEAGUE_MEMBERSHIP_SEARCH_MAX_LENGTH,
  LEAGUES_LIST_PAGE_SIZE,
  PROFILE_BODY_REJECTED_STATUS,
  PROFILE_BODY_SHAPE_MESSAGE,
  PROFILE_BODY_UNKNOWN_FIELD_MESSAGE,
} from './constants';
import { LeagueMembershipSort } from './enums';
import type { IProfileWriteBodyFailure, TProfileWriteBodyResult } from './types';
import { normalizeLeagueMembershipQuery, validateDisplayName, validateProfileWriteBody } from './validators';

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

  describe(symbolName(normalizeLeagueMembershipQuery), (): void => {
    it('returns the bounded full-list defaults for an empty query', (): void => {
      expect(normalizeLeagueMembershipQuery({})).toEqual({
        format: null,
        page: 1,
        pageSize: LEAGUES_LIST_PAGE_SIZE,
        role: null,
        search: '',
        sort: DEFAULT_LEAGUE_MEMBERSHIP_SORT,
      });
    });

    it('accepts allowlisted filters, ordering and the compact Home page size', (): void => {
      expect(
        normalizeLeagueMembershipQuery({
          format: GameType.CUTTHROAT,
          page: '2',
          pageSize: '5',
          role: LeagueRole.MANAGER,
          search: '  Lunch  ',
          sort: LeagueMembershipSort.MEMBERS,
        }),
      ).toEqual({
        format: GameType.CUTTHROAT,
        page: 2,
        pageSize: 5,
        role: LeagueRole.MANAGER,
        search: 'Lunch',
        sort: LeagueMembershipSort.MEMBERS,
      });
    });

    it('normalizes invalid bookmarks without unbounded arithmetic', (): void => {
      expect(
        normalizeLeagueMembershipQuery({
          format: 'QUADS',
          page: '999999999999999999999',
          pageSize: '10000',
          role: 'OWNER',
          sort: 'random',
        }),
      ).toMatchObject({
        format: null,
        page: LEAGUE_MEMBERSHIP_MAX_PAGE,
        pageSize: LEAGUES_LIST_PAGE_SIZE,
        role: null,
        sort: DEFAULT_LEAGUE_MEMBERSHIP_SORT,
      });
    });

    it('uses the first repeated value and caps search input', (): void => {
      const search: string = 'x'.repeat(LEAGUE_MEMBERSHIP_SEARCH_MAX_LENGTH + 20);
      const normalized = normalizeLeagueMembershipQuery({ page: ['3', '8'], search });

      expect(normalized.page).toBe(3);
      expect(normalized.search).toHaveLength(LEAGUE_MEMBERSHIP_SEARCH_MAX_LENGTH);
    });
  });
});
