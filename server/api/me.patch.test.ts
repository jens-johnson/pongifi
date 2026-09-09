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
 * ███████████████████████████████████████████ #server/api/me.patch.test.ts ████████████████████████████████████████████
 *
 * Unit tests for the profile rename endpoint's write boundary and session refresh.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { createError, type EventHandler, type H3Error, type H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IProfile } from '#shared/profile';
import {
  DISPLAY_NAME_EMPTY_MESSAGE,
  PROFILE_BODY_REJECTED_STATUS,
  PROFILE_BODY_UNKNOWN_FIELD_MESSAGE,
} from '#shared/profile';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The write-boundary doubles the handler's guards are replaced with.
 * @internal
 * @interface
 */
interface IWriteBoundaryMocks {
  /* Stands in for the same-origin check */
  assertSameOrigin: Mock<(event: H3Event) => void>;

  /* Stands in for the per-account write limit */
  assertWithinWriteRateLimit: Mock<(event: H3Event, userId: string) => Promise<void>>;
}

/**
 * The persistence double, the one call these cases prove is never reached by a refused request.
 * @internal
 * @interface
 */
interface IProfileMocks {
  /* Stands in for the only write this endpoint performs */
  updateDisplayName: Mock<(userId: string, displayName: string) => Promise<IProfile | null>>;
}

/**
 * The write-boundary doubles, hoisted so the module mock can consume them.
 * @internal
 * @constant
 */
const writeBoundaryMocks: IWriteBoundaryMocks = vi.hoisted((): IWriteBoundaryMocks => ({
  assertSameOrigin: vi.fn(),
  assertWithinWriteRateLimit: vi.fn(),
}));

/**
 * The persistence double, hoisted so the module mock can consume it.
 * @internal
 * @constant
 */
const profileMocks: IProfileMocks = vi.hoisted((): IProfileMocks => ({ updateDisplayName: vi.fn() }));

vi.mock('#utils/write-boundary', (): Record<string, unknown> => ({ ...writeBoundaryMocks }));

vi.mock('#utils/profile', (): Record<string, unknown> => ({ ...profileMocks }));

/**
 * The session boundary, stubbed as the auto-imported globals the handler calls.
 * @internal
 * @constant
 */
const clearUserSessionMock: Mock<(event: H3Event) => Promise<void>> = vi.fn(async (): Promise<void> => {});

/**
 * The session replacement the account menu reads from.
 * @internal
 * @constant
 */
const replaceUserSessionMock: Mock<(event: H3Event, session: unknown) => Promise<void>> = vi.fn(
  async (): Promise<void> => {},
);

/**
 * The request body, supplied per case.
 * @internal
 * @constant
 */
const readBodyMock: Mock<(event: H3Event) => Promise<unknown>> = vi.fn();

/**
 * The response headers the handler sets.
 * @internal
 * @constant
 */
const setResponseHeaderMock: Mock<(event: H3Event, name: string, value: string) => void> = vi.fn();

/**
 * Pongifi's stable identifier for the signed-in player
 * @internal
 * @constant
 */
const USER_ID: string = 'a4f1c0de-0000-4000-8000-000000000001';

vi.stubGlobal(
  'defineEventHandler',
  vi.fn((handler: EventHandler): EventHandler => handler),
);
vi.stubGlobal(
  'requireUserSession',
  vi.fn(async (): Promise<{ user: { id: string } }> => ({ user: { id: USER_ID } })),
);
vi.stubGlobal('clearUserSession', clearUserSessionMock);
vi.stubGlobal('replaceUserSession', replaceUserSessionMock);
vi.stubGlobal('readBody', readBodyMock);
vi.stubGlobal('setResponseHeader', setResponseHeaderMock);

/**
 * The handler under test, imported after its globals and module mocks are in place.
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./me.patch');

/**
 * A minimal event identity; every boundary the handler crosses is a double
 * @internal
 * @constant
 */
const EVENT: H3Event = {} as H3Event;

/**
 * The name an accepted request saves
 * @internal
 * @constant
 */
const CHOSEN_NAME: string = 'Maya Topspin';

/**
 * The account persistence returns for an accepted write
 * @internal
 * @constant
 */
const SAVED: IProfile = {
  avatarUrl: null,
  createdAt: '2026-01-04T10:00:00.000Z',
  displayName: CHOSEN_NAME,
  email: 'maya@example.com',
  id: USER_ID,
  profileCompletedAt: '2026-01-05T10:00:00.000Z',
};

/**
 * Runs the handler and returns the H3 error it threw.
 * @internal
 * @function
 * @returns The thrown error
 */
async function refusal(): Promise<H3Error> {
  try {
    await handler(EVENT);
  } catch (error: unknown) {
    return error as H3Error;
  }

  throw new Error('The handler accepted a request it should have refused.');
}

/**
 * Builds the refusal a write-boundary double throws.
 * @internal
 * @function
 * @param statusCode - The status the guard refuses with
 * @returns The error the guard throws
 */
function createRefusal(statusCode: number): H3Error {
  return createError({ statusCode, statusMessage: 'Refused by the write boundary.' }) as H3Error;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();

    // Reset rather than clear: a guard left throwing from the previous case would refuse every request after it
    writeBoundaryMocks.assertSameOrigin.mockReset();
    writeBoundaryMocks.assertWithinWriteRateLimit.mockReset();
    writeBoundaryMocks.assertWithinWriteRateLimit.mockResolvedValue(undefined);
    profileMocks.updateDisplayName.mockResolvedValue(SAVED);
    readBodyMock.mockResolvedValue({ displayName: CHOSEN_NAME });
  });

  it('saves an accepted name and hands the new session back to the account menu', async (): Promise<void> => {
    expect(await handler(EVENT)).toEqual(SAVED);
    expect(profileMocks.updateDisplayName).toHaveBeenCalledWith(USER_ID, CHOSEN_NAME);
    expect(replaceUserSessionMock).toHaveBeenCalledWith(
      EVENT,
      expect.objectContaining({ user: expect.objectContaining({ displayName: CHOSEN_NAME, needsWelcome: false }) }),
    );
  });

  it('marks the response private, since it carries the account it just saved', async (): Promise<void> => {
    await handler(EVENT);

    expect(setResponseHeaderMock).toHaveBeenCalledWith(EVENT, 'Cache-Control', 'private, no-store');
  });

  it('refuses a cross-origin write without reading the body or persisting', async (): Promise<void> => {
    writeBoundaryMocks.assertSameOrigin.mockImplementation((): never => {
      throw createRefusal(403);
    });

    expect((await refusal()).statusCode).toBe(403);
    expect(readBodyMock).not.toHaveBeenCalled();
    expect(profileMocks.updateDisplayName).not.toHaveBeenCalled();
  });

  it('refuses a rate-limited write without reading the body or persisting', async (): Promise<void> => {
    writeBoundaryMocks.assertWithinWriteRateLimit.mockRejectedValue(createRefusal(429));

    expect((await refusal()).statusCode).toBe(429);
    expect(readBodyMock).not.toHaveBeenCalled();
    expect(profileMocks.updateDisplayName).not.toHaveBeenCalled();
  });

  it('checks the boundary before the session is trusted for anything else', async (): Promise<void> => {
    await handler(EVENT);

    expect(writeBoundaryMocks.assertSameOrigin).toHaveBeenCalledWith(EVENT);
    expect(writeBoundaryMocks.assertWithinWriteRateLimit).toHaveBeenCalledWith(EVENT, USER_ID);
  });

  it('refuses a body carrying an unaccepted field without persisting', async (): Promise<void> => {
    readBodyMock.mockResolvedValue({ displayName: CHOSEN_NAME, profileCompletedAt: '2020-01-01T00:00:00.000Z' });

    const error: H3Error = await refusal();

    expect(error.statusCode).toBe(PROFILE_BODY_REJECTED_STATUS);
    expect(error.statusMessage).toBe(PROFILE_BODY_UNKNOWN_FIELD_MESSAGE);
    expect(profileMocks.updateDisplayName).not.toHaveBeenCalled();
  });

  it('refuses an unusable name without persisting', async (): Promise<void> => {
    readBodyMock.mockResolvedValue({ displayName: '   ' });

    const error: H3Error = await refusal();

    expect(error.statusCode).toBe(422);
    expect(error.statusMessage).toBe(DISPLAY_NAME_EMPTY_MESSAGE);
    expect(profileMocks.updateDisplayName).not.toHaveBeenCalled();
  });

  it('ends the session when the account behind it has gone', async (): Promise<void> => {
    profileMocks.updateDisplayName.mockResolvedValue(null);

    expect((await refusal()).statusCode).toBe(401);
    expect(clearUserSessionMock).toHaveBeenCalledWith(EVENT);
    expect(replaceUserSessionMock).not.toHaveBeenCalled();
  });

  it('keeps an unfinished welcome step unfinished, since renaming is not completing it', async (): Promise<void> => {
    profileMocks.updateDisplayName.mockResolvedValue({ ...SAVED, profileCompletedAt: null });

    await handler(EVENT);

    expect(replaceUserSessionMock).toHaveBeenCalledWith(
      EVENT,
      expect.objectContaining({ user: expect.objectContaining({ needsWelcome: true }) }),
    );
  });
});
