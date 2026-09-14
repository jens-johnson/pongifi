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

import { GameCreator, ResultRecorder } from '#shared/domain';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import {
  LEAGUE_ABBREVIATION_TOO_LONG_MESSAGE,
  LEAGUE_BODY_MALFORMED_MESSAGE,
  LEAGUE_BODY_REJECTED_STATUS,
  LEAGUE_DESCRIPTION_TOO_LONG_MESSAGE,
  LEAGUE_GAME_TYPES_EMPTY_MESSAGE,
  LEAGUE_NAME_EMPTY_MESSAGE,
  LEAGUE_NAME_TOO_LONG_MESSAGE,
  LEAGUE_VALUE_REJECTED_STATUS,
} from './constants';
import { SettingsSection } from './enums';
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
  validateSaveSettingsBody,
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

/**
 * A complete, valid Formats and scoring save, which the cases vary one field at a time
 * @internal
 * @constant
 */
const FORMATS_BODY: Record<string, unknown> = {
  allowedGameTypes: [GameType.SINGLES, GameType.DOUBLES, GameType.CUTTHROAT],
  cutthroatTimeCap: 15,
  expediteEnabled: false,
  matchFormat: 3,
  revision: 4,
  section: SettingsSection.FORMATS,
  serviceInterval: 2,
  targetScore: {
    [GameType.CUTTHROAT]: 7,
    [GameType.DOUBLES]: 11,
    [GameType.SINGLES]: 11,
  },
  walkoverGracePeriod: 10,
  winningMargin: 2,
};

/**
 * A complete, valid Results save
 * @internal
 * @constant
 */
const RESULTS_BODY: Record<string, unknown> = {
  requireConfirmation: true,
  resultAmendmentWindow: 48,
  resultConfirmationWindow: 24,
  revision: 4,
  section: SettingsSection.RESULTS,
  whoCanCreateGames: GameCreator.PLAYER,
  whoCanRecordResults: ResultRecorder.PARTICIPANTS,
};

/**
 * A complete, valid Identity save, with the padding and lower case the validator normalizes
 * @internal
 * @constant
 */
const IDENTITY_BODY: Record<string, unknown> = {
  abbreviation: ' fri ',
  description: '  ',
  name: `  ${LEAGUE_NAME} `,
  revision: 4,
  section: SettingsSection.IDENTITY,
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

    it('refuses an extra field, an unknown format, a malformed identifier and a NUL as malformed', (): void => {
      const malformed: { ok: false; statusCode: number } = { ok: false, statusCode: LEAGUE_BODY_REJECTED_STATUS };

      expect(validateCreateLeagueBody({ ...CREATE_BODY, visibility: 'DISCOVERABLE' })).toMatchObject(malformed);
      expect(validateCreateLeagueBody({ ...CREATE_BODY, allowedGameTypes: ['TENNIS'] })).toMatchObject(malformed);
      expect(validateCreateLeagueBody({ ...CREATE_BODY, submissionId: 'retry-1' })).toMatchObject(malformed);
      expect(validateCreateLeagueBody([CREATE_BODY])).toMatchObject(malformed);
      expect(validateCreateLeagueBody({ ...CREATE_BODY, name: 'Friday\u0000Ladder' })).toMatchObject(malformed);
      expect(validateCreateLeagueBody({ ...CREATE_BODY, description: '\u0000' })).toMatchObject(malformed);
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

  describe(symbolName(validateSaveSettingsBody), (): void => {
    it('normalizes an Identity save and leaves the settings untouched', (): void => {
      expect(validateSaveSettingsBody(IDENTITY_BODY)).toEqual({
        ok: true,
        value: {
          identity: {
            abbreviation: 'FRI',
            description: null,
            name: LEAGUE_NAME,
          },
          revision: 4,
          section: SettingsSection.IDENTITY,
          settings: {},
        },
      });
    });

    it('normalizes a Formats save into the settings the section owns', (): void => {
      expect(
        validateSaveSettingsBody({ ...FORMATS_BODY, allowedGameTypes: [GameType.CUTTHROAT, GameType.SINGLES] }),
      ).toEqual({
        ok: true,
        value: {
          identity: null,
          revision: 4,
          section: SettingsSection.FORMATS,
          settings: {
            allowedGameTypes: [GameType.SINGLES, GameType.CUTTHROAT],
            cutthroatTimeCap: 15,
            expediteEnabled: false,
            matchFormat: 3,
            serviceInterval: 2,
            targetScore: {
              [GameType.CUTTHROAT]: 7,
              [GameType.DOUBLES]: 11,
              [GameType.SINGLES]: 11,
            },
            walkoverGracePeriod: 10,
            winningMargin: 2,
          },
        },
      });
    });

    it('accepts the Results and Ratings sections', (): void => {
      expect(validateSaveSettingsBody(RESULTS_BODY).ok).toBe(true);
      expect(
        validateSaveSettingsBody({
          provisionalGames: 10,
          ratingEnabled: true,
          revision: 1,
          section: SettingsSection.RATINGS,
        }).ok,
      ).toBe(true);
    });

    it('refuses a field another section owns, so one save can never reach across the page', (): void => {
      // The name belongs to Identity, and a manager saving Identity must not be able to send a target score either
      expect(validateSaveSettingsBody({ ...FORMATS_BODY, name: LEAGUE_NAME })).toEqual({
        message: LEAGUE_BODY_MALFORMED_MESSAGE,
        ok: false,
        statusCode: LEAGUE_BODY_REJECTED_STATUS,
      });

      expect(validateSaveSettingsBody({ ...IDENTITY_BODY, targetScore: { [GameType.SINGLES]: 11 } }).ok).toBe(false);
    });

    it('refuses a section it does not have every field of', (): void => {
      const { winningMargin, ...missing }: Record<string, unknown> = FORMATS_BODY;

      expect(winningMargin).toBe(2);
      expect(validateSaveSettingsBody(missing)).toMatchObject({ statusCode: LEAGUE_BODY_REJECTED_STATUS });

      // Including inside the target scores, where a missing format would leave a hidden value to be guessed
      expect(
        validateSaveSettingsBody({
          ...FORMATS_BODY,
          targetScore: { [GameType.DOUBLES]: 11, [GameType.SINGLES]: 11 },
        }),
      ).toMatchObject({ statusCode: LEAGUE_BODY_REJECTED_STATUS });
    });

    it('refuses an unknown section and a revision no server issued', (): void => {
      for (const section of [undefined, null, 'GAMEPLAY', 1]) {
        expect(validateSaveSettingsBody({ ...RESULTS_BODY, section }).ok).toBe(false);
      }

      for (const revision of [undefined, null, 0, -1, 1.5, '4', Number.NaN]) {
        expect(validateSaveSettingsBody({ ...RESULTS_BODY, revision })).toMatchObject({
          statusCode: LEAGUE_BODY_REJECTED_STATUS,
        });
      }
    });

    it('treats a toggle or a select as malformed rather than as a field a person can fix', (): void => {
      // Nobody types these; a value outside the set means the body did not come from the page
      for (const body of [
        { ...FORMATS_BODY, expediteEnabled: 'yes' },
        { ...RESULTS_BODY, requireConfirmation: 1 },
        { ...RESULTS_BODY, whoCanCreateGames: 'ANYONE' },
        { ...RESULTS_BODY, whoCanRecordResults: null },
        { ...FORMATS_BODY, allowedGameTypes: ['QUADS'] },
      ]) {
        expect(validateSaveSettingsBody(body)).toMatchObject({ statusCode: LEAGUE_BODY_REJECTED_STATUS });
      }
    });

    it("refuses a number a person could have typed with that field's own message", (): void => {
      expect(validateSaveSettingsBody({ ...FORMATS_BODY, winningMargin: 0 })).toEqual({
        message: 'Enter a whole number from 1 to 21.',
        ok: false,
        statusCode: LEAGUE_VALUE_REJECTED_STATUS,
      });

      expect(validateSaveSettingsBody({ ...RESULTS_BODY, resultConfirmationWindow: 721 })).toMatchObject({
        message: 'Enter a whole number from 1 to 720.',
        statusCode: LEAGUE_VALUE_REJECTED_STATUS,
      });

      expect(validateSaveSettingsBody({ ...FORMATS_BODY, matchFormat: 2 })).toMatchObject({
        message: 'Choose 1, 3, 5 or 7.',
        statusCode: LEAGUE_VALUE_REJECTED_STATUS,
      });

      expect(
        validateSaveSettingsBody({
          ...FORMATS_BODY,
          targetScore: { ...(FORMATS_BODY.targetScore as object), [GameType.SINGLES]: 12 },
        }),
      ).toMatchObject({ message: 'Choose 11, 15 or 21.', statusCode: LEAGUE_VALUE_REJECTED_STATUS });

      expect(validateSaveSettingsBody({ ...IDENTITY_BODY, name: '  ' })).toMatchObject({
        message: LEAGUE_NAME_EMPTY_MESSAGE,
        statusCode: LEAGUE_VALUE_REJECTED_STATUS,
      });
    });

    it('reports the first control the section lists, not the first that happens to fail', (): void => {
      const both: Record<string, unknown> = {
        ...FORMATS_BODY,
        targetScore: { ...(FORMATS_BODY.targetScore as object), [GameType.SINGLES]: 12 },
        winningMargin: 0,
      };

      // Game to sits above Win by on the page
      expect(validateSaveSettingsBody(both)).toMatchObject({ message: 'Choose 11, 15 or 21.' });
    });

    it('carries every hidden value the section owns, so nothing is lost by being off screen', (): void => {
      // A cutthroat-only league still sends its singles target, best of and service interval
      const hidden: Record<string, unknown> = { ...FORMATS_BODY, allowedGameTypes: [GameType.CUTTHROAT] };
      const result = validateSaveSettingsBody(hidden);

      expect(result.ok && result.value.settings).toEqual({
        allowedGameTypes: [GameType.CUTTHROAT],
        cutthroatTimeCap: 15,
        expediteEnabled: false,
        matchFormat: 3,
        serviceInterval: 2,
        targetScore: STANDARD_LEAGUE_SETTINGS.targetScore,
        walkoverGracePeriod: 10,
        winningMargin: 2,
      });
    });

    it('refuses a league with no format at all', (): void => {
      expect(validateSaveSettingsBody({ ...FORMATS_BODY, allowedGameTypes: [] })).toMatchObject({
        message: LEAGUE_GAME_TYPES_EMPTY_MESSAGE,
        statusCode: LEAGUE_VALUE_REJECTED_STATUS,
      });
    });
  });
});
