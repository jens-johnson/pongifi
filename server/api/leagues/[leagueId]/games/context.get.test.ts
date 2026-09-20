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

vi.mock('#utils/results/queries', (): Record<string, unknown> => ({ readFormContext: readFormContextMock }));

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
function buildEvent(leagueId: string = LEAGUE_ID): H3Event {
  return { context: { params: { leagueId } }, node: { res: {} } } as unknown as H3Event;
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
});
