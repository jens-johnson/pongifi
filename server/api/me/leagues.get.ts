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
 * ███████████████████████████████████████████ #server/api/me/leagues.get.ts ███████████████████████████████████████████
 *
 * Returns the leagues the signed-in player actively belongs to.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/me/leagues
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, type H3Event } from 'h3';

import type { ILeagueMembership } from '#shared/profile';
import { runUpstream } from '#utils/http';
import { isActiveAccount, readMemberships } from '#utils/profile';

export default defineEventHandler(async (event: H3Event): Promise<ILeagueMembership[]> => {
  const { user } = await requireUserSession(event);

  // Private data: this response must never be reused for another visitor
  setResponseHeader(event, 'Cache-Control', 'private, no-store');

  /* A sealed session outlives the account it names, and a soft-deleted player keeps their ACTIVE memberships, so the
     membership query alone would still answer for them. Returning an empty list instead would hide a session that
     should not be resolving at all */
  const active: boolean = await runUpstream(isActiveAccount(user.id), 'Pongifi could not read your leagues.');

  if (!active) {
    await clearUserSession(event);

    throw createError({ statusCode: 401, statusMessage: 'This account is no longer available.' });
  }

  return runUpstream(readMemberships(user.id), 'Pongifi could not read your leagues.');
});
