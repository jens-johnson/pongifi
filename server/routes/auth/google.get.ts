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
 * █████████████████████████████████████████ #server/routes/auth/google.get.ts █████████████████████████████████████████
 *
 * Google OAuth callback that validates an identity, persists its account, and starts a Pongifi session.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /auth/google. Starts Google OAuth and handles the provider callback.
 * GET /auth/google?redirect=<path>. Carries a validated return path through the provider round trip.
 *
 * ─── AUTH ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Google OAuth state and verified provider email required
 *
 * ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Redirects successful sign-ins to the validated return path, defaulting to /leagues
 *   • Redirects every sign-in failure to /sign-in?error=oauth
 *
 * ─── SIDE EFFECTS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Creates or refreshes users and user_accounts rows
 *   • Replaces the sealed Pongifi user session
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { H3Error, H3Event } from 'h3';
import { deleteCookie, getCookie, getQuery, getRequestHeader, sendRedirect, setCookie } from 'h3';

import type { ISessionUser } from '#shared/auth';
import type { IGoogleOAuthResult, TGoogleProfileValidationResult } from '#utils/auth';
import {
  GOOGLE_AUTH_RETURN_PATH_COOKIE,
  GOOGLE_AUTH_RETURN_PATH_MAX_AGE_SECONDS,
  upsertGoogleUser,
  validateGoogleProfile,
} from '#utils/auth';
import { HOME_ROUTE, SIGN_IN_ROUTE } from '~/utils/marketing/routes';
import { resolveSignInRedirect } from '~/utils/sign-in/redirect';

/**
 * Reads and expires the destination associated with the current OAuth handshake.
 * @internal
 * @function
 * @param event - The current Google callback request
 * @returns The validated destination, defaulting to the leagues page when the cookie is absent or unsafe
 */
function consumeAuthDestination(event: H3Event): string {
  const destination: string = resolveSignInRedirect(getCookie(event, GOOGLE_AUTH_RETURN_PATH_COOKIE));

  deleteCookie(event, GOOGLE_AUTH_RETURN_PATH_COOKIE, { path: '/' });

  return destination;
}

/**
 * Builds the retry location while preserving a non-default destination for the next attempt.
 * @internal
 * @function
 * @param destination - The already validated destination from the OAuth handshake
 * @returns The sign-in failure page location
 */
function buildAuthFailureRedirect(destination: string): string {
  if (destination === HOME_ROUTE) {
    return `${SIGN_IN_ROUTE}?error=oauth`;
  }

  return `${SIGN_IN_ROUTE}?error=oauth&redirect=${encodeURIComponent(destination)}`;
}

/**
 * Records a callback-stage failure without logging provider errors or credentials, then returns the visitor to retry.
 * @internal
 * @function
 * @param event - The current Google callback request
 * @param message - The safe failure stage to record
 * @returns Nothing after the redirect response is sent
 */
async function redirectAuthFailure(event: H3Event, message: string): Promise<void> {
  const requestId: string = getRequestHeader(event, 'x-vercel-id') ?? 'unavailable';
  const destination: string = consumeAuthDestination(event);

  console.error(`[auth/google] ${message}; request ${requestId}.`);
  await sendRedirect(event, buildAuthFailureRedirect(destination));
}

/**
 * The provider handler responsible for OAuth state validation, token exchange, and fetching Google userinfo.
 * @internal
 * @constant
 */
const googleOAuthHandler: ReturnType<typeof defineOAuthGoogleEventHandler> = defineOAuthGoogleEventHandler({
  async onError(event: H3Event, _error: H3Error): Promise<void> {
    await redirectAuthFailure(event, 'OAuth exchange failed');
  },

  async onSuccess(event: H3Event, result: IGoogleOAuthResult): Promise<void> {
    const profileResult: TGoogleProfileValidationResult = validateGoogleProfile(result.user);

    if (!profileResult.ok) {
      await redirectAuthFailure(event, 'Google returned an invalid identity profile');

      return;
    }

    let user: ISessionUser | null;

    try {
      user = await upsertGoogleUser(profileResult.value);
    } catch {
      await redirectAuthFailure(event, 'Pongifi could not persist the account');

      return;
    }

    if (!user) {
      await redirectAuthFailure(event, 'The Pongifi account is unavailable');

      return;
    }

    try {
      await replaceUserSession(event, { user });
    } catch {
      await redirectAuthFailure(event, 'Pongifi could not start the session');

      return;
    }

    await sendRedirect(event, consumeAuthDestination(event));
  },
});

export default defineEventHandler(async (event: H3Event): Promise<unknown> => {
  const query: Record<string, string | string[]> = getQuery<Record<string, string | string[]>>(event);

  // The upstream handler does not distinguish provider denial from the first leg and would restart OAuth indefinitely
  if (query.error !== undefined) {
    await redirectAuthFailure(event, 'Google denied the authorization request');

    return;
  }

  if (!query.code) {
    const destination: string = resolveSignInRedirect(query.redirect);

    setCookie(event, GOOGLE_AUTH_RETURN_PATH_COOKIE, destination, {
      httpOnly: true,
      maxAge: GOOGLE_AUTH_RETURN_PATH_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return googleOAuthHandler(event);
});
