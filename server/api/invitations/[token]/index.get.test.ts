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
 * █████████████████████████████████ #server/api/invitations/[token]/index.get.test.ts █████████████████████████████████
 *
 * Unit tests for the public invite lookup endpoint, its rate limit and its answers.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { createError, type EventHandler, type H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TInviteLookup } from '#shared/leagues';
import { InviteLookupKind } from '#shared/leagues';
import type { TLeagueOperationResult } from '#utils/leagues';
import { INVITE_UNAVAILABLE_MESSAGE, LeagueRefusal } from '#utils/leagues';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The doubles the handler's collaborators are replaced with.
 * @internal
 * @interface
 */
interface IHandlerMocks {
  /* Stands in for the per-address lookup limit */
  assertWithinInviteLookupRateLimit: Mock<(event: H3Event) => Promise<void>>;

  /* Stands in for the lookup */
  lookupInvite: Mock<(token: string, userId: string | null) => Promise<TLeagueOperationResult<TInviteLookup>>>;
}

/**
 * The doubles, hoisted so the module mocks can consume them.
 * @internal
 * @constant
 */
const mocks: IHandlerMocks = vi.hoisted((): IHandlerMocks => ({
  assertWithinInviteLookupRateLimit: vi.fn(),
  lookupInvite: vi.fn(),
}));

vi.mock('#utils/invite-lookup-limit', (): Record<string, unknown> => ({
  assertWithinInviteLookupRateLimit: mocks.assertWithinInviteLookupRateLimit,
}));

vi.mock(
  '#utils/leagues',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    lookupInvite: mocks.lookupInvite,
  }),
);

/**
 * The session the handler reads, supplied per case; signed out by default.
 * @internal
 * @constant
 */
const getUserSessionMock: Mock<(event: H3Event) => Promise<{ user?: { id: string } }>> = vi.fn();

/**
 * The response headers the handler sets.
 * @internal
 * @constant
 */
const setResponseHeaderMock: Mock<(event: H3Event, name: string, value: string) => void> = vi.fn();

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
vi.stubGlobal('getUserSession', getUserSessionMock);
vi.stubGlobal('setResponseHeader', setResponseHeaderMock);

/**
 * The handler under test, imported after its globals and module mocks are in place.
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./index.get');

/**
 * Builds an event whose path carries the token and whose response records its status.
 * @internal
 * @function
 * @returns The event
 */
function buildEvent(): H3Event {
  return { context: { params: { token: TOKEN } }, node: { res: {} } } as unknown as H3Event;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    mocks.assertWithinInviteLookupRateLimit.mockReset();
    mocks.assertWithinInviteLookupRateLimit.mockResolvedValue(undefined);
    getUserSessionMock.mockResolvedValue({});
  });

  it('looks the token up for a signed-out visitor, privately and with no referrer', async (): Promise<void> => {
    const event: H3Event = buildEvent();
    const summary: TInviteLookup = {
      inviterName: 'Maya',
      kind: InviteLookupKind.INVITE,
      leagueName: 'Friday Ladder',
      memberCount: 3,
    };

    mocks.lookupInvite.mockResolvedValueOnce({ ok: true, value: summary });

    expect(await handler(event)).toEqual(summary);
    expect(mocks.lookupInvite).toHaveBeenCalledWith(TOKEN, null);
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store');
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Referrer-Policy', 'no-referrer');
  });

  it('passes a signed-in visitor so an active member is sent home', async (): Promise<void> => {
    getUserSessionMock.mockResolvedValueOnce({ user: { id: 'member-1' } });
    mocks.lookupInvite.mockResolvedValueOnce({ ok: true, value: { kind: InviteLookupKind.MEMBER, leagueId: 'l-1' } });

    await handler(buildEvent());

    expect(mocks.lookupInvite).toHaveBeenCalledWith(TOKEN, 'member-1');
  });

  it('counts the lookup before anything is looked up, and stops there when over the limit', async (): Promise<void> => {
    mocks.assertWithinInviteLookupRateLimit.mockRejectedValueOnce(createError({ statusCode: 429 }));

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 429 });
    expect(mocks.lookupInvite).not.toHaveBeenCalled();
    expect(setResponseHeaderMock).toHaveBeenCalledWith(expect.anything(), 'Referrer-Policy', 'no-referrer');
  });

  it('answers an unavailable invite with the one generic 404 body', async (): Promise<void> => {
    const event: H3Event = buildEvent();

    mocks.lookupInvite.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.INVITE_UNAVAILABLE });

    expect(await handler(event)).toEqual({ message: INVITE_UNAVAILABLE_MESSAGE, statusCode: 404 });
    expect(event.node.res.statusCode).toBe(404);
  });

  it('reports a database failure as a retryable 502, not as an unavailable invite', async (): Promise<void> => {
    mocks.lookupInvite.mockRejectedValueOnce(new Error('An invitation query failed with SQLSTATE 08006.'));

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 502 });
  });
});
