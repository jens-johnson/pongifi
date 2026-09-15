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
 * ███████████████████████████████████████████ #utils/session/gate/utils.ts ████████████████████████████████████████████
 *
 * Decides where a request belongs given the session behind it.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import { HOME_ROUTE, SIGN_IN_ROUTE, WELCOME_ROUTE } from '../../marketing/routes';
import { resolveWelcomeRedirect } from '../../sign-in/redirect';
import { GATED_LEAGUE_PATH_PATTERN, GATED_ROUTES } from './constants';
import type { ISessionGateInput } from './types';

/**
 * Builds a destination that carries the requested path back as a return value.
 *
 * Exported because the gate is not the only place a private page gets taken away from a visitor: a page whose own read
 * comes back unauthorized has to send them to sign-in too, and it has to encode the return path the same way the gate
 * does or the two disagree about where the visitor was going.
 * @public
 * @function
 * @param route - The page to send the visitor to
 * @param returnPath - The full path they were trying to reach, query included
 * @returns The route with the return path encoded onto it
 */
export function buildGatedReturnPath(route: string, returnPath: string): string {
  return `${route}?redirect=${encodeURIComponent(returnPath)}`;
}

/**
 * Decides where a request belongs, or that it belongs where it is.
 *
 * Gating follows the session rather than the URL: signed out, `/` is the public landing and never gates; signed in,
 * `/` is the dashboard and gates exactly as `/profile` and `/leagues` do. A league page is gated by its path's shape
 * ({@link GATED_LEAGUE_PATH_PATTERN}), since its id cannot be listed. Public informational pages, and the invite
 * landing that has to render signed out, are absent from both, so a player part-way through onboarding can still read
 * them
 * @public
 * @function
 * @param input - The requested route and what the session says about the visitor
 * @returns The path to send them to, or null when the request may proceed
 */
export function resolveSessionGate(input: ISessionGateInput): string | null {
  if (!GATED_ROUTES.includes(input.path) && !GATED_LEAGUE_PATH_PATTERN.test(input.path)) {
    return null;
  }

  if (!input.loggedIn) {
    // The landing page is the one gated route a signed-out visitor is entitled to
    if (input.path === HOME_ROUTE) {
      return null;
    }

    // The whole path travels, query included, so an invite is still waiting after the provider round trip
    return buildGatedReturnPath(SIGN_IN_ROUTE, input.fullPath);
  }

  if (input.path === WELCOME_ROUTE) {
    // A player who still owes the step stays; one who does not is sent on rather than shown it twice
    return input.needsWelcome ? null : resolveWelcomeRedirect(input.redirect);
  }

  if (input.needsWelcome) {
    return buildGatedReturnPath(WELCOME_ROUTE, input.fullPath);
  }

  return null;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(buildGatedReturnPath, {
  name: 'Build Gated Return Path',
  description: 'Builds a destination that carries the requested path back as a return value.',
});

defineSymbol(resolveSessionGate, {
  name: 'Resolve Session Gate',
  description: 'Decides whether a requested route may proceed, or where the visitor belongs instead.',
});
