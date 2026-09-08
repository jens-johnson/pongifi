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
 * ██████████████████████████████████████████ #server/utils/auth/constants.ts ██████████████████████████████████████████
 *
 * Validation schema for the trusted subset of Google's userinfo response.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { z } from 'zod';

/**
 * The short-lived cookie carrying a validated destination across the Google OAuth round trip.
 * @public
 * @constant
 */
export const GOOGLE_AUTH_RETURN_PATH_COOKIE: string = 'pongifi-google-auth-return-path';

/**
 * Ten minutes in seconds, matching the bounded lifetime of the provider handshake.
 * @public
 * @constant
 */
export const GOOGLE_AUTH_RETURN_PATH_MAX_AGE_SECONDS: number = 10 * 60;

/**
 * The trusted subset required from Google's userinfo endpoint; a verified email is required before identity linking.
 * @internal
 * @constant
 */
export const GOOGLE_PROFILE_SCHEMA = z.object({
  email: z.email(),
  email_verified: z.literal(true),
  name: z.string().trim().min(1),
  picture: z.url().optional(),
  sub: z.string().trim().min(1),
});
