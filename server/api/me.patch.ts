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

import type { IProfile, TProfileWriteBodyResult } from '#shared/profile';
import { validateProfileWriteBody } from '#shared/profile';
import { runUpstream } from '#utils/http';
import { updateDisplayName } from '#utils/profile';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

export default defineEventHandler(async (event: H3Event): Promise<IProfile> => {
  const { user } = await requireUserSession(event);

  // The response carries the account it just saved, so it is as private as the read that returns the same shape
  setResponseHeader(event, 'Cache-Control', 'private, no-store');

  // Checked before the body is read: a request from elsewhere, or one too many, is refused without being parsed at all
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const body: unknown = await readBody(event);

  // The display name is the only field this endpoint accepts; anything else makes the request malformed, not filtered
  const result: TProfileWriteBodyResult = validateProfileWriteBody(body);

  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, statusMessage: result.message });
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
