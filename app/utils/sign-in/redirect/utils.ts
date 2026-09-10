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

import { HOME_ROUTE, WELCOME_ROUTE } from '../../marketing/routes';
import { SIGN_IN_GOOGLE_COMMAND } from './constants';

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
 * Builds the Google handler URL while carrying a validated non-default return path through the OAuth round trip.
 * @public
 * @function
 * @param raw - The candidate return path, straight from the sign-in page query string
 * @returns The Google handler URL, with a safe return path when one was requested
 */
export function buildGoogleSignInCommand(raw: unknown): string {
  const destination: string = resolveSignInRedirect(raw);

  if (destination === HOME_ROUTE) {
    return SIGN_IN_GOOGLE_COMMAND;
  }

  return `${SIGN_IN_GOOGLE_COMMAND}?redirect=${encodeURIComponent(destination)}`;
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
    return HOME_ROUTE;
  }

  if (hasUnsafeCharacter(raw)) {
    return HOME_ROUTE;
  }

  // must be an absolute path, and must not be protocol-relative; browsers read a backslash here as a slash
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return HOME_ROUTE;
  }

  return raw;
}

/**
 * Resolves where to send a player once they finish the welcome step.
 *
 * The same narrowing as {@link resolveSignInRedirect}, plus one extra rule: a destination that is itself `/welcome`
 * is treated as absent. Without it a completed player who arrives at `/welcome?redirect=/welcome` is sent back to the
 * page they just left, and the gate that keeps incomplete players on this page turns into a loop between the page and
 * itself. The query string is discarded before the comparison, so a nested `/welcome?redirect=/welcome` is caught too
 * @public
 * @function
 * @param raw - The candidate path, straight from the query string
 * @returns A path that is safe to navigate to and is not this page
 */
export function resolveWelcomeRedirect(raw: unknown): string {
  const destination: string = resolveSignInRedirect(raw);
  const [path]: string[] = destination.split(/[?#]/u);

  if (path === WELCOME_ROUTE) {
    return HOME_ROUTE;
  }

  return destination;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(buildGoogleSignInCommand, {
  name: 'Build Google Sign In Command',
  description: 'Builds the Google handler URL with a validated non-default return path.',
});
defineSymbol(resolveSignInRedirect, {
  name: 'Resolve Sign In Redirect',
  description: 'Narrows an attacker-controlled return path to a same-origin path, or the default destination.',
});

defineSymbol(resolveWelcomeRedirect, {
  name: 'Resolve Welcome Redirect',
  description: 'Narrows a return path and refuses one that points back at the welcome page.',
});
