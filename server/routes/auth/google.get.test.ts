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
 * ██████████████████████████████████████ #server/routes/auth/google.get.test.ts ███████████████████████████████████████
 *
 * Unit tests for Google OAuth callback redirects, session creation, and return-path handling.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { EventHandler, H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ISessionUser } from '#shared/auth';
import { symbolName } from '#shared/utils/symbol';
import {
  GOOGLE_AUTH_RETURN_PATH_COOKIE,
  GOOGLE_AUTH_RETURN_PATH_MAX_AGE_SECONDS,
  type IGoogleOAuthResult,
  type TGoogleProfileValidationResult,
} from '#utils/auth';

/**
 * The OAuth callbacks captured when the route module defines its provider handler.
 * @internal
 * @interface
 */
interface IGoogleOAuthCallbacks {
  /* Handles provider and handshake failures */
  onError(event: H3Event, error: H3Error): Promise<void>;

  /* Validates and persists a successful provider response */
  onSuccess(event: H3Event, result: IGoogleOAuthResult): Promise<void>;
}

/**
 * The mutable capture used by the provider-handler test double.
 * @internal
 * @interface
 */
interface IOAuthHarness {
  /* The callbacks registered during route-module evaluation */
  callbacks: IGoogleOAuthCallbacks | null;
}

/**
 * H3 boundary doubles shared across callback tests.
 * @internal
 * @interface
 */
interface IH3Mocks {
  /* Cookie expiry */
  deleteCookie: Mock<(event: H3Event, name: string, options?: object) => void>;

  /* Cookie read */
  getCookie: Mock<(event: H3Event, name: string) => string | undefined>;

  /* Request query read */
  getQuery: Mock<(event: H3Event) => Record<string, string | string[]>>;

  /* Request header read */
  getRequestHeader: Mock<(event: H3Event, name: string) => string | undefined>;

  /* Redirect response */
  sendRedirect: Mock<(event: H3Event, location: string) => Promise<void>>;

  /* Cookie write */
  setCookie: Mock<(event: H3Event, name: string, value: string, options?: object) => void>;
}

/**
 * Auth utility doubles shared across callback tests.
 * @internal
 * @interface
 */
interface IAuthMocks {
  /* Atomic user persistence */
  upsertGoogleUser: Mock<(profile: unknown) => Promise<ISessionUser | null>>;

  /* Provider-boundary validation */
  validateGoogleProfile: Mock<(input: unknown) => TGoogleProfileValidationResult>;
}

/**
 * H3 boundary doubles, hoisted so the module mock can consume them.
 * @internal
 * @constant
 */
const h3Mocks: IH3Mocks = vi.hoisted((): IH3Mocks => ({
  deleteCookie: vi.fn(),
  getCookie: vi.fn(),
  getQuery: vi.fn(),
  getRequestHeader: vi.fn(),
  sendRedirect: vi.fn(async (): Promise<void> => {}),
  setCookie: vi.fn(),
}));

/**
 * Auth utility doubles, hoisted so the module mock can consume them.
 * @internal
 * @constant
 */
const authMocks: IAuthMocks = vi.hoisted((): IAuthMocks => ({
  upsertGoogleUser: vi.fn(),
  validateGoogleProfile: vi.fn(),
}));

vi.mock('h3', async (importOriginal): Promise<typeof import('h3')> => {
  const original: typeof import('h3') = await importOriginal<typeof import('h3')>();

  return { ...original, ...h3Mocks } as unknown as typeof import('h3');
});

// Module specifiers necessarily repeat in the import, mock target, and importOriginal type.
// eslint-disable-next-line sonarjs/no-duplicate-string
vi.mock('#utils/auth', async (importOriginal): Promise<typeof import('#utils/auth')> => {
  const original: typeof import('#utils/auth') = await importOriginal<typeof import('#utils/auth')>();

  return {
    ...original,
    ...authMocks,
    GOOGLE_AUTH_RETURN_PATH_COOKIE: 'pongifi-google-auth-return-path',
    GOOGLE_AUTH_RETURN_PATH_MAX_AGE_SECONDS: 10 * 60,
  };
});

/**
 * Provider callbacks captured during route-module evaluation.
 * @internal
 * @constant
 */
const oauthHarness: IOAuthHarness = { callbacks: null };

/**
 * The mocked provider handler invoked by Pongifi's outer route handler.
 * @internal
 * @constant
 */
const providerHandlerMock: Mock<(event: H3Event) => Promise<void>> = vi.fn(async (): Promise<void> => {});

/**
 * The session replacement boundary.
 * @internal
 * @constant
 */
const replaceUserSessionMock: Mock<(event: H3Event, session: { user: ISessionUser }) => Promise<void>> = vi.fn(
  async (): Promise<void> => {},
);

vi.stubGlobal(
  'defineOAuthGoogleEventHandler',
  vi.fn((callbacks: IGoogleOAuthCallbacks): typeof providerHandlerMock => {
    oauthHarness.callbacks = callbacks;

    return providerHandlerMock;
  }),
);
vi.stubGlobal(
  'defineEventHandler',
  vi.fn((handler: EventHandler): EventHandler => handler),
);
vi.stubGlobal('replaceUserSession', replaceUserSessionMock);

/**
 * The imported outer route handler under test.
 * @internal
 * @constant
 */
const { default: routeHandler }: { default: EventHandler } = await import('./google.get');

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A minimal H3 event identity for mocked boundary calls.
 * @internal
 * @constant
 */
const EVENT: H3Event = {} as H3Event;

/**
 * The normalized user returned by persistence in successful callback tests.
 * @internal
 * @constant
 */
const USER: ISessionUser = {
  avatarUrl: null,
  displayName: 'Player One',
  email: 'player@example.com',
  id: 'user-1',
  needsWelcome: false,
};

/**
 * The accepted provider response shared by callback tests.
 * @internal
 * @constant
 */
const GOOGLE_RESULT: IGoogleOAuthResult = {
  tokens: { access_token: 'never-log-this' },
  user: { sub: 'google-subject-1' },
};

/**
 * A non-default destination used to verify the OAuth round trip.
 * @internal
 * @constant
 */
const RETURN_PATH: string = '/leagues/ashfield';

/**
 * The default callback failure location.
 * @internal
 * @constant
 */
const SIGN_IN_FAILURE_ROUTE: string = '/sign-in?error=oauth';

/**
 * Returns the callbacks registered by the route or fails loudly if module setup did not happen.
 * @internal
 * @function
 * @throws When route-module evaluation did not register the provider callbacks
 * @returns The captured Google callback handlers
 */
function getOAuthCallbacks(): IGoogleOAuthCallbacks {
  if (!oauthHarness.callbacks) {
    throw new Error('The route did not register Google OAuth callbacks.');
  }

  return oauthHarness.callbacks;
}

/* ─── Tests ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    h3Mocks.getCookie.mockReturnValue(undefined);
    h3Mocks.getQuery.mockReturnValue({});
    h3Mocks.getRequestHeader.mockReturnValue(undefined);
    authMocks.upsertGoogleUser.mockResolvedValue(USER);
    authMocks.validateGoogleProfile.mockReturnValue({
      ok: true,
      value: {
        avatarUrl: USER.avatarUrl,
        displayName: USER.displayName,
        email: USER.email,
        providerAccountId: 'google-subject-1',
      },
    });
  });

  describe(symbolName(routeHandler), (): void => {
    it('stores a validated return path before starting the provider handshake', async (): Promise<void> => {
      h3Mocks.getQuery.mockReturnValue({ redirect: RETURN_PATH });

      await routeHandler(EVENT);

      expect(h3Mocks.setCookie).toHaveBeenCalledWith(EVENT, GOOGLE_AUTH_RETURN_PATH_COOKIE, RETURN_PATH, {
        httpOnly: true,
        maxAge: GOOGLE_AUTH_RETURN_PATH_MAX_AGE_SECONDS,
        path: '/',
        sameSite: 'lax',
        secure: false,
      });
      expect(providerHandlerMock).toHaveBeenCalledWith(EVENT);
    });

    it('turns provider denial into the retry state instead of restarting OAuth', async (): Promise<void> => {
      h3Mocks.getCookie.mockReturnValue(RETURN_PATH);
      h3Mocks.getQuery.mockReturnValue({ error: 'access_denied' });

      await routeHandler(EVENT);

      expect(providerHandlerMock).not.toHaveBeenCalled();
      expect(h3Mocks.sendRedirect).toHaveBeenCalledWith(EVENT, '/sign-in?error=oauth&redirect=%2Fleagues%2Fashfield');
    });

    it('logs only a safe stage and request id when the provider exchange fails', async (): Promise<void> => {
      const consoleErrorMock: Mock<typeof console.error> = vi
        .spyOn(console, 'error')
        .mockImplementation((): void => {});

      await getOAuthCallbacks().onError(EVENT, new Error('access_token=never-log-this') as H3Error);

      expect(consoleErrorMock).toHaveBeenCalledWith('[auth/google] OAuth exchange failed; request unavailable.');
      expect(h3Mocks.sendRedirect).toHaveBeenCalledWith(EVENT, SIGN_IN_FAILURE_ROUTE);
    });

    it('returns an invalid provider profile to the retry state', async (): Promise<void> => {
      authMocks.validateGoogleProfile.mockReturnValue({ ok: false });

      await getOAuthCallbacks().onSuccess(EVENT, GOOGLE_RESULT);

      expect(authMocks.upsertGoogleUser).not.toHaveBeenCalled();
      expect(replaceUserSessionMock).not.toHaveBeenCalled();
      expect(h3Mocks.sendRedirect).toHaveBeenCalledWith(EVENT, SIGN_IN_FAILURE_ROUTE);
    });

    it('starts the session and consumes the validated return path on success', async (): Promise<void> => {
      h3Mocks.getCookie.mockReturnValue(RETURN_PATH);

      await getOAuthCallbacks().onSuccess(EVENT, GOOGLE_RESULT);

      expect(replaceUserSessionMock).toHaveBeenCalledWith(EVENT, { user: USER });
      expect(h3Mocks.deleteCookie).toHaveBeenCalledWith(EVENT, GOOGLE_AUTH_RETURN_PATH_COOKIE, { path: '/' });
      expect(h3Mocks.sendRedirect).toHaveBeenCalledWith(EVENT, RETURN_PATH);
    });
  });
});
