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
 * █████████████████████████████████████████████ #shared/profile/enums.ts ██████████████████████████████████████████████
 *
 * Membership-list presentation and ordering enums.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The two desktop presentations for the full membership list.
 * @public
 * @enum
 */
export enum LeagueListPresentation {
  /* Rich linked cards */
  CARDS = 'cards',

  /* Compact comparison rows */
  TABLE = 'table',
}

/**
 * The allowlisted membership page orderings.
 * @public
 * @enum
 */
export enum LeagueMembershipSort {
  /* Newest viewer membership first */
  JOINED = 'joined',

  /* Largest active roster first */
  MEMBERS = 'members',

  /* League name alphabetically */
  NAME = 'name',
}
