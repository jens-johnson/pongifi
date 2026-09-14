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
  LEAGUE_SETTINGS_NUMERIC_BOUNDS,
  LEAGUE_SETTINGS_NUMERIC_ORDER,
  MATCH_FORMAT_CHOICES,
  TARGET_SCORE_CHOICES,
  TARGET_SCORE_FORMAT_ORDER,
} from './constants';
import type {
  INumericBounds,
  ISettingsNumberIssue,
  TBoundedSetting,
  TNumericSetting,
  TSettingValidationResult,
} from './types';

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
 *
 * The ends are grouped the way every other displayed count on the site is grouped, so the message reads as the spec
 * and the contract write it: 1,440 rather than 1440. Only the message text is formatted — the bounds stay plain
 * integers, and a value typed back with its separator is a string, which the validator still refuses
 * @public
 * @function
 * @param bounds - The field's inclusive range
 * @returns The message shown beneath the field
 */
export function boundedSettingMessage(bounds: INumericBounds): string {
  return `Enter a whole number from ${bounds.min.toLocaleString('en-US')} to ${bounds.max.toLocaleString('en-US')}.`;
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
 * Collects every numeric setting in a resolved settings object that does not satisfy its rule.
 *
 * This is the settings page's diagnostic, not a refusal path. A save is decided by `validateSaveSettingsBody`, which
 * checks the section being saved and nothing else; a fault in another section never blocks that save (page spec
 * revision 2.3). Returning the whole list here rather than the first entry is what the page needs and is deliberately
 * not a whole-configuration veto — do not wire this into a write.
 *
 * Every format's target score is collected whichever formats the league currently allows, and the same is true of the
 * fields a disabled confirmation or rating policy hides: a value the editor is not showing is still a value the league
 * would play by the day it is shown again, so it is never left undiagnosed and never silently replaced. That is what
 * lets the page reveal a hidden control whose stored value is out of range. Fields are walked in
 * {@link LEAGUE_SETTINGS_NUMERIC_ORDER}, the order the settings page lists its controls, so the whole list is the set
 * of controls to reveal on load and its first entry is where a save puts focus. Nothing here is a relationship between
 * two settings — each field stands or falls on its own
 * @public
 * @function
 * @param settings - The resolved settings object, straight from the wire
 * @returns Every failing field and the message it shows, in page order; empty when every numeric setting is usable
 */
export function collectLeagueSettingsNumberIssues(settings: unknown): ISettingsNumberIssue[] {
  const candidate: Record<string, unknown> = asRecord(settings);
  const targetScores: Record<string, unknown> = asRecord(candidate.targetScore);

  return LEAGUE_SETTINGS_NUMERIC_ORDER.flatMap((setting: TNumericSetting): ISettingsNumberIssue[] => {
    if (setting === 'targetScore') {
      return TARGET_SCORE_FORMAT_ORDER.flatMap((gameType: GameType): ISettingsNumberIssue[] => {
        const score: TSettingValidationResult = validateTargetScore(gameType, targetScores[gameType]);

        return score.ok ? [] : [{ field: `targetScore.${gameType}`, message: score.message }];
      });
    }

    const value: TSettingValidationResult =
      setting === 'matchFormat'
        ? validateMatchFormat(candidate.matchFormat)
        : validateBoundedSetting(setting, candidate[setting]);

    return value.ok ? [] : [{ field: setting, message: value.message }];
  });
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

defineSymbol(collectLeagueSettingsNumberIssues, {
  name: 'Collect League Settings Number Issues',
  description:
    'Collects every numeric setting in a resolved settings object that fails its rule, hidden fields included.',
});
