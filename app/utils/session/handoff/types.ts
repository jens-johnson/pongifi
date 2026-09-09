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
 * ██████████████████████████████████████████ #utils/session/handoff/types.ts ██████████████████████████████████████████
 *
 * Types for the session handoff resolver.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * What the handoff decision is made from, taken as values rather than as the session's refs.
 * @public
 * @interface
 */
export interface ISessionHandoffInput {
  /* Whether the refreshed session still says the welcome step is outstanding */
  needsWelcome: boolean;

  /* Whether the refresh produced a session at all; `nuxt-auth-utils` reports its own failure as an absent one */
  refreshed: boolean;
}
