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
 * ███████████████████████████████████████████████ #server/api/me.get.ts ███████████████████████████████████████████████
 *
 * Returns the signed-in player's own account.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/me
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, type H3Event } from 'h3';

import type { IProfile } from '#shared/profile';
import { runUpstream } from '#utils/http';
import { readProfile } from '#utils/profile';

export default defineEventHandler(async (event: H3Event): Promise<IProfile> => {
  const { user } = await requireUserSession(event);

  const profile: IProfile | null = await runUpstream(readProfile(user.id), 'Pongifi could not read your profile.');

  // A sealed session outlives the account it names, so a deleted account must not keep resolving through it
  if (!profile) {
    await clearUserSession(event);

    throw createError({ statusCode: 401, statusMessage: 'This account is no longer available.' });
  }

  return profile;
});
