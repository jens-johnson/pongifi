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
 * ███████████████████████████████████████████ #shared/leagues/validators.ts ███████████████████████████████████████████
 *
 * Validators for league creation and invite-link request bodies, invite tokens and identifiers.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { GameCreator, ResultRecorder } from '#shared/domain';
import type { TBoundedSetting } from '#shared/league-settings';
import {
  LEAGUE_SETTINGS_NUMERIC_BOUNDS,
  TARGET_SCORE_FORMAT_ORDER,
  validateBoundedSetting,
  validateMatchFormat,
  validateTargetScore,
} from '#shared/league-settings';
import type { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import {
  CREATE_LEAGUE_BODY_FIELDS,
  INVITE_EXPIRY_DAY_CHOICES,
  INVITE_MAX_USES_CEILING,
  INVITE_TOKEN_PATTERN,
  ISSUE_INVITE_BODY_FIELDS,
  LEAGUE_ABBREVIATION_EMPTY_MESSAGE,
  LEAGUE_ABBREVIATION_MAX_LENGTH,
  LEAGUE_ABBREVIATION_TOO_LONG_MESSAGE,
  LEAGUE_BODY_MALFORMED_MESSAGE,
  LEAGUE_BODY_REJECTED_STATUS,
  LEAGUE_DESCRIPTION_MAX_LENGTH,
  LEAGUE_DESCRIPTION_TOO_LONG_MESSAGE,
  LEAGUE_GAME_TYPE_ORDER,
  LEAGUE_GAME_TYPES_EMPTY_MESSAGE,
  LEAGUE_NAME_EMPTY_MESSAGE,
  LEAGUE_NAME_MAX_LENGTH,
  LEAGUE_NAME_TOO_LONG_MESSAGE,
  LEAGUE_VALUE_REJECTED_STATUS,
  REPLACE_INVITE_BODY_FIELDS,
  SETTINGS_SECTION_FIELDS,
  UUID_PATTERN,
} from './constants';
import { SettingsSection } from './enums';
import type {
  IBodyValidationFailure,
  ICreateLeagueRequest,
  IFieldValidationFailure,
  IInviteLinkOptions,
  IIssueInviteRequest,
  ILeagueIdentity,
  ISaveSettingsRequest,
  TBodyValidationResult,
  TFieldValidationResult,
} from './types';

/**
 * The refusal every malformed body shares.
 * @internal
 * @constant
 */
const MALFORMED: IBodyValidationFailure = {
  message: LEAGUE_BODY_MALFORMED_MESSAGE,
  ok: false,
  statusCode: LEAGUE_BODY_REJECTED_STATUS,
};

/**
 * Counts characters the way Postgres does, by code point rather than UTF-16 unit, so a limit checked here is the limit
 * the column enforces.
 * @internal
 * @function
 * @param value - The string to measure
 * @returns The number of code points in the string
 */
function countCharacters(value: string): number {
  return Array.from(value).length;
}

/**
 * Whether a value is a string carrying a NUL character, which no text column can store.
 * @internal
 * @function
 * @param value - The untrusted value
 * @returns Whether the value holds U+0000
 */
function hasNul(value: unknown): boolean {
  return typeof value === 'string' && value.includes('\u0000');
}

/**
 * Whether an untrusted body is a plain object carrying only the allowed fields.
 * @internal
 * @function
 * @param body - The parsed request body, straight from the wire
 * @param fields - The fields the endpoint accepts
 * @returns Whether the body can be read field by field
 */
function isAllowlistedObject(body: unknown, fields: readonly string[]): body is Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return false;
  }

  return Object.keys(body).every((field: string): boolean => fields.includes(field));
}

/**
 * Turns a field refusal into a body refusal carrying the status for a well-formed body with an unusable value.
 * @internal
 * @function
 * @param failure - The field that failed
 * @returns The body refusal
 */
function refuseValue(failure: IFieldValidationFailure): IBodyValidationFailure {
  return {
    message: failure.message,
    ok: false,
    statusCode: LEAGUE_VALUE_REJECTED_STATUS,
  };
}

/**
 * Validates an untrusted league name and returns the trimmed value to store.
 * @public
 * @function
 * @param input - The untrusted value
 * @returns The trimmed name, or the message the form shows
 */
export function validateLeagueName(input: unknown): TFieldValidationResult<string> {
  const trimmed: string = typeof input === 'string' ? input.trim() : '';

  if (trimmed.length === 0) {
    return { message: LEAGUE_NAME_EMPTY_MESSAGE, ok: false };
  }

  if (countCharacters(trimmed) > LEAGUE_NAME_MAX_LENGTH) {
    return { message: LEAGUE_NAME_TOO_LONG_MESSAGE, ok: false };
  }

  return { ok: true, value: trimmed };
}

/**
 * Validates an untrusted short mark and returns the uppercased value to store.
 *
 * The length is checked on the uppercased value, because uppercasing can lengthen a string (a sharp s becomes SS) and
 * the column holds eight characters. A value that grows past the limit is refused, never truncated
 * @public
 * @function
 * @param input - The untrusted value
 * @returns The uppercased short mark, or the message the form shows
 */
export function validateLeagueAbbreviation(input: unknown): TFieldValidationResult<string> {
  const normalized: string = typeof input === 'string' ? input.trim().toUpperCase() : '';

  if (normalized.length === 0) {
    return { message: LEAGUE_ABBREVIATION_EMPTY_MESSAGE, ok: false };
  }

  if (countCharacters(normalized) > LEAGUE_ABBREVIATION_MAX_LENGTH) {
    return { message: LEAGUE_ABBREVIATION_TOO_LONG_MESSAGE, ok: false };
  }

  return { ok: true, value: normalized };
}

/**
 * Validates an untrusted description and returns the trimmed value, or null when it is empty.
 * @public
 * @function
 * @param input - The untrusted value; null and undefined mean no description
 * @returns The trimmed description or null, or the message the form shows
 */
export function validateLeagueDescription(input: unknown): TFieldValidationResult<string | null> {
  const trimmed: string = typeof input === 'string' ? input.trim() : '';

  if (countCharacters(trimmed) > LEAGUE_DESCRIPTION_MAX_LENGTH) {
    return { message: LEAGUE_DESCRIPTION_TOO_LONG_MESSAGE, ok: false };
  }

  return { ok: true, value: trimmed.length === 0 ? null : trimmed };
}

/**
 * Validates an untrusted format selection and returns it deduplicated in canonical order.
 * @public
 * @function
 * @param input - The untrusted value, expected to be an array of format names
 * @returns The selected formats, or the message the form shows when none are selected
 */
export function validateLeagueGameTypes(input: unknown): TFieldValidationResult<GameType[]> {
  const selected: unknown[] = Array.isArray(input) ? input : [];

  // Canonical order doubles as deduplication: each format appears once, where the form lists it
  const normalized: GameType[] = LEAGUE_GAME_TYPE_ORDER.filter((gameType: GameType): boolean =>
    selected.includes(gameType),
  );

  if (normalized.length === 0) {
    return { message: LEAGUE_GAME_TYPES_EMPTY_MESSAGE, ok: false };
  }

  return { ok: true, value: normalized };
}

/**
 * Validates an untrusted `POST /api/leagues` body against the published allowlist and field rules.
 *
 * A body carrying an unknown field, a format name that does not exist, a submission identifier that is not a UUID, or
 * a NUL character in any text field is malformed. A well-formed body carrying an unusable value is refused with that field's message
 * @public
 * @function
 * @param body - The parsed request body, straight from the wire
 * @returns The normalized request, or the message and status the request is refused with
 */
export function validateCreateLeagueBody(body: unknown): TBodyValidationResult<ICreateLeagueRequest> {
  if (!isAllowlistedObject(body, CREATE_LEAGUE_BODY_FIELDS)) {
    return MALFORMED;
  }

  const { allowedGameTypes, submissionId }: Record<string, unknown> = body;

  // Structural checks first: these are not typos a person could make in the form
  if (!isUuid(submissionId) || !Array.isArray(allowedGameTypes)) {
    return MALFORMED;
  }

  if (allowedGameTypes.some((gameType: unknown): boolean => !LEAGUE_GAME_TYPE_ORDER.includes(gameType as GameType))) {
    return MALFORMED;
  }

  // Postgres cannot store a NUL in text, so one would come back as a database failure the page reads as uncertain
  if ([body.name, body.abbreviation, body.description].some((value: unknown): boolean => hasNul(value))) {
    return MALFORMED;
  }

  const name: TFieldValidationResult<string> = validateLeagueName(body.name);
  const abbreviation: TFieldValidationResult<string> = validateLeagueAbbreviation(body.abbreviation);
  const description: TFieldValidationResult<string | null> = validateLeagueDescription(body.description);
  const gameTypes: TFieldValidationResult<GameType[]> = validateLeagueGameTypes(allowedGameTypes);

  // Checked in form order, so the refusal names the first field the form would have flagged
  if (!name.ok) {
    return refuseValue(name);
  }

  if (!abbreviation.ok) {
    return refuseValue(abbreviation);
  }

  if (!description.ok) {
    return refuseValue(description);
  }

  if (!gameTypes.ok) {
    return refuseValue(gameTypes);
  }

  return {
    ok: true,
    value: {
      abbreviation: abbreviation.value,
      allowedGameTypes: gameTypes.value,
      description: description.value,
      name: name.value,
      submissionId: submissionId.toLowerCase(),
    },
  };
}

/**
 * Validates the expiry and use-limit choices shared by the create and replace bodies.
 * @internal
 * @function
 * @param body - The allowlisted body
 * @returns The options, or null when either value is not one the panel can send
 */
function readInviteLinkOptions(body: Record<string, unknown>): IInviteLinkOptions | null {
  const { expiresInDays, maxUses }: Record<string, unknown> = body;

  if (typeof expiresInDays !== 'number' || !INVITE_EXPIRY_DAY_CHOICES.includes(expiresInDays)) {
    return null;
  }

  // Absent and null both mean no limit; anything else must fit the integer column and allow at least one use
  if (maxUses === undefined || maxUses === null) {
    return { expiresInDays, maxUses: null };
  }

  if (typeof maxUses !== 'number' || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > INVITE_MAX_USES_CEILING) {
    return null;
  }

  return { expiresInDays, maxUses };
}

/**
 * Validates an untrusted body for creating an invite link.
 * @public
 * @function
 * @param body - The parsed request body, straight from the wire
 * @returns The request, or the message and status it is refused with
 */
export function validateIssueInviteBody(body: unknown): TBodyValidationResult<IIssueInviteRequest> {
  if (!isAllowlistedObject(body, ISSUE_INVITE_BODY_FIELDS)) {
    return MALFORMED;
  }

  const options: IInviteLinkOptions | null = readInviteLinkOptions(body);
  const { previousId }: Record<string, unknown> = body;

  if (!options || (previousId !== undefined && previousId !== null && !isUuid(previousId))) {
    return MALFORMED;
  }

  return { ok: true, value: { ...options, previousId: isUuid(previousId) ? previousId.toLowerCase() : null } };
}

/**
 * Validates an untrusted body for replacing an invite link.
 * @public
 * @function
 * @param body - The parsed request body, straight from the wire
 * @returns The options, or the message and status the request is refused with
 */
export function validateReplaceInviteBody(body: unknown): TBodyValidationResult<IInviteLinkOptions> {
  if (!isAllowlistedObject(body, REPLACE_INVITE_BODY_FIELDS)) {
    return MALFORMED;
  }

  const options: IInviteLinkOptions | null = readInviteLinkOptions(body);

  return options ? { ok: true, value: options } : MALFORMED;
}

/**
 * Whether a value has the exact shape of an invite token.
 * @public
 * @function
 * @param input - The untrusted value
 * @returns Whether the value is 43 base64url characters
 */
export function isInviteToken(input: unknown): input is string {
  return typeof input === 'string' && INVITE_TOKEN_PATTERN.test(input);
}

/**
 * Whether a value has the shape of a UUID.
 * @public
 * @function
 * @param input - The untrusted value
 * @returns Whether the value can be handed to a `uuid` column without a cast error
 */
export function isUuid(input: unknown): input is string {
  return typeof input === 'string' && UUID_PATTERN.test(input);
}

/* ─── Settings Page ──────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The outcome of reading one settings field: the value, the message its control shows, or null for a value no control
 * could have produced, which makes the whole body malformed rather than a field a person can fix.
 * @internal
 */
type TSettingsFieldResult = IFieldValidationFailure | ISettingsFieldSuccess | null;

/**
 * An accepted settings field, before it is put back into the section's object.
 * @internal
 * @interface
 */
interface ISettingsFieldSuccess {
  /* The field satisfied its rule */
  ok: true;

  /* The value to store */
  value: unknown;
}

/**
 * Whether an untrusted value is one of an enum's members.
 * @internal
 * @function
 * @param values - The enum's members
 * @param input - The untrusted value
 * @returns Whether the value is one of them
 */
function isMember<TValue extends string>(values: readonly TValue[], input: unknown): input is TValue {
  return typeof input === 'string' && (values as readonly string[]).includes(input);
}

/**
 * Reads the target scores, which arrive as one object carrying every format whether or not the league allows it.
 * @internal
 * @function
 * @param input - The untrusted value
 * @returns The scores, the first format's message, or null when the shape is not one the page could have sent
 */
function readTargetScores(input: unknown): TSettingsFieldResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return null;
  }

  const candidate: Record<string, unknown> = input as Record<string, unknown>;

  // Every format, and nothing else: a partial object would leave a hidden format's score to be guessed at the merge
  if (
    !Object.keys(candidate).every((format: string): boolean => TARGET_SCORE_FORMAT_ORDER.includes(format as GameType))
  ) {
    return null;
  }

  if (Object.keys(candidate).length !== TARGET_SCORE_FORMAT_ORDER.length) {
    return null;
  }

  const scores: Record<string, number> = {};

  for (const gameType of TARGET_SCORE_FORMAT_ORDER) {
    const score: TFieldValidationResult<number> = validateTargetScore(gameType, candidate[gameType]);

    if (!score.ok) {
      return score;
    }

    scores[gameType] = score.value;
  }

  return { ok: true, value: scores };
}

/**
 * Reads one field of a settings section.
 *
 * A toggle or a select carries a value no person types, so anything but one of its members makes the body malformed; a
 * number a person does type is refused with the message its field shows
 * @internal
 * @function
 * @param field - The field being read, already known to belong to the section
 * @param input - The untrusted value
 * @returns The value, the message the field shows, or null when the body is malformed
 */
function readSettingsField(field: string, input: unknown): TSettingsFieldResult {
  switch (field) {
    case 'allowedGameTypes': {
      if (
        !Array.isArray(input) ||
        input.some((gameType: unknown): boolean => !LEAGUE_GAME_TYPE_ORDER.includes(gameType as GameType))
      ) {
        return null;
      }

      return validateLeagueGameTypes(input);
    }

    case 'expediteEnabled':
    case 'ratingEnabled':
    case 'requireConfirmation':
      return typeof input === 'boolean' ? { ok: true, value: input } : null;

    case 'matchFormat':
      return validateMatchFormat(input);

    case 'targetScore':
      return readTargetScores(input);

    case 'whoCanCreateGames':
      return isMember(Object.values(GameCreator), input) ? { ok: true, value: input } : null;

    case 'whoCanRecordResults':
      return isMember(Object.values(ResultRecorder), input) ? { ok: true, value: input } : null;

    default:
      return field in LEAGUE_SETTINGS_NUMERIC_BOUNDS ? validateBoundedSetting(field as TBoundedSetting, input) : null;
  }
}

/**
 * Reads the Identity section, whose three fields are the create form's, with the create form's limits and messages.
 * @internal
 * @function
 * @param body - The allowlisted body
 * @returns The profile fields, or the refusal
 */
function readIdentitySection(body: Record<string, unknown>): TBodyValidationResult<ILeagueIdentity> {
  // Postgres cannot store a NUL in text, so one would come back as a database failure the page reads as uncertain
  if ([body.name, body.abbreviation, body.description].some((value: unknown): boolean => hasNul(value))) {
    return MALFORMED;
  }

  const name: TFieldValidationResult<string> = validateLeagueName(body.name);
  const abbreviation: TFieldValidationResult<string> = validateLeagueAbbreviation(body.abbreviation);
  const description: TFieldValidationResult<string | null> = validateLeagueDescription(body.description);

  // Checked in the order the section lists them, so the refusal names the first field the page would have flagged
  if (!name.ok) {
    return refuseValue(name);
  }

  if (!abbreviation.ok) {
    return refuseValue(abbreviation);
  }

  if (!description.ok) {
    return refuseValue(description);
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
 * Validates an untrusted settings-page save.
 *
 * One section at a time, carrying the revision its page loaded at and every field that section owns, including the
 * ones its controls are hiding. A field the section does not own, a field it left out, an unknown section, or a
 * revision that is not a whole number makes the body malformed; a value a control could have produced is refused with that field's own
 * message. Nothing here decides whether the caller may save the section, which is a role check the write makes against
 * a fresh read
 * @public
 * @function
 * @param body - The parsed request body, straight from the wire
 * @returns The normalized save, or the message and status it is refused with
 */
export function validateSaveSettingsBody(body: unknown): TBodyValidationResult<ISaveSettingsRequest> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return MALFORMED;
  }

  const candidate: Record<string, unknown> = body as Record<string, unknown>;
  const section: unknown = candidate.section;

  if (!isMember(Object.values(SettingsSection), section)) {
    return MALFORMED;
  }

  const fields: readonly string[] = SETTINGS_SECTION_FIELDS[section];

  if (!isAllowlistedObject(body, ['revision', 'section', ...fields])) {
    return MALFORMED;
  }

  const { revision }: Record<string, unknown> = candidate;

  // A revision is the server's own counter coming back; a person never types one, and it starts at one
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) {
    return MALFORMED;
  }

  if (section === SettingsSection.IDENTITY) {
    const identity: TBodyValidationResult<ILeagueIdentity> = readIdentitySection(candidate);

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

  const settings: Record<string, unknown> = {};

  for (const field of fields) {
    // Present, not merely allowed: a section that left a field out would take its stored value on trust, which is
    // exactly the hidden-value drift submitting the whole section exists to prevent
    if (!(field in candidate)) {
      return MALFORMED;
    }

    const value: TSettingsFieldResult = readSettingsField(field, candidate[field]);

    if (value === null) {
      return MALFORMED;
    }

    if (!value.ok) {
      return refuseValue(value);
    }

    settings[field] = value.value;
  }

  return {
    ok: true,
    value: {
      identity: null,
      revision,
      section,
      settings,
    },
  };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(validateLeagueName, {
  name: 'Validate League Name',
  description: 'Validates and trims an untrusted league name.',
});

defineSymbol(validateLeagueAbbreviation, {
  name: 'Validate League Abbreviation',
  description: 'Validates and uppercases an untrusted short mark, measuring after uppercasing.',
});

defineSymbol(validateLeagueDescription, {
  name: 'Validate League Description',
  description: 'Validates and trims an untrusted description, storing null for an empty one.',
});

defineSymbol(validateLeagueGameTypes, {
  name: 'Validate League Game Types',
  description: 'Validates an untrusted format selection into canonical order.',
});

defineSymbol(validateCreateLeagueBody, {
  name: 'Validate Create League Body',
  description: 'Validates an untrusted create-league body against its allowlist and field rules.',
});

defineSymbol(validateIssueInviteBody, {
  name: 'Validate Issue Invite Body',
  description: 'Validates an untrusted body for creating an invite link.',
});

defineSymbol(validateReplaceInviteBody, {
  name: 'Validate Replace Invite Body',
  description: 'Validates an untrusted body for replacing an invite link.',
});

defineSymbol(isInviteToken, {
  name: 'Is Invite Token',
  description: 'Reports whether a value has the exact shape of an invite token.',
});

defineSymbol(validateSaveSettingsBody, {
  name: 'Validate Save Settings Body',
  description: 'Validates one settings-page section save against its allowlist, field rules and revision.',
});

defineSymbol(isUuid, {
  name: 'Is UUID',
  description: 'Reports whether a value has the shape of a UUID.',
});
