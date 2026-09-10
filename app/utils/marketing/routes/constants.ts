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
 * ███████████████████████████████████████ #utils/marketing/routes/constants.ts ████████████████████████████████████████
 *
 * The application's named routes, declared once so no surface can disagree about one.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Where a signed-out visitor is sent to start a league.
 *
 * The page starts Google sign-in through `nuxt-auth-utils`. It is named here, once, so the marketing surface agrees
 * with itself and renaming it is a one-line change
 * @public
 * @constant
 */
export const SIGN_IN_ROUTE: string = '/sign-in';

/**
 * Where a signed-in visitor is sent instead; both marketing calls to action branch to this destination
 * @public
 * @constant
 */
export const LEAGUES_ROUTE: string = '/leagues';

/**
 * The FAQ, offered as the secondary link beside the closing call to action
 * @public
 * @constant
 */
export const FAQ_ROUTE: string = '/faq';

/**
 * The landing page signed out and the dashboard signed in, and the default destination after signing in.
 *
 * One route rather than a separate `/dashboard`, so a bookmark, a sign-in and a sign-out all resolve to the same
 * place and the session decides what it renders
 * @public
 * @constant
 */
export const HOME_ROUTE: string = '/';

/**
 * The signed-in player's own account page
 * @public
 * @constant
 */
export const PROFILE_ROUTE: string = '/profile';

/**
 * The one-time step between a first sign-in and the rest of the product
 * @public
 * @constant
 */
export const WELCOME_ROUTE: string = '/welcome';
