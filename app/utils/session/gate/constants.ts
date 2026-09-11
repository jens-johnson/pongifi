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
 * █████████████████████████████████████████ #utils/session/gate/constants.ts ██████████████████████████████████████████
 *
 * The routes the session gate has an opinion about.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import {
  HOME_ROUTE,
  LEAGUES_JOIN_ROUTE,
  LEAGUES_NEW_ROUTE,
  LEAGUES_ROUTE,
  PROFILE_ROUTE,
  WELCOME_ROUTE,
} from '../../marketing/routes';

/**
 * The routes the gate has an opinion about.
 *
 * An allowlist rather than "everything that is not public": a gate that redirects unknown paths turns every typo and
 * every missing page into a sign-in prompt instead of a 404. Routes added later opt in here deliberately
 * @public
 * @constant
 */
export const GATED_ROUTES: readonly string[] = [
  HOME_ROUTE,
  LEAGUES_JOIN_ROUTE,
  LEAGUES_NEW_ROUTE,
  LEAGUES_ROUTE,
  PROFILE_ROUTE,
  WELCOME_ROUTE,
];

/**
 * The shape of a league page: `/leagues/` followed by exactly one non-empty segment, with the trailing slash the router
 * also resolves to that page.
 *
 * Gated by shape rather than by lookup, so a signed-out or unfinished visitor is redirected identically whether or not
 * the league exists and before any query could run. `/leagues/` itself and deeper paths do not match and 404 as any
 * other unknown path does
 * @public
 * @constant
 */
export const GATED_LEAGUE_PATH_PATTERN: RegExp = /^\/leagues\/[^/]+\/?$/;
