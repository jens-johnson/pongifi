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
 * █████████████████████████████████ #components/widgets/leagues/invite-panel/utils.ts █████████████████████████████████
 *
 * Settles a refused or unconfirmed invite-panel write into the alert it shows.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';
import { WriteFailure } from '~/utils/leagues/write-failure';

import { INVITE_NOT_LIVE_MESSAGE, INVITE_STALE_MESSAGE, INVITE_UPDATE_FAILED_MESSAGE } from './constants';

/**
 * Settles a write the panel has already re-read after into the one alert it shows.
 *
 * A conflict and a dead link are both definite and both leave the panel showing something other than what the caller
 * acted on, so each says which it was: a conflict points at the link that replaced the one named, while a link that
 * ran out of time or uses was never replaced and no re-read can revive it. Every other answer may have written, so it
 * alerts only when the re-read shows nothing moved
 * @public
 * @function
 * @param failure - How the answer was read
 * @param changed - Whether the re-read returned a different link than the one the write was sent against
 * @returns The alert to show, or null when the re-read already told the story
 */
export function settleInviteWrite(failure: WriteFailure, changed: boolean): string | null {
  if (failure === WriteFailure.GONE) {
    return INVITE_NOT_LIVE_MESSAGE;
  }

  if (failure === WriteFailure.CONFLICT) {
    return INVITE_STALE_MESSAGE;
  }

  return changed ? null : INVITE_UPDATE_FAILED_MESSAGE;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(settleInviteWrite, {
  name: 'Settle Invite Write',
  description: 'Resolves a re-read invite write into the one alert the panel shows.',
});
