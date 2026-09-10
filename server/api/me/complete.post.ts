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

import type { IProfile, TProfileWriteBodyResult } from '#shared/profile';
import { validateProfileWriteBody } from '#shared/profile';
import { runUpstream } from '#utils/http';
import { completeProfile } from '#utils/profile';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

export default defineEventHandler(async (event: H3Event): Promise<IProfile> => {
  const { user } = await requireUserSession(event);

  // The response carries the account it just saved, so it is as private as the read that returns the same shape
  setResponseHeader(event, 'Cache-Control', 'private, no-store');

  // Checked before the body is read: a request from elsewhere, or one too many, is refused without being parsed at all
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const body: unknown = await readBody(event);

  const result: TProfileWriteBodyResult = validateProfileWriteBody(body);

  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, statusMessage: result.message });
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
