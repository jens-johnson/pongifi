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
 * █████████████████████████████ #server/api/leagues/[leagueId]/games/context.get.test.ts ██████████████████████████████
 *
 * Unit tests for the Record form's context route: what it answers, and what it refuses to distinguish.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { EventHandler, H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IResultFormContext } from '#shared/results';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The read double, hoisted so the module mock can consume it
 * @internal
 * @constant
 */
const readFormContextMock: Mock<(leagueId: string, userId: string) => Promise<IResultFormContext | null>> = vi.hoisted(
  (): Mock<(leagueId: string, userId: string) => Promise<IResultFormContext | null>> => vi.fn(),
);

/**
 * The correction read's double
 * @internal
 * @constant
 */
const readAmendContextMock: Mock<
  (leagueId: string, canonicalMatchId: string, role: string) => Promise<IResultFormContext | null>
> = vi.hoisted(
  (): Mock<(leagueId: string, canonicalMatchId: string, role: string) => Promise<IResultFormContext | null>> => vi.fn(),
);

/**
 * The role read's double, which decides access before any id is resolved
 * @internal
 * @constant
 */
const readViewerRoleMock: Mock<(leagueId: string, userId: string) => Promise<string | null>> = vi.hoisted(
  (): Mock<(leagueId: string, userId: string) => Promise<string | null>> => vi.fn(),
);

/**
 * The route resolution's double, which turns any game of a match into the match itself
 * @internal
 * @constant
 */
const resolveMatchRouteMock: Mock<() => Promise<string | null>> = vi.hoisted((): Mock<() => Promise<string | null>> =>
  vi.fn(),
);

vi.mock('#utils/results/queries', (): Record<string, unknown> => ({
  readAmendContext: readAmendContextMock,
  readFormContext: readFormContextMock,
}));
vi.mock('#utils/leagues', (): Record<string, unknown> => ({ readViewerRole: readViewerRoleMock }));
vi.mock('#utils/results', (): Record<string, unknown> => ({ resolveMatchRoute: resolveMatchRouteMock }));
vi.mock('#utils/db', (): Record<string, unknown> => ({
  useResultTransaction: async (run: (transaction: unknown) => Promise<unknown>): Promise<unknown> => await run({}),
}));

/**
 * The response headers the handler sets
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

/**
 * The game the query names, which is not the match's own id
 * @internal
 * @constant
 */
const GAME_ID: string = 'c6f3e2a0-0000-4000-8000-000000000003';

/**
 * The match that game belongs to
 * @internal
 * @constant
 */
const MATCH_ID: string = 'd7a4f3b1-0000-4000-8000-000000000004';

vi.stubGlobal(
  'defineEventHandler',
  vi.fn((handler: EventHandler): EventHandler => handler),
);
vi.stubGlobal(
  'requireUserSession',
  vi.fn(async (): Promise<{ user: { id: string } }> => ({ user: { id: USER_ID } })),
);
vi.stubGlobal('setResponseHeader', setResponseHeaderMock);

/**
 * The handler under test, imported after its globals and module mocks are in place
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./context.get');

/**
 * Builds an event whose path names a league
 * @internal
 * @function
 * @param leagueId - What the path carries
 * @returns The event
 */
function buildEvent(leagueId: string = LEAGUE_ID, query: string = ''): H3Event {
  return {
    context: { params: { leagueId } },
    node: { res: {} },
    path: `/api/leagues/${leagueId}/games/context${query}`,
  } as unknown as H3Event;
}

/**
 * A context of the shape the read returns
 * @internal
 * @constant
 */
const CONTEXT: IResultFormContext = {
  authority: { may: true, who: 'a commissioner, a manager, or a player in the match' },
  configurationRevision: 3,
  earliest: '2026-09-18T12:00:00.000Z',
  formats: [],
  leagueName: 'Friday Ladder',
  now: '2026-09-20T12:00:00.000Z',
  roster: [],
  rules: {
    matchFormat: 3,
    targetScore: {},
    winningMargin: 2,
  },
} as unknown as IResultFormContext;

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('answers with the context the session account may see', async (): Promise<void> => {
    const event: H3Event = buildEvent();

    readFormContextMock.mockResolvedValueOnce(CONTEXT);

    expect(await handler(event)).toBe(CONTEXT);
    expect(readFormContextMock).toHaveBeenCalledWith(LEAGUE_ID, USER_ID);
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store');
  });

  it('answers a non-member and an unknown league identically', async (): Promise<void> => {
    readFormContextMock.mockResolvedValueOnce(null);

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 404 } satisfies Partial<H3Error>);
  });

  it('refuses a malformed id before it reaches the database', async (): Promise<void> => {
    // The same 404, and no query: an id that could never be a league must not become a cast error, and must not
    // answer differently from an id that simply is not one
    await expect(handler(buildEvent('../leagues'))).rejects.toMatchObject({
      statusCode: 404,
    } satisfies Partial<H3Error>);
    expect(readFormContextMock).not.toHaveBeenCalled();
  });

  it('reports a database failure as a retryable 502 rather than a not-found', async (): Promise<void> => {
    readFormContextMock.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 502 } satisfies Partial<H3Error>);
  });

  it('answers a correction from the match rather than from the league', async (): Promise<void> => {
    readViewerRoleMock.mockResolvedValueOnce('MANAGER');
    resolveMatchRouteMock.mockResolvedValueOnce(MATCH_ID);
    readAmendContextMock.mockResolvedValueOnce(CONTEXT);

    expect(await handler(buildEvent(LEAGUE_ID, `?amend=${GAME_ID}`))).toBe(CONTEXT);
    // The match's own id, not the game the query named: a correction opened from a superseded game corrects the
    // result that game belongs to
    expect(readAmendContextMock).toHaveBeenCalledWith(LEAGUE_ID, MATCH_ID, 'MANAGER');
    // The league's current rules are not consulted at all, which is the whole point of the frozen snapshots
    expect(readFormContextMock).not.toHaveBeenCalled();
  });

  it('refuses a malformed game id before it reaches the database', async (): Promise<void> => {
    await expect(handler(buildEvent(LEAGUE_ID, '?amend=../games'))).rejects.toMatchObject({
      statusCode: 404,
    } satisfies Partial<H3Error>);
    expect(readViewerRoleMock).not.toHaveBeenCalled();
    expect(readAmendContextMock).not.toHaveBeenCalled();
  });

  it('answers a non-member before it resolves the game at all', async (): Promise<void> => {
    // Whether a game id names a real result is private league data: access is decided first, and the answer is the
    // same 404 the league itself gives
    readViewerRoleMock.mockResolvedValueOnce(null);

    await expect(handler(buildEvent(LEAGUE_ID, `?amend=${GAME_ID}`))).rejects.toMatchObject({
      statusCode: 404,
    } satisfies Partial<H3Error>);
    expect(resolveMatchRouteMock).not.toHaveBeenCalled();
    expect(readAmendContextMock).not.toHaveBeenCalled();
  });

  it('answers a game that belongs to no match this league holds', async (): Promise<void> => {
    readViewerRoleMock.mockResolvedValueOnce('COMMISSIONER');
    resolveMatchRouteMock.mockResolvedValueOnce(null);

    await expect(handler(buildEvent(LEAGUE_ID, `?amend=${GAME_ID}`))).rejects.toMatchObject({
      statusCode: 404,
    } satisfies Partial<H3Error>);
    expect(readAmendContextMock).not.toHaveBeenCalled();
  });

  it('reports a failed correction read as a retryable 502', async (): Promise<void> => {
    readViewerRoleMock.mockResolvedValueOnce('MANAGER');
    resolveMatchRouteMock.mockResolvedValueOnce(MATCH_ID);
    readAmendContextMock.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(handler(buildEvent(LEAGUE_ID, `?amend=${GAME_ID}`))).rejects.toMatchObject({
      statusCode: 502,
    } satisfies Partial<H3Error>);
  });
});
