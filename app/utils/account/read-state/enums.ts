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
 * ████████████████████████████████████████ #utils/account/read-state/enums.ts █████████████████████████████████████████
 *
 * The states a read of the signed-in player's own data can be in.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * What a page should draw for a read of the signed-in player's own data.
 *
 * A state rather than a set of booleans, so no page can render two of them at once or, worse, none: a failed read with
 * only a `v-if="profile"` around the form draws a heading and nothing else
 * @public
 * @enum
 */
export enum AccountReadState {
  /* The read failed for a reason the player can retry */
  FAILED = 'FAILED',

  /* The read is in flight */
  PENDING = 'PENDING',

  /* The read returned the player's data */
  READY = 'READY',

  /* The session behind the read is no longer valid, so the player belongs at sign-in */
  UNAUTHORIZED = 'UNAUTHORIZED',
}
