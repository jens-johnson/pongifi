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
 * ███████████████████████████████████████████ #shared/profile/validators.ts ███████████████████████████████████████████
 *
 * Validation for profile writes and membership-list query parameters.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { LeagueRole } from '#shared/domain';
import { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import {
  DEFAULT_LEAGUE_MEMBERSHIP_SORT,
  DISPLAY_NAME_EMPTY_MESSAGE,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_REJECTED_STATUS,
  DISPLAY_NAME_TOO_LONG_MESSAGE,
  HOME_LEAGUES_PAGE_SIZE,
  LEAGUE_MEMBERSHIP_MAX_PAGE,
  LEAGUE_MEMBERSHIP_SEARCH_MAX_LENGTH,
  LEAGUES_LIST_PAGE_SIZE,
  PROFILE_BODY_REJECTED_STATUS,
  PROFILE_BODY_SHAPE_MESSAGE,
  PROFILE_BODY_UNKNOWN_FIELD_MESSAGE,
  PROFILE_WRITE_BODY_FIELDS,
} from './constants';
import { LeagueMembershipSort } from './enums';
import type { ILeagueMembershipQuery, TDisplayNameValidationResult, TProfileWriteBodyResult } from './types';

/**
 * Validates an untrusted display name and returns the trimmed value to store.
 *
 * Shared deliberately: the profile form, the welcome form and both write endpoints apply this one rule, so a name the
 * browser accepted can never be one the server rejects, and the messages the user reads are the messages tested here.
 * @public
 * @function
 * @param input - The untrusted value submitted by the browser
 * @returns The trimmed name, or `{ ok: false }` with the message the form shows
 */
export function validateDisplayName(input: unknown): TDisplayNameValidationResult {
  // A non-string is a malformed request rather than a typo, but it fails the same way the empty field does
  if (typeof input !== 'string') {
    return { ok: false, message: DISPLAY_NAME_EMPTY_MESSAGE };
  }

  const trimmed: string = input.trim();

  if (trimmed.length === 0) {
    return { ok: false, message: DISPLAY_NAME_EMPTY_MESSAGE };
  }

  // Measured after trimming, so trailing spaces cannot push an otherwise valid name over the limit
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return { ok: false, message: DISPLAY_NAME_TOO_LONG_MESSAGE };
  }

  return { ok: true, value: trimmed };
}

/**
 * Validates an untrusted profile write body against the allowlist the endpoints publish.
 *
 * The contract for `PATCH /api/me` and `POST /api/me/complete` is `{ displayName }` and nothing else, so a body
 * carrying anything further is refused rather than quietly filtered. Filtering is the more forgiving behaviour and the
 * worse one: a client sending `email` or `id` would be told its request succeeded while the field it cared about was
 * dropped on the floor. The two refusals carry different statuses because they are different failures - a body of the
 * wrong shape is malformed, a well-formed body holding an unusable name is not
 * @public
 * @function
 * @param body - The parsed request body, straight from the wire
 * @returns The trimmed name to persist, or the message and status the request is refused with
 */
export function validateProfileWriteBody(body: unknown): TProfileWriteBodyResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      message: PROFILE_BODY_SHAPE_MESSAGE,
      statusCode: PROFILE_BODY_REJECTED_STATUS,
    };
  }

  const fields: string[] = Object.keys(body);

  // The rejected names are not echoed back; the caller knows what it sent, and a response is a poor place to repeat it
  if (fields.some((field: string): boolean => !PROFILE_WRITE_BODY_FIELDS.includes(field))) {
    return {
      ok: false,
      message: PROFILE_BODY_UNKNOWN_FIELD_MESSAGE,
      statusCode: PROFILE_BODY_REJECTED_STATUS,
    };
  }

  const result: TDisplayNameValidationResult = validateDisplayName((body as Record<string, unknown>).displayName);

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      statusCode: DISPLAY_NAME_REJECTED_STATUS,
    };
  }

  return { ok: true, value: result.value };
}

/**
 * Reads the first scalar from a query-string value.
 * @internal
 * @function
 * @param input - An untrusted query-string value
 * @returns The first string value, or an empty string
 */
function readQueryValue(input: unknown): string {
  const value: unknown = Array.isArray(input) ? input[0] : input;

  return typeof value === 'string' ? value : '';
}

/**
 * Normalizes a one-based page into the bounded arithmetic range.
 * @internal
 * @function
 * @param input - An untrusted query-string value
 * @returns A bounded one-based page
 */
function readPage(input: unknown): number {
  const value: string = readQueryValue(input);

  if (!/^\d+$/.test(value)) {
    return 1;
  }

  return Math.min(Math.max(Number(value), 1), LEAGUE_MEMBERSHIP_MAX_PAGE);
}

/**
 * Selects one of the two consumer page sizes.
 * @internal
 * @function
 * @param input - An untrusted query-string value
 * @returns The Home or full-list page size
 */
function readPageSize(input: unknown): number {
  const value: number = Number(readQueryValue(input));

  return value === HOME_LEAGUES_PAGE_SIZE || value === LEAGUES_LIST_PAGE_SIZE ? value : LEAGUES_LIST_PAGE_SIZE;
}

/**
 * Normalizes an untrusted membership query into the server's bounded allowlisted contract.
 * @public
 * @function
 * @param input - The request query or a route-query projection
 * @returns The normalized membership query
 */
export function normalizeLeagueMembershipQuery(input: Readonly<Record<string, unknown>>): ILeagueMembershipQuery {
  const formatValue: string = readQueryValue(input.format);
  const roleValue: string = readQueryValue(input.role);
  const sortValue: string = readQueryValue(input.sort);
  const search: string = readQueryValue(input.search).trim().slice(0, LEAGUE_MEMBERSHIP_SEARCH_MAX_LENGTH);

  return {
    format: Object.values(GameType).includes(formatValue as GameType) ? (formatValue as GameType) : null,
    page: readPage(input.page),
    pageSize: readPageSize(input.pageSize),
    role: Object.values(LeagueRole).includes(roleValue as LeagueRole) ? (roleValue as LeagueRole) : null,
    search,
    sort: Object.values(LeagueMembershipSort).includes(sortValue as LeagueMembershipSort)
      ? (sortValue as LeagueMembershipSort)
      : DEFAULT_LEAGUE_MEMBERSHIP_SORT,
  };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(validateDisplayName, {
  name: 'Validate Display Name',
  description: 'Validates and trims an untrusted display name against the shared length rule.',
});

defineSymbol(validateProfileWriteBody, {
  name: 'Validate Profile Write Body',
  description: "Validates an untrusted profile write body against the endpoints' published allowlist.",
});

defineSymbol(normalizeLeagueMembershipQuery, {
  name: 'Normalize League Membership Query',
  description: 'Normalizes an untrusted membership query into bounded allowlisted values.',
});
