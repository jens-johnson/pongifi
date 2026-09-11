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
 * █████████████████████████████████ #components/widgets/leagues/invite-panel/enums.ts █████████████████████████████████
 *
 * Modes of a league's invite panel.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * What the invite panel is asking the commissioner or manager right now.
 * @public
 * @enum
 */
export enum InvitePanelMode {
  /* Confirming a replacement, with the expiry and limit controls prefilled from the current link */
  CONFIRM_REPLACE = 'CONFIRM_REPLACE',

  /* Confirming a revoke */
  CONFIRM_REVOKE = 'CONFIRM_REVOKE',

  /* Showing the link, or the controls to create one */
  VIEW = 'VIEW',
}
