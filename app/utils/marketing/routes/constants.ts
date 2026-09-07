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
 * The destinations the marketing calls to action point at, named once so Features and About cannot disagree.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Where a signed-out visitor is sent to start a league.
 *
 * The destination is a product decision that is still open: the Notion spec recommends a page whose single action
 * starts the Google sign-in through `nuxt-auth-utils`, and no such route exists yet (`server/routes` is empty). It is
 * named here, once, so the marketing surface agrees with itself and renaming it is a one-line change
 * @public
 * @constant
 */
export const SIGN_IN_ROUTE: string = '/sign-in';

/**
 * Where a signed-in visitor is sent instead. Unreachable until there is a session to read, but it is the destination
 * both marketing calls to action branch to
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
