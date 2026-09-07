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
 * █████████████████████████████████████████ #utils/sign-in/redirect/utils.ts ██████████████████████████████████████████
 *
 * Narrows an attacker-controlled return path to something safe to navigate to.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import { LEAGUES_ROUTE } from '../../marketing/routes';

/**
 * The highest code point treated as unsafe at the low end: everything up to and including the space
 * @internal
 * @constant
 */
const LAST_UNSAFE_LOW_CODE_POINT: number = 0x20;

/**
 * The delete character, unsafe for the same reason the C0 controls are
 * @internal
 * @constant
 */
const DELETE_CODE_POINT: number = 0x7f;

/**
 * Whether the value carries a character that has no business in a path: a C0 control, a space, or DEL.
 *
 * A raw newline inside the value is what lets a second target hide behind a check that only reads as far as the first
 * line. Written as a code-point scan rather than a regular expression, because a character class spanning the control
 * range is itself what `no-control-regex` exists to flag
 * @internal
 * @function
 * @param value - The candidate path
 * @returns Whether the value should be rejected out of hand
 */
function hasUnsafeCharacter(value: string): boolean {
  for (const character of value) {
    const code: number = character.codePointAt(0) ?? 0;

    if (code <= LAST_UNSAFE_LOW_CODE_POINT || code === DELETE_CODE_POINT) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves where to send a visitor once they are signed in.
 *
 * The value arrives from the query string, so it is attacker-controlled. A sign-in page that forwards to whatever it
 * is handed is an open redirect, and the usual consequence is a convincing phishing hop that begins on a domain the
 * visitor already trusts. Only a same-origin absolute path is accepted; anything else falls back to the default
 * destination rather than being repaired, because guessing at a caller's intent is how a bypass gets reintroduced
 * @public
 * @function
 * @param raw - The candidate path, straight from the query string
 * @returns A path that is safe to navigate to
 */
export function resolveSignInRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    return LEAGUES_ROUTE;
  }

  if (hasUnsafeCharacter(raw)) {
    return LEAGUES_ROUTE;
  }

  // must be an absolute path, and must not be protocol-relative; browsers read a backslash here as a slash
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return LEAGUES_ROUTE;
  }

  return raw;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(resolveSignInRedirect, {
  name: 'Resolve Sign In Redirect',
  description: 'Narrows an attacker-controlled return path to a same-origin path, or the default destination.',
});
