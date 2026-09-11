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
 * ███████████████████████████████ #components/widgets/leagues/invite-panel/constants.ts ███████████████████████████████
 *
 * Expiry choices, timings and copy for the invite panel.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IInviteExpiryOption } from './types';

/**
 * The expiry choices, always finite (VI.I).
 * @public
 * @constant
 */
export const INVITE_EXPIRY_OPTIONS: readonly IInviteExpiryOption[] = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

/**
 * How long Copied shows after the link is copied, in milliseconds.
 * @public
 * @constant
 */
export const COPIED_VISIBLE_MS: number = 2000;

/**
 * Shown when a create, replace or revoke was refused, or could not be confirmed and the re-read shows no change.
 * @public
 * @constant
 */
export const INVITE_UPDATE_FAILED_MESSAGE: string = 'Pongifi could not update the invite link. Try again.';

/**
 * Shown when a replace or revoke named a link that another request had already replaced.
 * @public
 * @constant
 */
export const INVITE_STALE_MESSAGE: string = 'This link was already replaced. The link shown is the current one.';

/**
 * Shown under the use limit when it is not a whole number of at least one.
 * @public
 * @constant
 */
export const INVITE_MAX_USES_MESSAGE: string = 'Use a whole number of 1 or more, or leave it empty for no limit.';
