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
 * ███████████████████████████████████████████████ #shared/auth/types.ts ███████████████████████████████████████████████
 *
 * The authenticated user identity shared by server sessions and client code.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The Pongifi identity stored in the sealed session and exposed to authenticated client code.
 * @public
 * @interface
 */
export interface ISessionUser {
  /* The user's current Google profile image, or null when none is available */
  avatarUrl: string | null;

  /* The user's current Google display name */
  displayName: string;

  /* The user's verified Google email address */
  email: string;

  /* Pongifi's stable user identifier */
  id: string;
}
