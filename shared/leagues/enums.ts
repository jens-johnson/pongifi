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
 * █████████████████████████████████████████████ #shared/leagues/enums.ts ██████████████████████████████████████████████
 *
 * Enumerations for invite-link states and invite lookup answers.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Where a league's shareable invite link stands, as the invite panel draws it.
 *
 * Derived rather than stored: an invitation row only records PENDING or REVOKED for a shareable link, and whether a
 * PENDING link has run out of time or uses is decided against the database clock when it is read
 * @public
 * @enum
 */
export enum InviteLinkState {
  /* Every allowed use has been spent */
  EXHAUSTED = 'EXHAUSTED',

  /* Its expiry time has passed */
  EXPIRED = 'EXPIRED',

  /* A commissioner or manager revoked it, or replaced it with a new one */
  REVOKED = 'REVOKED',

  /* Anyone holding it can still join */
  USABLE = 'USABLE',
}

/**
 * What an invite lookup found for the visitor holding the token.
 * @public
 * @enum
 */
export enum InviteLookupKind {
  /* The link is usable and the visitor is not yet an active member; the summary is returned */
  INVITE = 'INVITE',

  /* The signed-in visitor is already an active member of the league; only the destination is returned */
  MEMBER = 'MEMBER',
}

/**
 * The four sections of the league settings page, each saved on its own.
 *
 * A save names exactly one, so changing a target score never resubmits the league's name, and the server can check the
 * role the section actually needs rather than the strongest role on the page
 * @public
 * @enum
 */
export enum SettingsSection {
  /* Formats, target scores, best of, service interval, expedite, the cutthroat cap and the walkover grace */
  FORMATS = 'FORMATS',

  /* Name, short mark and description; the only section a manager may save */
  IDENTITY = 'IDENTITY',

  /* Whether ratings move, and the provisional game count */
  RATINGS = 'RATINGS',

  /* Who creates games, who records results, confirmation and the two windows */
  RESULTS = 'RESULTS',
}
