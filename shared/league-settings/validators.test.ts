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
 * ████████████████████████████████████ #shared/league-settings/validators.test.ts █████████████████████████████████████
 *
 * Unit tests for the numeric league-settings validators.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import {
  BOUNDED_SETTING_ORDER,
  LEAGUE_SETTINGS_NUMERIC_BOUNDS,
  MATCH_FORMAT_CHOICES,
  STANDARD_LEAGUE_SETTINGS,
  TARGET_SCORE_CHOICES,
} from './constants';
import type { INumericBounds, TBoundedSetting, TLeagueSettings } from './types';
import {
  boundedSettingMessage,
  discreteSettingMessage,
  validateBoundedSetting,
  validateDiscreteSetting,
  validateLeagueSettingsNumbers,
  validateMatchFormat,
  validateTargetScore,
} from './validators';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The values no numeric setting accepts, whatever its range or choices: wire data is refused, never coerced
 * @internal
 * @constant
 */
const UNUSABLE_VALUES: readonly unknown[] = [
  '11',
  '',
  null,
  undefined,
  true,
  false,
  [],
  {},
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 2,
];

/**
 * A settings object built from the standard one with a single field replaced, the way one edited section arrives
 * @internal
 * @function
 * @param overrides - The fields this case changes
 * @returns The resolved settings object to validate
 */
function settingsWith(overrides: Partial<Record<string, unknown>>): Record<string, unknown> {
  return { ...STANDARD_LEAGUE_SETTINGS, ...overrides } as Record<string, unknown>;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(boundedSettingMessage), (): void => {
    it('names both ends of the range', (): void => {
      expect(boundedSettingMessage({ max: 1440, min: 0 })).toBe('Enter a whole number from 0 to 1440.');
    });
  });

  describe(symbolName(discreteSettingMessage), (): void => {
    it('names the choices as the control lists them', (): void => {
      expect(discreteSettingMessage([11, 15, 21])).toBe('Choose 11, 15 or 21.');
      expect(discreteSettingMessage([1, 3, 5, 7])).toBe('Choose 1, 3, 5 or 7.');
    });
  });

  describe(symbolName(validateBoundedSetting), (): void => {
    for (const setting of BOUNDED_SETTING_ORDER) {
      const bounds: INumericBounds = LEAGUE_SETTINGS_NUMERIC_BOUNDS[setting];
      const message: string = boundedSettingMessage(bounds);

      it(`accepts ${setting} at both ends and at its standard default`, (): void => {
        expect(validateBoundedSetting(setting, bounds.min)).toEqual({ ok: true, value: bounds.min });
        expect(validateBoundedSetting(setting, bounds.max)).toEqual({ ok: true, value: bounds.max });

        const standard: number = STANDARD_LEAGUE_SETTINGS[setting];

        expect(validateBoundedSetting(setting, standard)).toEqual({ ok: true, value: standard });
      });

      it(`refuses ${setting} one step outside either end, and every unusable value`, (): void => {
        expect(validateBoundedSetting(setting, bounds.min - 1)).toEqual({ message, ok: false });
        expect(validateBoundedSetting(setting, bounds.max + 1)).toEqual({ message, ok: false });

        for (const value of UNUSABLE_VALUES) {
          expect(validateBoundedSetting(setting, value)).toEqual({ message, ok: false });
        }
      });
    }

    it('accepts zero only for the cutthroat time cap', (): void => {
      const zeroed: TBoundedSetting[] = BOUNDED_SETTING_ORDER.filter(
        (setting: TBoundedSetting): boolean => validateBoundedSetting(setting, 0).ok,
      );

      expect(zeroed).toEqual(['cutthroatTimeCap']);
    });
  });

  describe(symbolName(validateDiscreteSetting), (): void => {
    it('accepts a listed value and refuses its neighbours', (): void => {
      expect(validateDiscreteSetting([1, 3, 5, 7], 5)).toEqual({ ok: true, value: 5 });
      expect(validateDiscreteSetting([1, 3, 5, 7], 4)).toEqual({ message: 'Choose 1, 3, 5 or 7.', ok: false });
    });
  });

  describe(symbolName(validateMatchFormat), (): void => {
    it('accepts every odd choice and refuses even values and numeric strings', (): void => {
      for (const choice of MATCH_FORMAT_CHOICES) {
        expect(validateMatchFormat(choice)).toEqual({ ok: true, value: choice });
      }

      for (const value of [0, 2, 4, 6, 9, '3', ...UNUSABLE_VALUES]) {
        expect(validateMatchFormat(value)).toEqual({ message: 'Choose 1, 3, 5 or 7.', ok: false });
      }
    });
  });

  describe(symbolName(validateTargetScore), (): void => {
    it("accepts each format's own scores and refuses another format's", (): void => {
      for (const gameType of Object.values(GameType)) {
        for (const choice of TARGET_SCORE_CHOICES[gameType]) {
          expect(validateTargetScore(gameType, choice)).toEqual({ ok: true, value: choice });
        }
      }

      expect(validateTargetScore(GameType.SINGLES, 12).ok).toBe(false);
      expect(validateTargetScore(GameType.SINGLES, 7).ok).toBe(false);
      expect(validateTargetScore(GameType.CUTTHROAT, 21).ok).toBe(false);
    });
  });

  describe(symbolName(validateLeagueSettingsNumbers), (): void => {
    it('accepts the settings every league starts with', (): void => {
      expect(validateLeagueSettingsNumbers(STANDARD_LEAGUE_SETTINGS)).toEqual({ ok: true });
    });

    it('accepts every field at its maximum at once', (): void => {
      const maxed: Record<string, unknown> = settingsWith({
        matchFormat: 7,
        targetScore: {
          [GameType.CUTTHROAT]: 15,
          [GameType.DOUBLES]: 21,
          [GameType.SINGLES]: 21,
        },
        ...Object.fromEntries(
          BOUNDED_SETTING_ORDER.map((setting: TBoundedSetting): [string, number] => [
            setting,
            LEAGUE_SETTINGS_NUMERIC_BOUNDS[setting].max,
          ]),
        ),
      });

      expect(validateLeagueSettingsNumbers(maxed)).toEqual({ ok: true });
    });

    it('names the field that failed, as the editor addresses it', (): void => {
      expect(validateLeagueSettingsNumbers(settingsWith({ resultConfirmationWindow: 721 }))).toEqual({
        field: 'resultConfirmationWindow',
        message: 'Enter a whole number from 1 to 720.',
        ok: false,
      });

      expect(
        validateLeagueSettingsNumbers(
          settingsWith({ targetScore: { ...STANDARD_LEAGUE_SETTINGS.targetScore, [GameType.DOUBLES]: 12 } }),
        ),
      ).toEqual({
        field: 'targetScore.DOUBLES',
        message: 'Choose 11, 15 or 21.',
        ok: false,
      });
    });

    it('reports the first field the settings page lists, not the first that happens to fail', (): void => {
      const failure: Record<string, unknown> = settingsWith({ provisionalGames: 0, winningMargin: 0 });

      expect(validateLeagueSettingsNumbers(failure)).toMatchObject({ field: 'winningMargin', ok: false });
    });

    it('validates a value the editor is hiding', (): void => {
      // A format the league does not allow still carries a target score, and it is the score played by the day the
      // format is allowed again
      expect(
        validateLeagueSettingsNumbers(
          settingsWith({
            allowedGameTypes: [GameType.SINGLES],
            targetScore: { ...STANDARD_LEAGUE_SETTINGS.targetScore, [GameType.CUTTHROAT]: 21 },
          }),
        ),
      ).toMatchObject({ field: 'targetScore.CUTTHROAT', ok: false });

      // Turning confirmation off hides its window; the stored window is still validated
      expect(
        validateLeagueSettingsNumbers(settingsWith({ requireConfirmation: false, resultConfirmationWindow: 0 })),
      ).toMatchObject({ field: 'resultConfirmationWindow', ok: false });

      // As is the provisional count with ratings off
      expect(
        validateLeagueSettingsNumbers(settingsWith({ provisionalGames: 1001, ratingEnabled: false })),
      ).toMatchObject({ field: 'provisionalGames', ok: false });

      // A hidden value at its maximum survives untouched
      expect(validateLeagueSettingsNumbers(settingsWith({ cutthroatTimeCap: 1440, expediteEnabled: false }))).toEqual({
        ok: true,
      });
    });

    it('refuses a missing or malformed object field by field rather than shapelessly', (): void => {
      for (const value of [undefined, null, 'settings', [], {}]) {
        expect(validateLeagueSettingsNumbers(value)).toMatchObject({ field: 'targetScore.SINGLES', ok: false });
      }

      expect(validateLeagueSettingsNumbers(settingsWith({ targetScore: '11' }))).toMatchObject({
        field: 'targetScore.SINGLES',
        ok: false,
      });
    });
  });

  describe('Duration conversion', (): void => {
    it('converts both maximum windows without a 32-bit truncation', (): void => {
      const maximumMinutes: number = LEAGUE_SETTINGS_NUMERIC_BOUNDS.walkoverGracePeriod.max;
      const maximumHours: number = LEAGUE_SETTINGS_NUMERIC_BOUNDS.resultConfirmationWindow.max;

      expect(maximumMinutes * 60_000).toBe(86_400_000);
      expect(maximumHours * 3_600_000).toBe(2_592_000_000);
      expect(Number.isSafeInteger(maximumHours * 3_600_000)).toBe(true);
    });
  });

  describe('Standard settings', (): void => {
    it('sits inside every bound and every choice', (): void => {
      const standard: TLeagueSettings = STANDARD_LEAGUE_SETTINGS;

      for (const setting of BOUNDED_SETTING_ORDER) {
        expect(validateBoundedSetting(setting, standard[setting]).ok).toBe(true);
      }

      expect(validateMatchFormat(standard.matchFormat).ok).toBe(true);

      for (const gameType of Object.values(GameType)) {
        expect(validateTargetScore(gameType, standard.targetScore[gameType]).ok).toBe(true);
      }
    });
  });
});
