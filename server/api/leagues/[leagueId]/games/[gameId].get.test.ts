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
 * █████████████████████████████ #server/api/leagues/[leagueId]/games/[gameId].get.test.ts █████████████████████████████
 *
 * Unit tests for the result page's read route: what it resolves, what it refuses, and what it survives.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { EventHandler, H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IMatchView } from '#shared/results';
import { ResultState } from '#shared/results';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The route resolution double, hoisted so the module mock can consume it
 * @internal
 * @constant
 */
const resolveMatchRouteMock: Mock<(...args: unknown[]) => Promise<string | null>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<string | null>> => vi.fn(),
);

/**
 * The settlement double
 * @internal
 * @constant
 */
const settleDueResultsMock: Mock<(...args: unknown[]) => Promise<number>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<number>> => vi.fn(),
);

/**
 * The membership read double
 * @internal
 * @constant
 */
const readViewerRoleMock: Mock<(...args: unknown[]) => Promise<string | null>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<string | null>> => vi.fn(),
);

/**
 * The match read double
 * @internal
 * @constant
 */
const readMatchViewMock: Mock<(...args: unknown[]) => Promise<IMatchView | null>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<IMatchView | null>> => vi.fn(),
);

/**
 * The clock double, so a case states what the database's instant is rather than inheriting the runner's
 * @internal
 * @constant
 */
const readClockMock: Mock<(...args: unknown[]) => Promise<Date | null>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<Date | null>> => vi.fn(),
);

/**
 * The transaction double, which runs its body against nothing
 * @internal
 * @constant
 */
const useResultTransactionMock: Mock<(body: (transaction: unknown) => Promise<unknown>) => Promise<unknown>> =
  vi.hoisted((): Mock<(body: (transaction: unknown) => Promise<unknown>) => Promise<unknown>> =>
    vi.fn(async (body: (transaction: unknown) => Promise<unknown>): Promise<unknown> => body({})),
  );

vi.mock(
  '#utils/results',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    resolveMatchRoute: resolveMatchRouteMock,
    settleDueResults: settleDueResultsMock,
  }),
);
vi.mock('#utils/results/queries', (): Record<string, unknown> => ({
  readClock: readClockMock,
  readMatchView: readMatchViewMock,
}));
vi.mock('#utils/leagues', (): Record<string, unknown> => ({ readViewerRole: readViewerRoleMock }));
vi.mock(
  '#utils/db',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    useResultTransaction: useResultTransactionMock,
  }),
);

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
 * The game the path names, which is not the match's own id
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

/**
 * The response headers the handler sets
 * @internal
 * @constant
 */
const setResponseHeaderMock: Mock<(event: H3Event, name: string, value: string) => void> = vi.fn();

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
const { default: handler }: { default: EventHandler } = await import('./[gameId].get');

/**
 * A match of the shape the read returns
 * @internal
 * @constant
 */
const MATCH: IMatchView = {
  canonicalMatchId: MATCH_ID,
  confirmationDeadline: '2026-09-22T12:00:00.000Z',
  revision: 1,
  state: ResultState.UNCONFIRMED,
} as unknown as IMatchView;

/**
 * The instant the database is at: before the fixture's deadline, so the result is not yet due
 * @internal
 * @constant
 */
const NOW: Date = new Date('2026-09-21T12:00:00.000Z');

/**
 * Builds an event whose path names a league and a game
 * @internal
 * @function
 * @param leagueId - What the path carries
 * @param gameId - What the path carries
 * @returns The event
 */
function buildEvent(leagueId: string = LEAGUE_ID, gameId: string = GAME_ID): H3Event {
  return { context: { params: { gameId, leagueId } }, node: { res: {} } } as unknown as H3Event;
}

/**
 * Runs the handler and returns the status it refused with
 * @internal
 * @async
 * @function
 * @param event - The request
 * @returns The status code
 */
async function statusOf(event: H3Event): Promise<number | undefined> {
  try {
    await handler(event);
  } catch (error: unknown) {
    return (error as H3Error).statusCode;
  }

  return undefined;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    // Each case arms its own doubles; a value left queued by an earlier one would be consumed here
    resolveMatchRouteMock.mockReset();
    settleDueResultsMock.mockReset();
    readViewerRoleMock.mockReset();
    readMatchViewMock.mockReset();
    readClockMock.mockReset();
    setResponseHeaderMock.mockReset();

    readViewerRoleMock.mockResolvedValue('PLAYER');
    resolveMatchRouteMock.mockResolvedValue(MATCH_ID);
    settleDueResultsMock.mockResolvedValue(0);
    readMatchViewMock.mockResolvedValue(MATCH);
    readClockMock.mockResolvedValue(NOW);
  });

  it('answers with the match, the id its page lives at, and a clean settlement', async (): Promise<void> => {
    await expect(handler(buildEvent())).resolves.toEqual({
      canonicalMatchId: MATCH_ID,
      match: MATCH,
      settlementFailed: false,
      settlementOutstanding: false,
    });
  });

  it('marks a result private before anything is read', async (): Promise<void> => {
    await handler(buildEvent());

    expect(setResponseHeaderMock).toHaveBeenCalledWith(expect.anything(), 'Cache-Control', 'private, no-store');
    expect(setResponseHeaderMock).toHaveBeenCalledWith(expect.anything(), 'Referrer-Policy', 'no-referrer');
  });

  it('reads no league data for an id that could never name one', async (): Promise<void> => {
    // A 404 rather than a cast error, and without a query: the shape is refused before the database is asked
    expect(await statusOf(buildEvent('not-a-uuid'))).toBe(404);
    expect(await statusOf(buildEvent(LEAGUE_ID, 'not-a-uuid'))).toBe(404);
    expect(readViewerRoleMock).not.toHaveBeenCalled();
    expect(resolveMatchRouteMock).not.toHaveBeenCalled();
  });

  it('tells a non-member nothing a stranger could not have guessed', async (): Promise<void> => {
    // The same 404 as a league that does not exist, and the match is never resolved: whether an id names a real
    // result is itself private league data
    readViewerRoleMock.mockResolvedValue(null);

    expect(await statusOf(buildEvent())).toBe(404);
    expect(resolveMatchRouteMock).not.toHaveBeenCalled();
    expect(readMatchViewMock).not.toHaveBeenCalled();
  });

  it('404s an id that resolves to no match of this league', async (): Promise<void> => {
    resolveMatchRouteMock.mockResolvedValue(null);

    expect(await statusOf(buildEvent())).toBe(404);
    expect(readMatchViewMock).not.toHaveBeenCalled();
  });

  it('404s a match that resolved but could not be read', async (): Promise<void> => {
    readMatchViewMock.mockResolvedValue(null);

    expect(await statusOf(buildEvent())).toBe(404);
  });

  it('settles before it reads, so a passed deadline is never rendered as still waiting', async (): Promise<void> => {
    let settled: boolean = false;
    let release: () => void = (): void => undefined;

    settleDueResultsMock.mockImplementation(
      async (): Promise<number> =>
        new Promise<number>((resolve: (value: number) => void): void => {
          release = (): void => {
            settled = true;
            resolve(0);
          };
        }),
    );
    readMatchViewMock.mockImplementation(async (): Promise<IMatchView> => {
      // Proves the settlement was awaited rather than fired and forgotten
      expect(settled).toBe(true);

      return MATCH;
    });

    const answered: Promise<unknown> = handler(buildEvent());

    // The handler suspends on the membership and resolution reads first; the latch is only armed once it reaches
    // settlement, so releasing before that would release nothing
    await vi.waitFor((): void => expect(settleDueResultsMock).toHaveBeenCalledOnce());

    expect(readMatchViewMock).not.toHaveBeenCalled();
    release();

    await answered;

    expect(readMatchViewMock).toHaveBeenCalledOnce();
  });

  it('reports a failed settlement rather than failing the page', async (): Promise<void> => {
    // The page still has to render: a result whose settlement could not run is shown with its failure and a retry,
    // and a settlement failure must not take the whole read down with it
    settleDueResultsMock.mockRejectedValue(new Error('could not settle'));

    await expect(handler(buildEvent())).resolves.toEqual({
      canonicalMatchId: MATCH_ID,
      match: MATCH,
      settlementFailed: true,
      settlementOutstanding: false,
    });
  });

  it('calls a result the sweep did not reach outstanding, even when the sweep succeeded', async (): Promise<void> => {
    // settleDueResults is bounded. With more overdue results in the league than one batch holds, a sweep that
    // resolves cleanly can leave this result still due, and the page would otherwise render ordinary pending copy
    readClockMock.mockResolvedValue(new Date('2026-09-23T12:00:00.000Z'));

    await expect(handler(buildEvent())).resolves.toMatchObject({
      settlementFailed: false,
      settlementOutstanding: true,
    });
  });

  it('does not call a result due because an unrelated settlement failed', async (): Promise<void> => {
    // The sweep covers the whole league; its failure says nothing about a result whose deadline has not arrived
    settleDueResultsMock.mockRejectedValue(new Error('could not settle'));

    await expect(handler(buildEvent())).resolves.toMatchObject({
      settlementFailed: true,
      settlementOutstanding: false,
    });
  });

  it('calls a result outstanding when its deadline passed and the sweep also failed', async (): Promise<void> => {
    settleDueResultsMock.mockRejectedValue(new Error('could not settle'));
    readClockMock.mockResolvedValue(new Date('2026-09-23T12:00:00.000Z'));

    await expect(handler(buildEvent())).resolves.toMatchObject({
      settlementFailed: true,
      settlementOutstanding: true,
    });
  });

  it('never calls a settled result outstanding, whatever its deadline says', async (): Promise<void> => {
    // The deadline is long past, but the result was accepted; nothing is owed and nothing is due
    readMatchViewMock.mockResolvedValue({ ...MATCH, state: ResultState.CONFIRMED });
    readClockMock.mockResolvedValue(new Date('2026-09-23T12:00:00.000Z'));

    await expect(handler(buildEvent())).resolves.toMatchObject({ settlementOutstanding: false });
  });

  it('judges the deadline against the database clock rather than this process’s', async (): Promise<void> => {
    // A runner running fast must not declare a result overdue that the database has not reached yet
    readClockMock.mockResolvedValue(new Date('2026-09-21T11:59:59.000Z'));

    await expect(handler(buildEvent())).resolves.toMatchObject({ settlementOutstanding: false });
    expect(readClockMock).toHaveBeenCalledWith(LEAGUE_ID);
  });

  it('does not guess when the clock could not be read', async (): Promise<void> => {
    readClockMock.mockResolvedValue(null);

    await expect(handler(buildEvent())).resolves.toMatchObject({ settlementOutstanding: false });
  });

  it('sends every game of a match to the match, not to the id that was asked for', async (): Promise<void> => {
    expect(await handler(buildEvent(LEAGUE_ID, GAME_ID))).toMatchObject({ canonicalMatchId: MATCH_ID });
    expect(resolveMatchRouteMock).toHaveBeenCalledWith(expect.anything(), USER_ID, LEAGUE_ID, GAME_ID);
  });

  it('reads the match as the viewer, with the role their membership carries', async (): Promise<void> => {
    readViewerRoleMock.mockResolvedValue('MANAGER');

    await handler(buildEvent());

    expect(readMatchViewMock).toHaveBeenCalledWith(LEAGUE_ID, MATCH_ID, USER_ID, 'MANAGER');
  });
});
