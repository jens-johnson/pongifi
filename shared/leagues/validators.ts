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
  UUID_PATTERN,
} from './constants';
import type {
  IBodyValidationFailure,
  ICreateLeagueRequest,
  IFieldValidationFailure,
  IInviteLinkOptions,
  IIssueInviteRequest,
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
 * A body carrying an unknown field, a format name that does not exist, or a submission identifier that is not a UUID
 * is malformed. A well-formed body carrying an unusable value is refused with that field's message
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

defineSymbol(isUuid, {
  name: 'Is UUID',
  description: 'Reports whether a value has the shape of a UUID.',
});
