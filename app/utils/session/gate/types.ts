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
 * ███████████████████████████████████████████ #utils/session/gate/types.ts ████████████████████████████████████████████
 *
 * The values the session gate decides from.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Everything the gate needs to decide where a request belongs.
 *
 * Values rather than framework objects, so the decision is a pure function the unit suite can drive through every
 * combination without a router or a session
 * @public
 * @interface
 */
export interface ISessionGateInput {
  /* The full requested path including its query string, carried forward so an invite survives the round trip */
  fullPath: string;

  /* Whether a session cookie resolved to a signed-in player */
  loggedIn: boolean;

  /* Whether that player still has to complete the welcome step */
  needsWelcome: boolean;

  /* The requested path without its query string */
  path: string;

  /* The redirect query value on the requested route, untrusted and narrowed before use */
  redirect: unknown;
}
