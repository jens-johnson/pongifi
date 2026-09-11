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
 * ████████████████████████████████████████ #shared/leagues/validators.test.ts █████████████████████████████████████████
 *
 * Unit tests for the league-entry field and body validators.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import {
  LEAGUE_ABBREVIATION_TOO_LONG_MESSAGE,
  LEAGUE_BODY_REJECTED_STATUS,
  LEAGUE_DESCRIPTION_TOO_LONG_MESSAGE,
  LEAGUE_GAME_TYPES_EMPTY_MESSAGE,
  LEAGUE_NAME_EMPTY_MESSAGE,
  LEAGUE_NAME_TOO_LONG_MESSAGE,
  LEAGUE_VALUE_REJECTED_STATUS,
} from './constants';
import {
  isInviteToken,
  isUuid,
  validateCreateLeagueBody,
  validateIssueInviteBody,
  validateLeagueAbbreviation,
  validateLeagueDescription,
  validateLeagueGameTypes,
  validateLeagueName,
  validateReplaceInviteBody,
} from './validators';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A submission identifier, in the upper case a client might send it
 * @internal
 * @constant
 */
const SUBMISSION_ID: string = 'A4F1C0DE-0000-4000-8000-000000000001';

/**
 * The league name every case uses, before the padding the validator trims
 * @internal
 * @constant
 */
const LEAGUE_NAME: string = 'Friday Ladder';

/**
 * A complete, valid create body the cases vary one field at a time
 * @internal
 * @constant
 */
const CREATE_BODY: Record<string, unknown> = {
  abbreviation: ' fri ',
  allowedGameTypes: [GameType.CUTTHROAT, GameType.SINGLES, GameType.SINGLES],
  description: '  ',
  name: `  ${LEAGUE_NAME} `,
  submissionId: SUBMISSION_ID,
};

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(validateLeagueName), (): void => {
    it('trims, and refuses empty and over-long names with their messages', (): void => {
      expect(validateLeagueName(`  ${LEAGUE_NAME} `)).toEqual({ ok: true, value: LEAGUE_NAME });
      expect(validateLeagueName('   ')).toEqual({ message: LEAGUE_NAME_EMPTY_MESSAGE, ok: false });
      expect(validateLeagueName('x'.repeat(61))).toEqual({ message: LEAGUE_NAME_TOO_LONG_MESSAGE, ok: false });
    });

    it('counts characters by code point, as the column does', (): void => {
      expect(validateLeagueName('🏓'.repeat(60)).ok).toBe(true);
    });
  });

  describe(symbolName(validateLeagueAbbreviation), (): void => {
    it('uppercases before measuring, so one sharp s is valid and five are refused rather than truncated', (): void => {
      expect(validateLeagueAbbreviation('ß')).toEqual({ ok: true, value: 'SS' });
      expect(validateLeagueAbbreviation('ßßßßß')).toEqual({
        message: LEAGUE_ABBREVIATION_TOO_LONG_MESSAGE,
        ok: false,
      });
    });

    it('trims and uppercases an ordinary mark', (): void => {
      expect(validateLeagueAbbreviation(' fri ')).toEqual({ ok: true, value: 'FRI' });
    });
  });

  describe(symbolName(validateLeagueDescription), (): void => {
    it('stores null for an empty description and refuses one over the limit', (): void => {
      expect(validateLeagueDescription('   ')).toEqual({ ok: true, value: null });
      expect(validateLeagueDescription(null)).toEqual({ ok: true, value: null });
      expect(validateLeagueDescription('x'.repeat(281))).toEqual({
        message: LEAGUE_DESCRIPTION_TOO_LONG_MESSAGE,
        ok: false,
      });
    });
  });

  describe(symbolName(validateLeagueGameTypes), (): void => {
    it('deduplicates into canonical order and refuses an empty selection', (): void => {
      expect(validateLeagueGameTypes([GameType.CUTTHROAT, GameType.SINGLES, GameType.SINGLES])).toEqual({
        ok: true,
        value: [GameType.SINGLES, GameType.CUTTHROAT],
      });
      expect(validateLeagueGameTypes([])).toEqual({ message: LEAGUE_GAME_TYPES_EMPTY_MESSAGE, ok: false });
    });
  });

  describe(symbolName(validateCreateLeagueBody), (): void => {
    it('rebuilds a normalized request from the allowlisted fields', (): void => {
      expect(validateCreateLeagueBody(CREATE_BODY)).toEqual({
        ok: true,
        value: {
          abbreviation: 'FRI',
          allowedGameTypes: [GameType.SINGLES, GameType.CUTTHROAT],
          description: null,
          name: LEAGUE_NAME,
          submissionId: SUBMISSION_ID.toLowerCase(),
        },
      });
    });

    it('refuses an extra field, an unknown format and a malformed identifier as malformed', (): void => {
      const malformed: { ok: false; statusCode: number } = { ok: false, statusCode: LEAGUE_BODY_REJECTED_STATUS };

      expect(validateCreateLeagueBody({ ...CREATE_BODY, visibility: 'DISCOVERABLE' })).toMatchObject(malformed);
      expect(validateCreateLeagueBody({ ...CREATE_BODY, allowedGameTypes: ['TENNIS'] })).toMatchObject(malformed);
      expect(validateCreateLeagueBody({ ...CREATE_BODY, submissionId: 'retry-1' })).toMatchObject(malformed);
      expect(validateCreateLeagueBody([CREATE_BODY])).toMatchObject(malformed);
    });

    it('refuses an unusable value with the first failing field message', (): void => {
      expect(
        validateCreateLeagueBody({
          ...CREATE_BODY,
          allowedGameTypes: [],
          name: '',
        }),
      ).toEqual({
        message: LEAGUE_NAME_EMPTY_MESSAGE,
        ok: false,
        statusCode: LEAGUE_VALUE_REJECTED_STATUS,
      });
    });
  });

  describe(symbolName(validateIssueInviteBody), (): void => {
    it('accepts the published expiry choices, an optional limit and an optional last-seen link', (): void => {
      expect(validateIssueInviteBody({ expiresInDays: 7 })).toEqual({
        ok: true,
        value: {
          expiresInDays: 7,
          maxUses: null,
          previousId: null,
        },
      });
      expect(
        validateIssueInviteBody({
          expiresInDays: 30,
          maxUses: 5,
          previousId: SUBMISSION_ID,
        }),
      ).toEqual({
        ok: true,
        value: {
          expiresInDays: 30,
          maxUses: 5,
          previousId: SUBMISSION_ID.toLowerCase(),
        },
      });
    });

    it('refuses an unpublished expiry, a non-positive or fractional limit, and fields it does not accept', (): void => {
      expect(validateIssueInviteBody({ expiresInDays: 365 }).ok).toBe(false);
      expect(validateIssueInviteBody({ expiresInDays: 7, maxUses: 0 }).ok).toBe(false);
      expect(validateIssueInviteBody({ expiresInDays: 7, maxUses: 1.5 }).ok).toBe(false);
      expect(validateIssueInviteBody({ expiresInDays: 7, maxUses: 2_147_483_648 }).ok).toBe(false);
      expect(validateIssueInviteBody({ email: 'a@example.com', expiresInDays: 7 }).ok).toBe(false);
      expect(validateIssueInviteBody({ expiresInDays: 7, previousId: 'not-a-uuid' }).ok).toBe(false);
    });
  });

  describe(symbolName(validateReplaceInviteBody), (): void => {
    it('accepts the options alone and refuses a body naming a link, which the path already does', (): void => {
      expect(validateReplaceInviteBody({ expiresInDays: 1, maxUses: null })).toEqual({
        ok: true,
        value: { expiresInDays: 1, maxUses: null },
      });
      expect(validateReplaceInviteBody({ expiresInDays: 1, previousId: SUBMISSION_ID }).ok).toBe(false);
    });
  });

  describe(symbolName(isInviteToken), (): void => {
    it('accepts exactly 43 base64url characters and nothing else', (): void => {
      expect(isInviteToken('aZ09-_'.padEnd(43, 'x'))).toBe(true);
      expect(isInviteToken('x'.repeat(42))).toBe(false);
      expect(isInviteToken('x'.repeat(44))).toBe(false);
      expect(isInviteToken(`${'x'.repeat(42)}=`)).toBe(false);
      expect(isInviteToken(43)).toBe(false);
    });
  });

  describe(symbolName(isUuid), (): void => {
    it('accepts a UUID in either case and refuses anything a uuid column would reject', (): void => {
      expect(isUuid(SUBMISSION_ID)).toBe(true);
      expect(isUuid(SUBMISSION_ID.toLowerCase())).toBe(true);
      expect(isUuid('not-a-uuid')).toBe(false);
      expect(isUuid(`${SUBMISSION_ID}0`)).toBe(false);
    });
  });
});
