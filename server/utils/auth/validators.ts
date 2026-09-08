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
 * █████████████████████████████████████████ #server/utils/auth/validators.ts ██████████████████████████████████████████
 *
 * Boundary validator that normalizes Google's userinfo response.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import { GOOGLE_PROFILE_SCHEMA } from './constants';
import type { IVerifiedGoogleProfile, TGoogleProfileValidationResult } from './types';

/**
 * Validates Google's untrusted userinfo response and rebuilds the provider fields into Pongifi's identity shape.
 * @public
 * @function
 * @param input - The untrusted value returned by Google's userinfo endpoint
 * @returns An accepted normalized profile, or `{ ok: false }` when required identity fields are absent or invalid
 */
export function validateGoogleProfile(input: unknown): TGoogleProfileValidationResult {
  const result: ReturnType<typeof GOOGLE_PROFILE_SCHEMA.safeParse> = GOOGLE_PROFILE_SCHEMA.safeParse(input);

  if (!result.success) {
    return { ok: false };
  }

  const profile: IVerifiedGoogleProfile = {
    avatarUrl: result.data.picture ?? null,
    displayName: result.data.name,
    email: result.data.email.toLowerCase(),
    providerAccountId: result.data.sub,
  };

  return { ok: true, value: profile };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(validateGoogleProfile, {
  name: 'Validate Google Profile',
  description: 'Validates and normalizes the identity fields returned by Google.',
});
