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
 * ███████████████████████████████████████ #shared/league-settings/validators.ts ███████████████████████████████████████
 *
 * Validators for the numeric league settings: the inclusive ranges and the fixed choices.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import {
  BOUNDED_SETTING_ORDER,
  LEAGUE_SETTINGS_NUMERIC_BOUNDS,
  MATCH_FORMAT_CHOICES,
  TARGET_SCORE_CHOICES,
  TARGET_SCORE_FORMAT_ORDER,
} from './constants';
import type { INumericBounds, TBoundedSetting, TSettingsValidationResult, TSettingValidationResult } from './types';

/**
 * Reads an untrusted value as a plain object, so a missing or malformed settings object fails field by field with the
 * message the field would have shown rather than as one shapeless refusal.
 * @internal
 * @function
 * @param value - The untrusted value
 * @returns The value as a record, or an empty record when it is not a plain object
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

/**
 * Names a set of choices the way the field's message reads them aloud.
 * @internal
 * @function
 * @param choices - The allowed values, in the order the control lists them
 * @returns The choices as a phrase: "11, 15 or 21"
 */
function nameChoices(choices: readonly number[]): string {
  if (choices.length < 2) {
    return choices.join('');
  }

  return `${choices.slice(0, -1).join(', ')} or ${choices[choices.length - 1]}`;
}

/**
 * Whether a value arrived from the wire as a whole number.
 *
 * `Number.isSafeInteger` refuses strings, booleans, null, fractions, infinities and NaN in one test, which is the
 * point: wire data is never parsed, rounded or coerced into range, only accepted or refused
 * @internal
 * @function
 * @param input - The untrusted value
 * @returns Whether the value is a whole number a setting could hold
 */
function isWholeNumber(input: unknown): input is number {
  return typeof input === 'number' && Number.isSafeInteger(input);
}

/**
 * The message a plain numeric field shows when its value is outside the range.
 * @public
 * @function
 * @param bounds - The field's inclusive range
 * @returns The message shown beneath the field
 */
export function boundedSettingMessage(bounds: INumericBounds): string {
  return `Enter a whole number from ${bounds.min} to ${bounds.max}.`;
}

/**
 * The message a fixed-choice field shows when its value is not one of them.
 * @public
 * @function
 * @param choices - The allowed values, in the order the control lists them
 * @returns The message shown beneath the field
 */
export function discreteSettingMessage(choices: readonly number[]): string {
  return `Choose ${nameChoices(choices)}.`;
}

/**
 * Validates one plain numeric setting against its inclusive range.
 * @public
 * @function
 * @param setting - The setting being validated
 * @param input - The untrusted value
 * @returns The value to store, or the message the field shows
 */
export function validateBoundedSetting(setting: TBoundedSetting, input: unknown): TSettingValidationResult {
  const bounds: INumericBounds = LEAGUE_SETTINGS_NUMERIC_BOUNDS[setting];

  if (!isWholeNumber(input) || input < bounds.min || input > bounds.max) {
    return { message: boundedSettingMessage(bounds), ok: false };
  }

  return { ok: true, value: input };
}

/**
 * Validates one numeric setting against a fixed set of choices.
 * @public
 * @function
 * @param choices - The allowed values
 * @param input - The untrusted value
 * @returns The value to store, or the message the field shows
 */
export function validateDiscreteSetting(choices: readonly number[], input: unknown): TSettingValidationResult {
  if (!isWholeNumber(input) || !choices.includes(input)) {
    return { message: discreteSettingMessage(choices), ok: false };
  }

  return { ok: true, value: input };
}

/**
 * Validates a best-of value against the odd set the engines are consistent for.
 * @public
 * @function
 * @param input - The untrusted value
 * @returns The value to store, or the message the field shows
 */
export function validateMatchFormat(input: unknown): TSettingValidationResult {
  return validateDiscreteSetting(MATCH_FORMAT_CHOICES, input);
}

/**
 * Validates the score one format is played to against that format's choices.
 * @public
 * @function
 * @param gameType - The format the score belongs to
 * @param input - The untrusted value
 * @returns The value to store, or the message the field shows
 */
export function validateTargetScore(gameType: GameType, input: unknown): TSettingValidationResult {
  return validateDiscreteSetting(TARGET_SCORE_CHOICES[gameType], input);
}

/**
 * Validates every numeric setting in a resolved settings object.
 *
 * Every format's target score is checked whichever formats the league currently allows, and the same is true of the
 * fields a disabled confirmation or rating policy hides: a value the editor is not showing is still a value the league
 * would play by the day it is shown again, so it is never left unvalidated and never silently replaced. Fields are
 * checked in the order the settings page lists them, so a refusal names the first field a commissioner would have
 * found. Nothing here is a relationship between two settings — each field stands or falls on its own
 * @public
 * @function
 * @param settings - The resolved settings object, straight from the wire
 * @returns Accepted, or the first field that failed and the message it shows
 */
export function validateLeagueSettingsNumbers(settings: unknown): TSettingsValidationResult {
  const candidate: Record<string, unknown> = asRecord(settings);
  const targetScores: Record<string, unknown> = asRecord(candidate.targetScore);

  for (const gameType of TARGET_SCORE_FORMAT_ORDER) {
    const score: TSettingValidationResult = validateTargetScore(gameType, targetScores[gameType]);

    if (!score.ok) {
      return {
        field: `targetScore.${gameType}`,
        message: score.message,
        ok: false,
      };
    }
  }

  const matchFormat: TSettingValidationResult = validateMatchFormat(candidate.matchFormat);

  if (!matchFormat.ok) {
    return {
      field: 'matchFormat',
      message: matchFormat.message,
      ok: false,
    };
  }

  for (const setting of BOUNDED_SETTING_ORDER) {
    const value: TSettingValidationResult = validateBoundedSetting(setting, candidate[setting]);

    if (!value.ok) {
      return {
        field: setting,
        message: value.message,
        ok: false,
      };
    }
  }

  return { ok: true };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(boundedSettingMessage, {
  name: 'Bounded Setting Message',
  description: 'Builds the message a plain numeric field shows for a value outside its range.',
});

defineSymbol(discreteSettingMessage, {
  name: 'Discrete Setting Message',
  description: 'Builds the message a fixed-choice field shows, naming the choices.',
});

defineSymbol(validateBoundedSetting, {
  name: 'Validate Bounded Setting',
  description: 'Validates one plain numeric setting against its inclusive range.',
});

defineSymbol(validateDiscreteSetting, {
  name: 'Validate Discrete Setting',
  description: 'Validates one numeric setting against a fixed set of choices.',
});

defineSymbol(validateMatchFormat, {
  name: 'Validate Match Format',
  description: 'Validates a best-of value against the odd set the engines are consistent for.',
});

defineSymbol(validateTargetScore, {
  name: 'Validate Target Score',
  description: "Validates the score one format is played to against that format's choices.",
});

defineSymbol(validateLeagueSettingsNumbers, {
  name: 'Validate League Settings Numbers',
  description: 'Validates every numeric setting in a resolved settings object, including hidden fields.',
});
