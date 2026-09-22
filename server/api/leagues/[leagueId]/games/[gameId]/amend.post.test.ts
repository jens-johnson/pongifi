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
 * █████████████████████████ #server/api/leagues/[leagueId]/games/[gameId]/amend.post.test.ts ██████████████████████████
 *
 * Unit tests for the amendment route: what it corrects, what it refuses, and what it hands over untouched.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { EventHandler, H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IResultSubmission } from '#shared/results';
import { AMENDED_PLAYED_AT_MESSAGE, ResultEnding, ResultState, Seat } from '#shared/results';
import type { TResultOutcome } from '#utils/results';
import { ResultRefusal } from '#utils/results';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The correction double, hoisted so the module mock can consume it
 * @internal
 * @constant
 */
const amendResultMock: Mock<(...args: unknown[]) => Promise<TResultOutcome>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<TResultOutcome>> => vi.fn(),
);

/**
 * The route resolution double
 * @internal
 * @constant
 */
const resolveMatchRouteMock: Mock<(...args: unknown[]) => Promise<string | null>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<string | null>> => vi.fn(),
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
 * The transaction double, which runs its body against nothing
 * @internal
 * @constant
 */
const useResultTransactionMock: Mock<(body: (transaction: unknown) => Promise<unknown>) => Promise<unknown>> =
  vi.hoisted((): Mock<(body: (transaction: unknown) => Promise<unknown>) => Promise<unknown>> =>
    vi.fn(async (body: (transaction: unknown) => Promise<unknown>): Promise<unknown> => body({})),
  );

/**
 * The same-origin check, which a cross-site save fails
 * @internal
 * @constant
 */
const assertSameOriginMock: Mock<(...args: unknown[]) => void> = vi.hoisted((): Mock<(...args: unknown[]) => void> =>
  vi.fn(),
);

vi.mock(
  '#utils/results',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    amendResult: amendResultMock,
    resolveMatchRoute: resolveMatchRouteMock,
  }),
);
vi.mock('#utils/leagues', (): Record<string, unknown> => ({ readViewerRole: readViewerRoleMock }));
vi.mock(
  '#utils/db',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    useResultTransaction: useResultTransactionMock,
  }),
);
vi.mock('#utils/write-boundary', (): Record<string, unknown> => ({
  assertSameOrigin: assertSameOriginMock,
  assertWithinWriteRateLimit: vi.fn(async (): Promise<void> => {}),
}));

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
 * The game the path names
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
 * The operation this correction belongs to
 * @internal
 * @constant
 */
const OPERATION_ID: string = 'e8b5a4c2-0000-4000-8000-000000000005';

/**
 * The body double, so each case states its own rather than inheriting one left behind
 * @internal
 * @constant
 */
const readBodyMock: Mock<() => Promise<unknown>> = vi.fn();

/**
 * The status the handler sets
 * @internal
 * @constant
 */
const setResponseStatusMock: Mock<(event: H3Event, status: number) => void> = vi.fn();

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
vi.stubGlobal('setResponseStatus', setResponseStatusMock);
vi.stubGlobal('readBody', readBodyMock);

/**
 * The handler under test, imported after its globals and module mocks are in place
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./amend.post');

/**
 * What a committed correction recorded
 * @internal
 * @constant
 */
const EFFECT: TResultOutcome = {
  current: { revision: 2, state: ResultState.CONFIRMED } as never,
  ok: true,
  replayed: false,
  value: {
    canonicalMatchId: MATCH_ID,
    resultRevisionId: 'r1',
    revision: 2,
    state: ResultState.CONFIRMED,
  },
};

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
 * A well-formed press
 * @internal
 * @function
 * @param overrides - What the case changes
 * @returns The body
 */
function buildBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientOperationId: OPERATION_ID,
    expectedRevision: 1,
    submission: submission(),
    ...overrides,
  };
}

/**
 * A corrected result of the shape the Amend form sends
 * @internal
 * @function
 * @returns The submission
 */
function submission(): IResultSubmission {
  return {
    ending: ResultEnding.COMPLETED,
    gameType: 'SINGLES' as IResultSubmission['gameType'],
    games: [
      {
        a: 11,
        b: 4,
        gameNumber: 1,
      },
    ],
    playedAt: '2026-09-20T12:00:00.000Z',
    retiredSeat: null,
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: USER_ID,
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: MATCH_ID,
      },
    ],
  };
}

/**
 * Runs the handler and returns the status it refused with
 * @internal
 * @async
 * @function
 * @param event - The request
 * @returns The status code, or nothing when it did not throw
 */
async function statusOf(event: H3Event = buildEvent()): Promise<number | undefined> {
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
    amendResultMock.mockReset();
    resolveMatchRouteMock.mockReset();
    readViewerRoleMock.mockReset();
    useResultTransactionMock.mockClear();
    assertSameOriginMock.mockReset();
    readBodyMock.mockReset();
    setResponseStatusMock.mockReset();
    setResponseHeaderMock.mockReset();

    readViewerRoleMock.mockResolvedValue('PLAYER');
    resolveMatchRouteMock.mockResolvedValue(MATCH_ID);
    amendResultMock.mockResolvedValue(EFFECT);
    readBodyMock.mockResolvedValue(buildBody());
  });

  it('answers with what the correction did and where the match stands now', async (): Promise<void> => {
    await expect(handler(buildEvent())).resolves.toEqual({
      current: EFFECT.ok ? EFFECT.current : null,
      effect: EFFECT.ok ? EFFECT.value : null,
      replayed: false,
    });
  });

  it('marks a result private before anything is read', async (): Promise<void> => {
    await handler(buildEvent());

    expect(setResponseHeaderMock).toHaveBeenCalledWith(expect.anything(), 'Cache-Control', 'private, no-store');
    expect(setResponseHeaderMock).toHaveBeenCalledWith(expect.anything(), 'Referrer-Policy', 'no-referrer');
  });

  it('refuses a cross-site save without parsing its body', async (): Promise<void> => {
    assertSameOriginMock.mockImplementation((): never => {
      throw Object.assign(new Error('cross site'), { statusCode: 403 });
    });

    expect(await statusOf()).toBe(403);
    expect(readBodyMock).not.toHaveBeenCalled();
  });

  it('reads no league data for an id that could never name one', async (): Promise<void> => {
    expect(await statusOf(buildEvent('not-a-uuid'))).toBe(404);
    expect(await statusOf(buildEvent(LEAGUE_ID, 'not-a-uuid'))).toBe(404);
    expect(readViewerRoleMock).not.toHaveBeenCalled();
    expect(readBodyMock).not.toHaveBeenCalled();
  });

  it('refuses a body this page does not send', async (): Promise<void> => {
    readBodyMock.mockResolvedValue(buildBody({ action: 'DELETE' }));

    expect(await statusOf()).toBe(400);
    expect(amendResultMock).not.toHaveBeenCalled();
  });

  it('tells a non-member nothing a stranger could not have guessed', async (): Promise<void> => {
    // The same 404 a league that does not exist earns, and the match is never resolved
    readViewerRoleMock.mockResolvedValue(null);

    expect(await statusOf()).toBe(404);
    expect(resolveMatchRouteMock).not.toHaveBeenCalled();
    expect(amendResultMock).not.toHaveBeenCalled();
  });

  it('404s an id that resolves to no match of this league, without writing', async (): Promise<void> => {
    resolveMatchRouteMock.mockResolvedValue(null);

    expect(await statusOf()).toBe(404);
    expect(amendResultMock).not.toHaveBeenCalled();
  });

  it('resolves and corrects under one transaction', async (): Promise<void> => {
    // Two would let the match this caller resolved be superseded before the correction landed on it
    await handler(buildEvent());

    expect(useResultTransactionMock).toHaveBeenCalledOnce();
    expect(resolveMatchRouteMock).toHaveBeenCalledWith(expect.anything(), USER_ID, LEAGUE_ID, GAME_ID);
    expect(amendResultMock).toHaveBeenCalledWith(expect.anything(), USER_ID, {
      canonicalMatchId: MATCH_ID,
      clientOperationId: OPERATION_ID,
      expectedRevision: 1,
      submission: submission(),
    });
  });

  it('hands the submission over as it arrived', async (): Promise<void> => {
    // The service normalizes against the format frozen at recording; normalizing here would measure the correction
    // against the format the body claimed instead. The fixture is deliberately un-normalized — games out of order,
    // seats out of order, an untrimmed guest name — so a route that normalized would be caught rather than matched
    const claimed: IResultSubmission = {
      ...submission(),
      games: [
        {
          a: 9,
          b: 11,
          gameNumber: 2,
        },
        {
          a: 11,
          b: 4,
          gameNumber: 1,
        },
      ],
      seats: [
        {
          guestName: '  Ada  ',
          seat: Seat.B1,
          userId: null,
        },
        {
          guestName: null,
          seat: Seat.A1,
          userId: USER_ID,
        },
      ],
    };

    readBodyMock.mockResolvedValue(buildBody({ submission: claimed }));
    await handler(buildEvent());

    expect(amendResultMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ submission: claimed }),
    );
  });

  it('distinguishes a correction it made from one it replayed', async (): Promise<void> => {
    const event: H3Event = buildEvent();

    await handler(event);
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201);

    setResponseStatusMock.mockClear();
    amendResultMock.mockResolvedValue({ ...(EFFECT as object), replayed: true } as TResultOutcome);

    await handler(event);
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 200);
  });

  it('returns a conflict as a body rather than throwing it away', async (): Promise<void> => {
    // A refusal can follow a settlement the same operation performed on its way in; throwing would roll that back
    const event: H3Event = buildEvent();

    amendResultMock.mockResolvedValue({
      ok: false,
      refusal: ResultRefusal.STALE_RESULT,
      state: ResultState.DISPUTED,
    });

    await expect(handler(event)).resolves.toMatchObject({
      refusal: ResultRefusal.STALE_RESULT,
      statusCode: 409,
    });

    // The refusal helper reaches h3 directly rather than the auto-imported global, so the response itself is what
    // carries the status
    expect(event.node.res.statusCode).toBe(409);
  });

  it('carries the frozen window into the sentence a thrown play-time refusal states', async (): Promise<void> => {
    // A 422 is thrown rather than returned, so the details have to reach the answer before the throw: without that
    // the sentence falls back to one that names no window at all
    amendResultMock.mockResolvedValue({
      details: { windowHours: 6 },
      ok: false,
      refusal: ResultRefusal.AMENDMENT_PLAY_TIME,
      state: ResultState.DISPUTED,
    });

    try {
      await handler(buildEvent());
      expect.unreachable('the refusal should have been thrown');
    } catch (error: unknown) {
      expect((error as H3Error).statusCode).toBe(422);
      expect((error as H3Error).statusMessage).toBe(AMENDED_PLAYED_AT_MESSAGE(6));
    }
  });

  it('throws a refusal that is not a conflict', async (): Promise<void> => {
    amendResultMock.mockResolvedValue({
      ok: false,
      refusal: ResultRefusal.FORBIDDEN,
      state: null,
    });

    expect(await statusOf()).toBe(403);
  });
});
