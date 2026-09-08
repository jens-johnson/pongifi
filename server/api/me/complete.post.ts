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
 * ██████████████████████████████████████████ #server/api/me/complete.post.ts ██████████████████████████████████████████
 *
 * Saves the display name and finishes onboarding in one write.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/me/complete
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, type H3Event } from 'h3';

import type { IProfile, TDisplayNameValidationResult } from '#shared/profile';
import { validateDisplayName } from '#shared/profile';
import { runUpstream } from '#utils/http';
import { completeProfile } from '#utils/profile';

export default defineEventHandler(async (event: H3Event): Promise<IProfile> => {
  const { user } = await requireUserSession(event);
  const body: unknown = await readBody(event);

  const result: TDisplayNameValidationResult = validateDisplayName(
    (body as Record<string, unknown> | null)?.displayName,
  );

  if (!result.ok) {
    throw createError({ statusCode: 422, statusMessage: result.message });
  }

  // Distinct from PATCH /api/me: this is the only operation that may mark onboarding finished
  const profile: IProfile | null = await runUpstream(
    completeProfile(user.id, result.value),
    'Pongifi could not save your profile.',
  );

  if (!profile) {
    await clearUserSession(event);

    throw createError({ statusCode: 401, statusMessage: 'This account is no longer available.' });
  }

  await replaceUserSession(event, {
    user: {
      avatarUrl: profile.avatarUrl,
      displayName: profile.displayName,
      email: profile.email,
      id: profile.id,
      needsWelcome: false,
    },
  });

  return profile;
});
