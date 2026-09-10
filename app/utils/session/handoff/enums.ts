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
 * ██████████████████████████████████████████ #utils/session/handoff/enums.ts ██████████████████████████████████████████
 *
 * The ways a page can leave for its destination after an accepted write.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * How a page should leave for its destination after a write the server has already accepted.
 *
 * The distinction exists because the client's copy of the session is a cache: `nuxt-auth-utils` swallows a failed
 * refresh and leaves the session null, which the route gate reads as signed out. Navigating on the client after that
 * sends a player who just saved their name to sign-in instead
 * @public
 * @enum
 */
export enum SessionHandoff {
  /* The refreshed session agrees with the write, so an ordinary client navigation is safe */
  CLIENT = 'CLIENT',

  /* The client's session cannot be trusted, so the destination is handed to the server to render */
  RELOAD = 'RELOAD',
}
