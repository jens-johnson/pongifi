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
 * ██████████████████████████████████████████ #server/utils/profile/types.ts ███████████████████████████████████████████
 *
 * Row and payload shapes for the profile queries.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * A user row as the profile queries select it, before timestamps are rendered for the browser.
 * @public
 * @interface
 */
export interface IProfileRow {
  /* The provider-owned profile image, or null when Google supplied none */
  avatarUrl: string | null;

  /* When the account was created */
  createdAt: Date;

  /* The player's chosen display name */
  displayName: string;

  /* The verified Google address */
  email: string;

  /* Pongifi's stable user identifier */
  id: string;

  /* When the player finished /welcome, or null while the step is outstanding */
  profileCompletedAt: Date | null;
}
