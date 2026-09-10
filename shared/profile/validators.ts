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
 * Validation for the one profile field a player owns.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import {
  DISPLAY_NAME_EMPTY_MESSAGE,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_REJECTED_STATUS,
  DISPLAY_NAME_TOO_LONG_MESSAGE,
  PROFILE_BODY_REJECTED_STATUS,
  PROFILE_BODY_SHAPE_MESSAGE,
  PROFILE_BODY_UNKNOWN_FIELD_MESSAGE,
  PROFILE_WRITE_BODY_FIELDS,
} from './constants';
import type { TDisplayNameValidationResult, TProfileWriteBodyResult } from './types';

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
