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
 * ████████████████████████████████████████████ #server/utils/auth/types.ts ████████████████████████████████████████████
 *
 * Types for Google callback validation and account persistence.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ISessionUser } from '#shared/auth';

/**
 * The normalized Google identity accepted by Pongifi after provider response validation.
 * @public
 * @interface
 */
export interface IVerifiedGoogleProfile {
  /* The user's current Google profile image, or null when none is available */
  avatarUrl: string | null;

  /* The user's current Google display name */
  displayName: string;

  /* The user's verified, normalized Google email address */
  email: string;

  /* Google's stable subject identifier */
  providerAccountId: string;
}

/**
 * The provider callback payload consumed by the Google route.
 * @public
 * @interface
 */
export interface IGoogleOAuthResult {
  /* OAuth token response retained by the module but not stored by Pongifi */
  tokens: unknown;

  /* Untrusted Google userinfo response */
  user: unknown;
}

/**
 * A rejected Google userinfo response.
 * @public
 * @interface
 */
export interface IGoogleProfileValidationFailure {
  /* The response did not satisfy Pongifi's identity requirements */
  ok: false;
}

/**
 * An accepted Google userinfo response.
 * @public
 * @interface
 */
export interface IGoogleProfileValidationSuccess {
  /* The response satisfied Pongifi's identity requirements */
  ok: true;

  /* The normalized identity safe to persist */
  value: IVerifiedGoogleProfile;
}

/**
 * The result of validating an untrusted Google userinfo response.
 * @public
 */
export type TGoogleProfileValidationResult = IGoogleProfileValidationFailure | IGoogleProfileValidationSuccess;

/**
 * The database response returned by the atomic Google account upsert.
 * @public
 */
export type TSessionUserRow = ISessionUser & Record<string, unknown>;
