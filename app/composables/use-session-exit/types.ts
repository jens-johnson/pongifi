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
 * ██████████████████████████████████████ #composables/use-session-exit/types.ts ███████████████████████████████████████
 *
 * Types for the session exits league-entry writes take.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The two ways a league-entry page leaves when a write shows that the session cannot perform it.
 * @public
 * @interface
 */
export interface ISessionExit {
  /* Leaves for sign-in, carrying the current page back as the return path, after dropping the ended session */
  toSignIn: () => Promise<void>;

  /* Leaves for /welcome when the refreshed session still owes it, and reports whether it left */
  toWelcomeIfOwed: () => Promise<boolean>;
}
