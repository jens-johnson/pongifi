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
import { GATED_ROUTES } from './constants';
import type { ISessionGateInput } from './types';

/**
 * Builds a destination that carries the requested path back as a return value.
 * @internal
 * @function
 * @param route - The page to send the visitor to
 * @param returnPath - The path they were trying to reach
 * @returns The route with the return path encoded onto it
 */
function withReturnPath(route: string, returnPath: string): string {
  return `${route}?redirect=${encodeURIComponent(returnPath)}`;
}

/**
 * Decides where a request belongs, or that it belongs where it is.
 *
 * Gating follows the session rather than the URL: signed out, `/` is the public landing and never gates; signed in,
 * `/` is the dashboard and gates exactly as `/profile` and `/leagues` do. Public informational pages are absent from
 * {@link GATED_ROUTES} entirely, so a player part-way through onboarding can still read them
 * @public
 * @function
 * @param input - The requested route and what the session says about the visitor
 * @returns The path to send them to, or null when the request may proceed
 */
export function resolveSessionGate(input: ISessionGateInput): string | null {
  if (!GATED_ROUTES.includes(input.path)) {
    return null;
  }

  if (!input.loggedIn) {
    // The landing page is the one gated route a signed-out visitor is entitled to
    if (input.path === HOME_ROUTE) {
      return null;
    }

    // The whole path travels, query included, so an invite is still waiting after the provider round trip
    return withReturnPath(SIGN_IN_ROUTE, input.fullPath);
  }

  if (input.path === WELCOME_ROUTE) {
    // A player who still owes the step stays; one who does not is sent on rather than shown it twice
    return input.needsWelcome ? null : resolveWelcomeRedirect(input.redirect);
  }

  if (input.needsWelcome) {
    return withReturnPath(WELCOME_ROUTE, input.fullPath);
  }

  return null;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(resolveSessionGate, {
  name: 'Resolve Session Gate',
  description: 'Decides whether a requested route may proceed, or where the visitor belongs instead.',
});
