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
 * ████████████████████████████████████ #components/widgets/account/avatar/types.ts ████████████████████████████████████
 *
 * Prop and size types for the account avatar.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The sizes the avatar is drawn at across the account surfaces.
 * @public
 */
export type TAvatarSize = 'lg' | 'md' | 'sm';

/**
 * Inputs for the account avatar.
 * @public
 * @interface
 */
export interface IAccountAvatarProps {
  /* The provider image, or null when Google supplied none and initials stand in */
  avatarUrl: string | null;

  /* The player's display name, used for the initials fallback and the accessible label */
  displayName: string;

  /* How large to draw it */
  size?: TAvatarSize;
}
