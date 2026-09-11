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
 * ████████████████████████████████ #server/api/invitations/[token]/accept.post.test.ts ████████████████████████████████
 *
 * Unit tests for the invite acceptance endpoint write boundary and refusal answers.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { createError, type EventHandler, type H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IAcceptInviteResponse } from '#shared/leagues';
import type { TLeagueOperationResult } from '#utils/leagues';
import { LeagueRefusal, WELCOME_REQUIRED_MESSAGE } from '#utils/leagues';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The boundary and persistence doubles the handler's collaborators are replaced with.
 * @internal
 * @interface
 */
interface IHandlerMocks {
  /* Stands in for the acceptance */
  acceptInvite: Mock<(token: string, userId: string) => Promise<TLeagueOperationResult<IAcceptInviteResponse>>>;

  /* Stands in for the same-origin check */
  assertSameOrigin: Mock<(event: H3Event) => void>;

  /* Stands in for the per-account write limit */
  assertWithinWriteRateLimit: Mock<(event: H3Event, userId: string) => Promise<void>>;
}

/**
 * The doubles, hoisted so the module mocks can consume them.
 * @internal
 * @constant
 */
const mocks: IHandlerMocks = vi.hoisted((): IHandlerMocks => ({
  acceptInvite: vi.fn(),
  assertSameOrigin: vi.fn(),
  assertWithinWriteRateLimit: vi.fn(),
}));

vi.mock('#utils/write-boundary', (): Record<string, unknown> => ({
  assertSameOrigin: mocks.assertSameOrigin,
  assertWithinWriteRateLimit: mocks.assertWithinWriteRateLimit,
}));

vi.mock(
  '#utils/leagues',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    acceptInvite: mocks.acceptInvite,
  }),
);

/**
 * The session clear a vanished account triggers.
 * @internal
 * @constant
 */
const clearUserSessionMock: Mock<(event: H3Event) => Promise<void>> = vi.fn(async (): Promise<void> => {});

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

/**
 * The token the path carries
 * @internal
 * @constant
 */
const TOKEN: string = 'x'.repeat(43);

vi.stubGlobal(
  'defineEventHandler',
  vi.fn((handler: EventHandler): EventHandler => handler),
);
vi.stubGlobal(
  'requireUserSession',
  vi.fn(async (): Promise<{ user: { id: string } }> => ({ user: { id: USER_ID } })),
);
vi.stubGlobal('clearUserSession', clearUserSessionMock);
vi.stubGlobal('setResponseHeader', setResponseHeaderMock);

/**
 * The handler under test, imported after its globals and module mocks are in place.
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./accept.post');

/**
 * An event whose path carries the token
 * @internal
 * @constant
 */
const EVENT: H3Event = { context: { params: { token: TOKEN } }, node: { res: {} } } as unknown as H3Event;

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockReset();
    mocks.assertWithinWriteRateLimit.mockReset();
    mocks.assertWithinWriteRateLimit.mockResolvedValue(undefined);
    mocks.acceptInvite.mockResolvedValue({ ok: true, value: { leagueId: 'league-1' } });
  });

  it('accepts for the session account and returns the league, privately with no referrer', async (): Promise<void> => {
    expect(await handler(EVENT)).toEqual({ leagueId: 'league-1' });
    expect(mocks.acceptInvite).toHaveBeenCalledWith(TOKEN, USER_ID);
    expect(setResponseHeaderMock).toHaveBeenCalledWith(EVENT, 'Referrer-Policy', 'no-referrer');
  });

  it('refuses a cross-origin or rate-limited request without attempting the acceptance', async (): Promise<void> => {
    mocks.assertSameOrigin.mockImplementationOnce((): never => {
      throw createError({ statusCode: 403 });
    });

    await expect(handler(EVENT)).rejects.toMatchObject({ statusCode: 403 });

    mocks.assertWithinWriteRateLimit.mockRejectedValueOnce(createError({ statusCode: 429 }));

    await expect(handler(EVENT)).rejects.toMatchObject({ statusCode: 429 });
    expect(mocks.acceptInvite).not.toHaveBeenCalled();
  });

  it('tells an unfinished account to finish welcome, and signs a vanished one out', async (): Promise<void> => {
    mocks.acceptInvite.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.NEEDS_WELCOME });

    await expect(handler(EVENT)).rejects.toMatchObject({ statusCode: 403, statusMessage: WELCOME_REQUIRED_MESSAGE });

    mocks.acceptInvite.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.ACCOUNT_MISSING });

    await expect(handler(EVENT)).rejects.toMatchObject({ statusCode: 401 });
    expect(clearUserSessionMock).toHaveBeenCalledWith(EVENT);
  });
});
