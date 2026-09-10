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

import { HOME_ROUTE, LEAGUES_ROUTE, PROFILE_ROUTE, WELCOME_ROUTE } from '../../marketing/routes';

/**
 * The routes the gate has an opinion about.
 *
 * An allowlist rather than "everything that is not public": a gate that redirects unknown paths turns every typo and
 * every missing page into a sign-in prompt instead of a 404. Routes added later opt in here deliberately
 * @public
 * @constant
 */
export const GATED_ROUTES: readonly string[] = [HOME_ROUTE, LEAGUES_ROUTE, PROFILE_ROUTE, WELCOME_ROUTE];
