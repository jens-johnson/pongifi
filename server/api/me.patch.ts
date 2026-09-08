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
 * ██████████████████████████████████████████████ #server/api/me.patch.ts ██████████████████████████████████████████████
 *
 * Saves the one profile field a player owns.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * PATCH /api/me
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, type H3Event } from 'h3';

import type { IProfile, TDisplayNameValidationResult } from '#shared/profile';
import { validateDisplayName } from '#shared/profile';
import { runUpstream } from '#utils/http';
import { updateDisplayName } from '#utils/profile';

export default defineEventHandler(async (event: H3Event): Promise<IProfile> => {
  const { user } = await requireUserSession(event);
  const body: unknown = await readBody(event);

  // The display name is the only field this endpoint accepts; anything else in the body is ignored rather than stored
  const result: TDisplayNameValidationResult = validateDisplayName(
    (body as Record<string, unknown> | null)?.displayName,
  );

  if (!result.ok) {
    throw createError({ statusCode: 422, statusMessage: result.message });
  }

  const profile: IProfile | null = await runUpstream(
    updateDisplayName(user.id, result.value),
    'Pongifi could not save your profile.',
  );

  if (!profile) {
    await clearUserSession(event);

    throw createError({ statusCode: 401, statusMessage: 'This account is no longer available.' });
  }

  // The account menu reads the session, so it would keep showing the old name until the next sign-in without this
  await replaceUserSession(event, {
    user: {
      avatarUrl: profile.avatarUrl,
      displayName: profile.displayName,
      email: profile.email,
      id: profile.id,
      needsWelcome: profile.profileCompletedAt === null,
    },
  });

  return profile;
});
