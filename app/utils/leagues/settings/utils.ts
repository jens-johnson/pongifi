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
 * █████████████████████████████████████████ #utils/leagues/settings/utils.ts ██████████████████████████████████████████
 *
 * Draft, dirty, validation and adoption rules for the league settings page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ISettingsNumberIssue, TLeagueSettings } from '#shared/league-settings';
import { collectLeagueSettingsNumberIssues } from '#shared/league-settings';
import type {
  ILeagueConfiguration,
  ILeagueIdentity,
  ISaveSettingsRequest,
  TFieldValidationResult,
} from '#shared/leagues';
import {
  LEAGUE_GAME_TYPE_ORDER,
  SETTINGS_SECTION_FIELDS,
  SettingsSection,
  validateLeagueAbbreviation,
  validateLeagueDescription,
  validateLeagueGameTypes,
  validateLeagueName,
} from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import { GAME_TYPE_LABELS } from '../display';
import { WriteFailure } from '../write-failure';
import {
  GAME_CREATOR_LABELS,
  RESULT_RECORDER_LABELS,
  SETTINGS_FIELD_LABELS,
  SETTINGS_FIELD_UNITS,
  SETTINGS_SECTION_CONTROL_ORDER,
  SINGLES_DOUBLES_FIELDS,
  SINGLES_DOUBLES_FORMATS,
  WHOLE_NUMBER_INPUT_PATTERN,
} from './constants';
import { SettingsSectionAlert, UncertainReconciliation } from './enums';
import type {
  IFormatsDraft,
  IIdentityDraft,
  IRatingsDraft,
  IResultsDraft,
  ISectionAdoption,
  ISectionAdoptionInput,
  ISettingsDraft,
  ISettingsRow,
  TSectionFieldErrors,
  TSectionValidationResult,
  TSettingsControl,
} from './types';

/**
 * Reads a typed whole number, leaving anything else exactly as it was typed.
 *
 * The unparsed text travels on to the shared validator rather than being turned into a message here, so a fraction, an
 * empty field and a typed "1,440" all show the field's own range message and no field's copy exists twice
 * @public
 * @function
 * @param input - The field's text
 * @returns The number, or the text when it is not one
 */
export function readWholeNumberInput(input: string): number | string {
  const trimmed: string = input.trim();

  if (!WHOLE_NUMBER_INPUT_PATTERN.test(trimmed)) {
    return input;
  }

  const value: number = Number(trimmed);

  return Number.isSafeInteger(value) ? value : input;
}

/**
 * Builds the whole page's draft from a configuration.
 * @public
 * @function
 * @param configuration - The configuration as the server holds it
 * @returns Every section as it is first drawn
 */
export function toSettingsDraft(configuration: ILeagueConfiguration): ISettingsDraft {
  const settings: TLeagueSettings = configuration.settings;

  return {
    [SettingsSection.FORMATS]: {
      allowedGameTypes: [...settings.allowedGameTypes],
      cutthroatTimeCap: String(settings.cutthroatTimeCap),
      expediteEnabled: settings.expediteEnabled,
      matchFormat: settings.matchFormat,
      serviceInterval: String(settings.serviceInterval),
      targetScore: { ...settings.targetScore },
      walkoverGracePeriod: String(settings.walkoverGracePeriod),
      winningMargin: String(settings.winningMargin),
    },
    [SettingsSection.IDENTITY]: {
      abbreviation: configuration.abbreviation,
      description: configuration.description ?? '',
      name: configuration.name,
    },
    [SettingsSection.RATINGS]: {
      provisionalGames: String(settings.provisionalGames),
      ratingEnabled: settings.ratingEnabled,
    },
    [SettingsSection.RESULTS]: {
      requireConfirmation: settings.requireConfirmation,
      resultAmendmentWindow: String(settings.resultAmendmentWindow),
      resultConfirmationWindow: String(settings.resultConfirmationWindow),
      whoCanCreateGames: settings.whoCanCreateGames,
      whoCanRecordResults: settings.whoCanRecordResults,
    },
  };
}

/**
 * Whether one section differs from the values it was loaded with.
 *
 * Compared as the draft holds it rather than as a number, so a field retyped from 2 to 02 counts as a change and the
 * person is not told a section is clean while its field shows something else
 * @public
 * @function
 * @param section - The section
 * @param draft - The draft as it stands
 * @param loaded - The draft the section was loaded with
 * @returns Whether anything in the section differs
 */
export function isSectionDirty(section: SettingsSection, draft: ISettingsDraft, loaded: ISettingsDraft): boolean {
  return JSON.stringify(draft[section]) !== JSON.stringify(loaded[section]);
}

/**
 * The settings object a draft would store, with every number left as typed when it is not one.
 *
 * Built whole rather than per section, because the collector diagnoses the whole configuration for the reveal rule and
 * a section save reads its own fields out of the same object
 * @internal
 * @function
 * @param draft - The draft as it stands
 * @returns The settings object, values unchecked
 */
function toCandidateSettings(draft: ISettingsDraft): Record<string, unknown> {
  const formats: IFormatsDraft = draft[SettingsSection.FORMATS];
  const results: IResultsDraft = draft[SettingsSection.RESULTS];
  const ratings: IRatingsDraft = draft[SettingsSection.RATINGS];

  return {
    allowedGameTypes: formats.allowedGameTypes,
    cutthroatTimeCap: readWholeNumberInput(formats.cutthroatTimeCap),
    expediteEnabled: formats.expediteEnabled,
    matchFormat: formats.matchFormat,
    provisionalGames: readWholeNumberInput(ratings.provisionalGames),
    ratingEnabled: ratings.ratingEnabled,
    requireConfirmation: results.requireConfirmation,
    resultAmendmentWindow: readWholeNumberInput(results.resultAmendmentWindow),
    resultConfirmationWindow: readWholeNumberInput(results.resultConfirmationWindow),
    serviceInterval: readWholeNumberInput(formats.serviceInterval),
    targetScore: formats.targetScore,
    walkoverGracePeriod: readWholeNumberInput(formats.walkoverGracePeriod),
    winningMargin: readWholeNumberInput(formats.winningMargin),
    whoCanCreateGames: results.whoCanCreateGames,
    whoCanRecordResults: results.whoCanRecordResults,
  };
}

/**
 * The section a numeric field belongs to, by the field lists the server allowlists each section with.
 *
 * A target score is keyed by its format, so only the part before the dot names the setting
 * @internal
 * @function
 * @param field - The field key, as the editor addresses it
 * @param section - The section
 * @returns Whether the section owns the field
 */
function ownsField(field: string, section: SettingsSection): boolean {
  return SETTINGS_SECTION_FIELDS[section].includes(field.split('.')[0] ?? field);
}

/**
 * Every numeric field of a stored configuration that is outside its bounds or set.
 *
 * This is the reveal set: a control named here is shown even when the rule that would hide it applies, with its
 * message beneath it, until it is corrected and saved (page spec, Saving). It is read from what is stored, not from
 * the draft, so typing a valid replacement does not make a revealed control disappear before Save
 * @public
 * @function
 * @param settings - The settings object as it is stored
 * @returns The field keys to reveal, in the order the page lists its controls
 */
export function collectPersistedFaults(settings: TLeagueSettings): string[] {
  return collectLeagueSettingsNumberIssues(settings).map((issue: ISettingsNumberIssue): string => issue.field);
}

/**
 * Validates the Identity section the way the create form validates the same three fields.
 * @internal
 * @function
 * @param identity - The section's draft
 * @returns The three fields as they would be stored, or every message and the field to focus
 */
function validateIdentitySection(identity: IIdentityDraft): TSectionValidationResult<ILeagueIdentity> {
  const name: TFieldValidationResult<string> = validateLeagueName(identity.name);
  const abbreviation: TFieldValidationResult<string> = validateLeagueAbbreviation(identity.abbreviation);
  const description: TFieldValidationResult<string | null> = validateLeagueDescription(identity.description);
  const errors: Record<string, string> = {};

  // Collected in the order the section lists its controls, so the first entry is the one that takes focus
  if (!name.ok) {
    errors.name = name.message;
  }

  if (!abbreviation.ok) {
    errors.abbreviation = abbreviation.message;
  }

  if (!description.ok) {
    errors.description = description.message;
  }

  if (!name.ok || !abbreviation.ok || !description.ok) {
    return {
      errors,
      focus: Object.keys(errors)[0] ?? '',
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      abbreviation: abbreviation.value,
      description: description.value,
      name: name.value,
    },
  };
}

/**
 * Validates one section of the page before it is sent.
 *
 * Numeric faults come from the shared collector filtered to this section, so a fault in another section never blocks
 * this save, the messages are the server's own, and the first entry is the first control this section lists (Astra,
 * 2026-09-14). Formats also refuses an empty format list, which is not a numeric rule and has no stored counterpart:
 * the person is stopped before a request is made
 * @public
 * @function
 * @param section - The section being saved
 * @param draft - The draft as it stands
 * @param revision - The revision this section was loaded at
 * @returns The body to send, or every message and the field to focus
 */
export function buildSectionRequest(
  section: SettingsSection,
  draft: ISettingsDraft,
  revision: number,
): TSectionValidationResult<ISaveSettingsRequest> {
  if (section === SettingsSection.IDENTITY) {
    const identity: TSectionValidationResult<ILeagueIdentity> = validateIdentitySection(draft[section]);

    return identity.ok
      ? {
          ok: true,
          value: {
            identity: identity.value,
            revision,
            section,
            settings: {},
          },
        }
      : identity;
  }

  const candidate: Record<string, unknown> = toCandidateSettings(draft);
  const faults: ISettingsNumberIssue[] = collectLeagueSettingsNumberIssues(candidate).filter(
    (issue: ISettingsNumberIssue): boolean => ownsField(issue.field, section),
  );
  const errors: Record<string, string> = Object.fromEntries(
    faults.map((issue: ISettingsNumberIssue): [string, string] => [issue.field, issue.message]),
  );

  // The one refusal that is not a numeric rule, and the first control the section lists, so it takes focus first
  const gameTypes: TFieldValidationResult<GameType[]> | null =
    section === SettingsSection.FORMATS
      ? validateLeagueGameTypes(draft[SettingsSection.FORMATS].allowedGameTypes)
      : null;

  if (gameTypes !== null && !gameTypes.ok) {
    errors.allowedGameTypes = gameTypes.message;
  }

  const focus: string | undefined = errors.allowedGameTypes === undefined ? faults[0]?.field : 'allowedGameTypes';

  if (focus !== undefined) {
    return {
      errors,
      focus,
      ok: false,
    };
  }

  return {
    ok: true,
    value: {
      identity: null,
      revision,
      section,
      settings: Object.fromEntries(
        SETTINGS_SECTION_FIELDS[section].map((field: string): [string, unknown] => [field, candidate[field]]),
      ) as ISaveSettingsRequest['settings'],
    },
  };
}

/**
 * Decides what a section that did not save does with the configuration another section's save returned.
 *
 * A clean section takes the returned values silently. A dirty section keeps its draft and moves to the new revision
 * only when its own loaded baseline still equals that section in what came back; otherwise the configuration moved
 * underneath it and it has to show the comparison first. A draft is never handed a fresh revision merely because a
 * different section saved (page spec, Saving)
 * @public
 * @function
 * @param input - The section, its draft, its baseline and what the save returned
 * @returns Whether to adopt, whether it is stale, and the revision its next Save carries
 */
export function resolveSectionAdoption(input: ISectionAdoptionInput): ISectionAdoption {
  if (!input.dirty) {
    return {
      adopt: true,
      revision: input.returnedRevision,
      stale: false,
    };
  }

  const unchanged: boolean =
    JSON.stringify(input.loaded[input.section]) === JSON.stringify(input.returned[input.section]);

  return {
    adopt: false,
    revision: unchanged ? input.returnedRevision : input.revision,
    stale: !unchanged,
  };
}

/**
 * Whether a control is drawn at all.
 *
 * A control the league's own choices make irrelevant is hidden rather than disabled, and its stored value is left
 * exactly where it is. The one exception is the rule that makes a stored fault repairable: a field whose stored value
 * is outside its bounds or set is drawn even when it would be hidden, so the section that owns it can be corrected
 * and saved (page spec, Saving)
 * @public
 * @function
 * @param field - The control, as the editor addresses it
 * @param draft - The draft as it stands
 * @param revealed - The stored fields a fault is forcing into view
 * @returns Whether the control is drawn
 */
export function isFieldVisible(field: string, draft: ISettingsDraft, revealed: readonly string[]): boolean {
  if (revealed.includes(field)) {
    return true;
  }

  const formats: IFormatsDraft = draft[SettingsSection.FORMATS];
  const gameType: string | undefined = field.startsWith('targetScore.') ? field.split('.')[1] : undefined;

  if (gameType !== undefined) {
    return formats.allowedGameTypes.includes(gameType as GameType);
  }

  if (SINGLES_DOUBLES_FIELDS.includes(field as TSettingsControl)) {
    return SINGLES_DOUBLES_FORMATS.some((format: GameType): boolean => formats.allowedGameTypes.includes(format));
  }

  if (field === 'cutthroatTimeCap') {
    return formats.allowedGameTypes.includes(GameType.CUTTHROAT);
  }

  if (field === 'resultConfirmationWindow') {
    return draft[SettingsSection.RESULTS].requireConfirmation;
  }

  if (field === 'provisionalGames') {
    return draft[SettingsSection.RATINGS].ratingEnabled;
  }

  return true;
}

/**
 * One control's value as a person reads it.
 *
 * Numbers are shown exactly as the field holds them, so a stored fault reads as the value that is stored rather than
 * as a tidied version of it; a cleared description is named rather than left blank
 * @public
 * @function
 * @param field - The control, as the editor addresses it
 * @param draft - The draft the value is read from
 * @returns The value as a line of text
 */
export function toFieldDisplayValue(field: string, draft: ISettingsDraft): string {
  const formats: IFormatsDraft = draft[SettingsSection.FORMATS];
  const results: IResultsDraft = draft[SettingsSection.RESULTS];
  const ratings: IRatingsDraft = draft[SettingsSection.RATINGS];
  const identity: IIdentityDraft = draft[SettingsSection.IDENTITY];
  const gameType: string | undefined = field.startsWith('targetScore.') ? field.split('.')[1] : undefined;

  if (gameType !== undefined) {
    return String(formats.targetScore[gameType as GameType]);
  }

  switch (field) {
    case 'abbreviation':
      return identity.abbreviation;

    case 'allowedGameTypes':
      return LEAGUE_GAME_TYPE_ORDER.filter((format: GameType): boolean => formats.allowedGameTypes.includes(format))
        .map((format: GameType): string => GAME_TYPE_LABELS[format])
        .join(', ');

    case 'description':
      return identity.description === '' ? 'None' : identity.description;

    case 'expediteEnabled':
      return formats.expediteEnabled ? 'On' : 'Off';

    case 'matchFormat':
      return String(formats.matchFormat);

    case 'name':
      return identity.name;

    case 'ratingEnabled':
      return ratings.ratingEnabled ? 'On' : 'Off';

    case 'requireConfirmation':
      return results.requireConfirmation ? 'On' : 'Off';

    case 'whoCanCreateGames':
      return GAME_CREATOR_LABELS[results.whoCanCreateGames];

    case 'whoCanRecordResults':
      return RESULT_RECORDER_LABELS[results.whoCanRecordResults];

    default:
      return withUnit(field, readDraftText(field, draft));
  }
}

/**
 * The text a plain number control holds.
 * @internal
 * @function
 * @param field - The control
 * @param draft - The draft
 * @returns The field's text, or an empty string when the field is not a plain number
 */
function readDraftText(field: string, draft: ISettingsDraft): string {
  const holder: Record<string, unknown> = {
    ...draft[SettingsSection.FORMATS],
    ...draft[SettingsSection.RATINGS],
    ...draft[SettingsSection.RESULTS],
  };
  const value: unknown = holder[field];

  return typeof value === 'string' ? value : '';
}

/**
 * Appends a number's unit, leaving a cleared field without one.
 * @internal
 * @function
 * @param field - The control
 * @param text - The field's text
 * @returns The value as a line of text
 */
function withUnit(field: string, text: string): string {
  const unit: string | undefined = SETTINGS_FIELD_UNITS[field as TSettingsControl];

  return unit === undefined || text === '' ? text : `${text} ${unit}`;
}

/**
 * The rows a section shows to a viewer with no controls in it, and the rows a stale comparison lines up.
 *
 * A row carries the same message its control would, so a field a stored fault revealed reads as a fault to a role
 * with no controls in that section too; revealing still grants nobody editing (page spec, Saving)
 * @public
 * @function
 * @param section - The section
 * @param draft - The draft the values are read from
 * @param revealed - The stored fields a fault is forcing into view
 * @param messages - The message under each field, keyed as the editor addresses it
 * @returns One row per drawn control, in the order the page lays them out
 */
export function toSectionRows(
  section: SettingsSection,
  draft: ISettingsDraft,
  revealed: readonly string[],
  messages: TSectionFieldErrors,
): ISettingsRow[] {
  return SETTINGS_SECTION_CONTROL_ORDER[section]
    .filter((field: TSettingsControl): boolean => isFieldVisible(field, draft, revealed))
    .map((field: TSettingsControl): ISettingsRow => ({
      field,
      label: SETTINGS_FIELD_LABELS[field],
      message: messages[field] ?? null,
      value: toFieldDisplayValue(field, draft),
    }));
}

/**
 * Whether a configuration already holds exactly what a section submitted.
 *
 * Compared against the normalized body rather than against the draft's text, so a field typed as 02 and stored as 2 is
 * the same value; every field the section owns is compared, including the ones its controls were hiding
 * @public
 * @function
 * @param request - The body that was sent
 * @param configuration - The configuration as it now stands
 * @returns Whether the section is already stored as it was submitted
 */
export function matchesSubmittedSection(request: ISaveSettingsRequest, configuration: ILeagueConfiguration): boolean {
  if (request.identity !== null) {
    return (
      request.identity.name === configuration.name &&
      request.identity.abbreviation === configuration.abbreviation &&
      request.identity.description === configuration.description
    );
  }

  const stored: Record<string, unknown> = configuration.settings as unknown as Record<string, unknown>;
  const submitted: Record<string, unknown> = request.settings as Record<string, unknown>;

  return SETTINGS_SECTION_FIELDS[request.section].every(
    (field: string): boolean => JSON.stringify(stored[field]) === JSON.stringify(submitted[field]),
  );
}

/**
 * Reads a re-read after a save whose answer was lost.
 *
 * A section that is already stored as it was submitted committed, whatever else has moved since. Otherwise a moved
 * revision means something else was written and the draft is compared before anything is sent; an unmoved revision
 * means the write was lost, and the identical request may be sent again at the revision it carried, so a delayed first
 * write and its retry cannot both commit (page spec, Saving)
 * @public
 * @function
 * @param request - The body that was sent
 * @param configuration - The configuration the re-read returned
 * @returns What the section does next
 */
export function reconcileUncertainSave(
  request: ISaveSettingsRequest,
  configuration: ILeagueConfiguration,
): UncertainReconciliation {
  if (matchesSubmittedSection(request, configuration)) {
    return UncertainReconciliation.SAVED;
  }

  return configuration.configurationRevision === request.revision
    ? UncertainReconciliation.RETRY
    : UncertainReconciliation.STALE;
}

/**
 * The numeric faults a draft currently holds, keyed as the editor addresses its fields.
 *
 * Read from the draft rather than from what is stored, so a revealed control's message goes as soon as a usable value
 * is typed while the control itself stays revealed until a save corrects the stored value (Astra, 2026-09-14)
 * @public
 * @function
 * @param draft - The draft as it stands
 * @returns One message per faulty field
 */
export function collectDraftFaultErrors(draft: ISettingsDraft): TSectionFieldErrors {
  return Object.fromEntries(
    collectLeagueSettingsNumberIssues(toCandidateSettings(draft)).map(
      (issue: ISettingsNumberIssue): [string, string] => [issue.field, issue.message],
    ),
  );
}

/**
 * The alert a definite refusal shows above a section's controls.
 *
 * Only the refusals the page words differently are named; everything else the server refuses reads the same, because
 * a person cannot act on the difference between one 4xx and another
 * @public
 * @function
 * @param failure - How the write failed
 * @returns The alert to show
 */
export function toRefusalAlert(failure: WriteFailure): SettingsSectionAlert {
  if (failure === WriteFailure.FORBIDDEN) {
    return SettingsSectionAlert.FORBIDDEN;
  }

  return failure === WriteFailure.RATE_LIMITED ? SettingsSectionAlert.RATE_LIMITED : SettingsSectionAlert.REFUSED;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(readWholeNumberInput, {
  name: 'Read Whole Number Input',
  description: 'Reads a typed whole number, leaving anything else as it was typed.',
});

defineSymbol(toSettingsDraft, {
  name: 'To Settings Draft',
  description: "Builds the settings page's four section drafts from a configuration.",
});

defineSymbol(isSectionDirty, {
  name: 'Is Section Dirty',
  description: 'Whether one section differs from the values it was loaded with.',
});

defineSymbol(collectPersistedFaults, {
  name: 'Collect Persisted Faults',
  description: 'The stored numeric fields a page reveals until they are corrected.',
});

defineSymbol(buildSectionRequest, {
  name: 'Build Section Request',
  description: 'Validates one section against its own fields and builds the body it sends.',
});

defineSymbol(isFieldVisible, {
  name: 'Is Field Visible',
  description: 'Whether a control is drawn, including the stored fault that forces a hidden one into view.',
});

defineSymbol(toFieldDisplayValue, {
  name: 'To Field Display Value',
  description: "One control's value as a person reads it.",
});

defineSymbol(toSectionRows, {
  name: 'To Section Rows',
  description: 'The rows a read-only section shows and a stale comparison lines up.',
});

defineSymbol(collectDraftFaultErrors, {
  name: 'Collect Draft Fault Errors',
  description: "The numeric faults a draft currently holds, for a revealed control's inline message.",
});

defineSymbol(toRefusalAlert, {
  name: 'To Refusal Alert',
  description: "The alert a definite refusal shows above a section's controls.",
});

defineSymbol(matchesSubmittedSection, {
  name: 'Matches Submitted Section',
  description: 'Whether a configuration already holds exactly what a section submitted.',
});

defineSymbol(reconcileUncertainSave, {
  name: 'Reconcile Uncertain Save',
  description: 'Reads a re-read after a save whose answer was lost.',
});

defineSymbol(resolveSectionAdoption, {
  name: 'Resolve Section Adoption',
  description: "Decides what a section does with a configuration another section's save returned.",
});
