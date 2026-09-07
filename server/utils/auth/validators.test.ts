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
 * ███████████████████████████████████████ #server/utils/auth/validators.test.ts ███████████████████████████████████████
 *
 * Unit tests for Google profile normalization and rejection paths.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { validateGoogleProfile } from './validators';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The verified email shared by valid Google profile fixtures.
 * @internal
 * @constant
 */
const PLAYER_EMAIL: string = 'player@example.com';

/**
 * The display name shared by valid Google profile fixtures.
 * @internal
 * @constant
 */
const PLAYER_NAME: string = 'Player One';

/**
 * The provider subject shared by valid Google profile fixtures.
 * @internal
 * @constant
 */
const PROVIDER_ACCOUNT_ID: string = 'google-subject-1';

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(validateGoogleProfile), (): void => {
    it('normalizes a verified Google identity into Pongifi profile fields', (): void => {
      const input: Record<string, unknown> = {
        email: 'PLAYER@EXAMPLE.COM',
        email_verified: true,
        ignored: 'provider-only field',
        name: PLAYER_NAME,
        picture: 'https://example.com/avatar.png',
        sub: PROVIDER_ACCOUNT_ID,
      };

      expect(validateGoogleProfile(input)).toEqual({
        ok: true,
        value: {
          avatarUrl: 'https://example.com/avatar.png',
          displayName: PLAYER_NAME,
          email: PLAYER_EMAIL,
          providerAccountId: PROVIDER_ACCOUNT_ID,
        },
      });
    });

    it('uses a null avatar when Google provides no profile image', (): void => {
      expect(
        validateGoogleProfile({
          email: PLAYER_EMAIL,
          email_verified: true,
          name: PLAYER_NAME,
          sub: PROVIDER_ACCOUNT_ID,
        }),
      ).toEqual({
        ok: true,
        value: {
          avatarUrl: null,
          displayName: PLAYER_NAME,
          email: PLAYER_EMAIL,
          providerAccountId: PROVIDER_ACCOUNT_ID,
        },
      });
    });

    it('rejects an unverified email address', (): void => {
      expect(
        validateGoogleProfile({
          email: PLAYER_EMAIL,
          email_verified: false,
          name: PLAYER_NAME,
          sub: PROVIDER_ACCOUNT_ID,
        }),
      ).toEqual({ ok: false });
    });

    it('rejects malformed or incomplete provider responses', (): void => {
      expect(validateGoogleProfile(null)).toEqual({ ok: false });
      expect(validateGoogleProfile({ email_verified: true })).toEqual({ ok: false });
      expect(
        validateGoogleProfile({
          email: 'not-an-email',
          email_verified: true,
          name: '',
          picture: 'not-a-url',
          sub: '',
        }),
      ).toEqual({ ok: false });
    });
  });
});
