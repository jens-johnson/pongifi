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
 * ███████████████████████████ #server/api/leagues/[leagueId]/invitations/index.post.test.ts ███████████████████████████
 *
 * Unit tests for the invite-link create endpoint write boundary and refusal answers.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { createError, type EventHandler, type H3Error, type H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IInvitePanel, IIssueInviteRequest } from '#shared/leagues';
import { LEAGUE_BODY_REJECTED_STATUS } from '#shared/leagues';
import type { TLeagueOperationResult } from '#utils/leagues';
import { LeagueRefusal } from '#utils/leagues';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The boundary and persistence doubles the handler's collaborators are replaced with.
 * @internal
 * @interface
 */
interface IHandlerMocks {
  /* Stands in for the same-origin check */
  assertSameOrigin: Mock<(event: H3Event) => void>;

  /* Stands in for the per-account write limit */
  assertWithinWriteRateLimit: Mock<(event: H3Event, userId: string) => Promise<void>>;

  /* Stands in for the one operation this endpoint performs */
  issueInvite: Mock<
    (leagueId: string, userId: string, request: IIssueInviteRequest) => Promise<TLeagueOperationResult<IInvitePanel>>
  >;
}

/**
 * The doubles, hoisted so the module mocks can consume them.
 * @internal
 * @constant
 */
const mocks: IHandlerMocks = vi.hoisted((): IHandlerMocks => ({
  assertSameOrigin: vi.fn(),
  assertWithinWriteRateLimit: vi.fn(),
  issueInvite: vi.fn(),
}));

vi.mock('#utils/write-boundary', (): Record<string, unknown> => ({
  assertSameOrigin: mocks.assertSameOrigin,
  assertWithinWriteRateLimit: mocks.assertWithinWriteRateLimit,
}));

vi.mock(
  '#utils/leagues',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    issueInvite: mocks.issueInvite,
  }),
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

/**
 * The league the path names
 * @internal
 * @constant
 */
const LEAGUE_ID: string = 'b5e2d1ef-0000-4000-8000-000000000002';

vi.stubGlobal(
  'defineEventHandler',
  vi.fn((handler: EventHandler): EventHandler => handler),
);
vi.stubGlobal(
  'requireUserSession',
  vi.fn(async (): Promise<{ user: { id: string } }> => ({ user: { id: USER_ID } })),
);
vi.stubGlobal(
  'clearUserSession',
  vi.fn(async (): Promise<void> => {}),
);
vi.stubGlobal('readBody', readBodyMock);
vi.stubGlobal('setResponseHeader', setResponseHeaderMock);

/**
 * The handler under test, imported after its globals and module mocks are in place.
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./index.post');

/**
 * An event whose path names the league
 * @internal
 * @constant
 */
const EVENT: H3Event = { context: { params: { leagueId: LEAGUE_ID } }, node: { res: {} } } as unknown as H3Event;

/**
 * Runs the handler and returns the H3 error it threw.
 * @internal
 * @function
 * @throws When the handler accepted the request
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

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockReset();
    mocks.assertWithinWriteRateLimit.mockReset();
    mocks.assertWithinWriteRateLimit.mockResolvedValue(undefined);
    mocks.issueInvite.mockResolvedValue({ ok: true, value: { link: null } });
    readBodyMock.mockResolvedValue({
      expiresInDays: 7,
      maxUses: null,
      previousId: null,
    });
  });

  it('issues for the league in the path and marks the token-bearing answer private with no referrer', async (): Promise<void> => {
    expect(await handler(EVENT)).toEqual({ link: null });
    expect(mocks.issueInvite).toHaveBeenCalledWith(LEAGUE_ID, USER_ID, {
      expiresInDays: 7,
      maxUses: null,
      previousId: null,
    });
    expect(setResponseHeaderMock).toHaveBeenCalledWith(EVENT, 'Cache-Control', 'private, no-store');
    expect(setResponseHeaderMock).toHaveBeenCalledWith(EVENT, 'Referrer-Policy', 'no-referrer');
  });

  it('refuses a rate-limited request without reading the body', async (): Promise<void> => {
    mocks.assertWithinWriteRateLimit.mockRejectedValueOnce(createError({ statusCode: 429 }));

    expect((await refusal()).statusCode).toBe(429);
    expect(readBodyMock).not.toHaveBeenCalled();
  });

  it('refuses an addressed invitation as malformed without writing', async (): Promise<void> => {
    readBodyMock.mockResolvedValueOnce({ email: 'friend@example.com', expiresInDays: 7 });

    expect((await refusal()).statusCode).toBe(LEAGUE_BODY_REJECTED_STATUS);
    expect(mocks.issueInvite).not.toHaveBeenCalled();
  });

  it('answers a player with 403 and a stale panel with 409', async (): Promise<void> => {
    mocks.issueInvite.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.FORBIDDEN });

    expect((await refusal()).statusCode).toBe(403);

    mocks.issueInvite.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.STALE });

    expect((await refusal()).statusCode).toBe(409);
  });
});
