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
 * █████████████████████████████████ #server/api/leagues/[leagueId]/index.get.test.ts ██████████████████████████████████
 *
 * Unit tests for the league read endpoint, including its private not-found answer.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { EventHandler, H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ILeagueDetail } from '#shared/leagues';
import type { TLeagueOperationResult } from '#utils/leagues';
import { LEAGUE_NOT_FOUND_MESSAGE, LeagueRefusal } from '#utils/leagues';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The read double, hoisted so the module mock can consume it.
 * @internal
 * @constant
 */
const readLeagueDetailMock: Mock<(leagueId: string, userId: string) => Promise<TLeagueOperationResult<ILeagueDetail>>> =
  vi.hoisted((): Mock<(leagueId: string, userId: string) => Promise<TLeagueOperationResult<ILeagueDetail>>> => vi.fn());

vi.mock(
  '#utils/leagues',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    readLeagueDetail: readLeagueDetailMock,
  }),
);

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
vi.stubGlobal('setResponseHeader', setResponseHeaderMock);

/**
 * The handler under test, imported after its globals and module mocks are in place.
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./index.get');

/**
 * Builds an event whose path names the league and whose response records its status.
 * @internal
 * @function
 * @returns The event
 */
function buildEvent(): H3Event {
  return { context: { params: { leagueId: LEAGUE_ID } }, node: { res: {} } } as unknown as H3Event;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('reads the league named by the path for the session account', async (): Promise<void> => {
    const detail: ILeagueDetail = { id: LEAGUE_ID } as ILeagueDetail;

    readLeagueDetailMock.mockResolvedValueOnce({ ok: true, value: detail });

    expect(await handler(buildEvent())).toBe(detail);
    expect(readLeagueDetailMock).toHaveBeenCalledWith(LEAGUE_ID, USER_ID);
  });

  it('answers not-found as a 404 body that keeps the private cache policy', async (): Promise<void> => {
    const event: H3Event = buildEvent();

    readLeagueDetailMock.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.LEAGUE_NOT_FOUND });

    expect(await handler(event)).toEqual({ message: LEAGUE_NOT_FOUND_MESSAGE, statusCode: 404 });
    expect(event.node.res.statusCode).toBe(404);
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store');
  });

  it('reports a database failure as a retryable 502 rather than a not-found', async (): Promise<void> => {
    readLeagueDetailMock.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 502 } satisfies Partial<H3Error>);
  });
});
