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

import { DISPLAY_NAME_EMPTY_MESSAGE, DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_TOO_LONG_MESSAGE } from './constants';
import type { TDisplayNameValidationResult } from './types';

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

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(validateDisplayName, {
  name: 'Validate Display Name',
  description: 'Validates and trims an untrusted display name against the shared length rule.',
});
