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
 * ███████████████████████████████████████████ #utils/leagues/entry/utils.ts ███████████████████████████████████████████
 *
 * Reads pasted invites, builds invite links and prefills short marks from league names.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { INVITE_TOKEN_PATTERN } from '#shared/leagues';
import { defineSymbol } from '#shared/utils/symbol';

import { DERIVED_ABBREVIATION_MAX_LENGTH, INVITE_INPUT_MAX_LENGTH, INVITE_PATH_PREFIX } from './constants';

/**
 * Prefills a short mark from a league name: the first letter or digit of each word, uppercased.
 *
 * Measured and cut by code point after uppercasing, so the prefill can never be a value the validator refuses for
 * length
 * @public
 * @function
 * @param name - The league name as typed
 * @returns The derived short mark, or an empty string when the name has no letters or digits
 */
export function deriveAbbreviation(name: string): string {
  const initials: string = name
    .trim()
    .split(/\s+/u)
    .map((word: string): string => word.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .join('')
    .toUpperCase();

  return Array.from(initials).slice(0, DERIVED_ABBREVIATION_MAX_LENGTH).join('');
}

/**
 * Reads a pasted invite as its token: either the bare token, or an exact same-origin invite link.
 *
 * Parsed with the URL API and never fetched. A foreign host, credentials, any path other than the invite landing, a
 * query, a fragment, whitespace inside the value, or a malformed token all come back null, and the join page shows one
 * message for every one of them so the field cannot be used to probe
 * @public
 * @function
 * @param input - The pasted value
 * @param origin - This deployment's origin, which a pasted link must match exactly
 * @returns The token, or null when the value is not a Pongifi invite
 */
export function parseInviteInput(input: string, origin: string): string | null {
  const value: string = input.trim();

  if (value.length === 0 || value.length > INVITE_INPUT_MAX_LENGTH || /\s/u.test(value)) {
    return null;
  }

  // The pattern rather than the type guard: the value is already a string, and a failed guard would narrow it to never
  if (INVITE_TOKEN_PATTERN.test(value)) {
    return value;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    // Not a URL and not a token; the caller shows its one refusal
    return null;
  }

  // The raw value is checked for a query and fragment too, because the parser drops an empty `?` or `#`
  if (
    url.origin !== origin ||
    url.username !== '' ||
    url.password !== '' ||
    value.includes('?') ||
    value.includes('#') ||
    !url.pathname.startsWith(INVITE_PATH_PREFIX)
  ) {
    return null;
  }

  const token: string = url.pathname.slice(INVITE_PATH_PREFIX.length);

  return INVITE_TOKEN_PATTERN.test(token) ? token : null;
}

/**
 * Builds the invite link a commissioner copies.
 * @public
 * @function
 * @param origin - This deployment's origin
 * @param token - The usable link's token
 * @returns The full invite URL
 */
export function buildInviteUrl(origin: string, token: string): string {
  return `${origin}${INVITE_PATH_PREFIX}${token}`;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(deriveAbbreviation, {
  name: 'Derive Abbreviation',
  description: 'Prefills a short mark from the initials of a league name.',
});

defineSymbol(parseInviteInput, {
  name: 'Parse Invite Input',
  description: 'Reads a pasted invite as its token, refusing anything that is not a same-origin invite.',
});

defineSymbol(buildInviteUrl, {
  name: 'Build Invite URL',
  description: 'Builds the invite link a commissioner copies.',
});
