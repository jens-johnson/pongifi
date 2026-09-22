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
 * ██████████████████████████████ #server/api/leagues/[leagueId]/games/index.post.test.ts ██████████████████████████████
 *
 * Unit tests for recording a result: what it writes, what it warns about, and what it refuses.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { EventHandler, H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IResultSubmission } from '#shared/results';
import { RECORDED_PLAYED_AT_MESSAGE, ResultEnding, ResultState, Seat } from '#shared/results';
import type { TResultOutcome } from '#utils/results';
import { ResultRefusal } from '#utils/results';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The service double, hoisted so the module mock can consume it
 * @internal
 * @constant
 */
const recordResultMock: Mock<(...args: unknown[]) => Promise<TResultOutcome>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<TResultOutcome>> => vi.fn(),
);

/**
 * The membership check double: what role, if any, this account holds in the league
 * @internal
 * @constant
 */
const readViewerRoleMock: Mock<(...args: unknown[]) => Promise<string | null>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<string | null>> => vi.fn(),
);

/**
 * The form-context double, which a stale-rules conflict answers with
 * @internal
 * @constant
 */
const readFormContextMock: Mock<(...args: unknown[]) => Promise<unknown>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<unknown>> => vi.fn(),
);

/**
 * What the transaction wrapper was asked to run, so the case can prove the service ran inside one
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
    recordResult: recordResultMock,
  }),
);
vi.mock('#utils/results/queries', (): Record<string, unknown> => ({ readFormContext: readFormContextMock }));
vi.mock('#utils/leagues', (): Record<string, unknown> => ({ readViewerRole: readViewerRoleMock }));
vi.mock(
  '#utils/db',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    useResultTransaction: useResultTransactionMock,
  }),
);
vi.mock('#utils/write-boundary', (): Record<string, unknown> => ({
  assertSameOrigin: vi.fn(),
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
 * The match a duplicate warning names
 * @internal
 * @constant
 */
const EXISTING_MATCH: string = 'c6f3e2a0-0000-4000-8000-000000000003';

/**
 * When a candidate match says it was played, near enough the entry to be a candidate at all
 * @internal
 * @constant
 */
const CANDIDATE_PLAYED_AT: string = '2026-09-20T12:10:00.000Z';

/**
 * The token a warning issued, sent back to record anyway
 * @internal
 * @constant
 */
const ACKNOWLEDGEMENT: string = 'e3b0c44298fc1c149afbf4c8996fb924';

/**
 * The operation this save belongs to
 * @internal
 * @constant
 */
const OPERATION: string = 'd7a4f3b1-0000-4000-8000-000000000004';

/**
 * What the body carries
 * @internal
 * @constant
 */
let body: Record<string, unknown>;

/**
 * The status the answer recorded
 * @internal
 * @constant
 */
const setResponseStatusMock: Mock<(event: H3Event, status: number) => void> = vi.fn();

vi.stubGlobal(
  'defineEventHandler',
  vi.fn((handler: EventHandler): EventHandler => handler),
);
vi.stubGlobal(
  'requireUserSession',
  vi.fn(async (): Promise<{ user: { id: string } }> => ({ user: { id: USER_ID } })),
);
vi.stubGlobal('setResponseHeader', vi.fn());
vi.stubGlobal('setResponseStatus', setResponseStatusMock);
vi.stubGlobal(
  'readBody',
  vi.fn(async (): Promise<unknown> => body),
);

/**
 * The handler under test, imported after its globals and module mocks are in place
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./index.post');

/**
 * A submission of the shape the form sends
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
        userId: EXISTING_MATCH,
      },
    ],
  };
}

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
 * What the service answers when it recorded the result
 * @internal
 * @constant
 */
const RECORDED: TResultOutcome = {
  current: {
    canonicalMatchId: EXISTING_MATCH,
    revision: 1,
    resultRevisionId: OPERATION,
    state: ResultState.UNCONFIRMED,
  },
  ok: true,
  replayed: false,
  value: {
    canonicalMatchId: EXISTING_MATCH,
    revision: 1,
    resultRevisionId: OPERATION,
    state: ResultState.UNCONFIRMED,
  },
};

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    // Reset rather than clear: a `mockResolvedValueOnce` a case queued and never consumed — the duplicate read in a
    // case that takes the receipt path, for one — would otherwise be waiting for whichever case ran next
    for (const double of [readFormContextMock, readViewerRoleMock, recordResultMock]) {
      double.mockReset();
    }

    useResultTransactionMock.mockImplementation(
      async (run: (transaction: unknown) => Promise<unknown>): Promise<unknown> => run({}),
    );
    readViewerRoleMock.mockResolvedValue('PLAYER');
    readFormContextMock.mockResolvedValue({ configurationRevision: 4 });
    body = {
      clientOperationId: OPERATION,
      expectedLeagueRevision: 1,
      submission: submission(),
    };
  });

  it('records the result inside one transaction, and hands the service what was acknowledged', async (): Promise<void> => {
    recordResultMock.mockResolvedValueOnce(RECORDED);
    body = { ...body, acknowledgement: ACKNOWLEDGEMENT };

    const answer = (await handler(buildEvent())) as { effect: unknown; replayed: boolean };

    expect(answer.effect).toEqual(RECORDED.ok && RECORDED.value);
    expect(useResultTransactionMock).toHaveBeenCalledTimes(1);
    expect(recordResultMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({
        acknowledgement: ACKNOWLEDGEMENT,
        clientOperationId: OPERATION,
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
      }),
    );
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 201);
  });

  it('answers a replayed save with 200 rather than recording a second result', async (): Promise<void> => {
    recordResultMock.mockResolvedValueOnce({ ...RECORDED, replayed: true } as TResultOutcome);

    const answer = (await handler(buildEvent())) as { replayed: boolean };

    expect(answer.replayed).toBe(true);
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 200);
  });

  it('tells a non-member nothing about the league, and never reaches the service', async (): Promise<void> => {
    // A session is authentication, not access: nothing about this league may be read before membership is
    readViewerRoleMock.mockResolvedValueOnce(null);

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 404 } satisfies Partial<H3Error>);
    expect(recordResultMock).not.toHaveBeenCalled();
  });

  it('passes a probable duplicate through as the service decided it, candidates and all', async (): Promise<void> => {
    // Decided under the league's lock rather than read before it, so the list travels with the refusal
    recordResultMock.mockResolvedValueOnce({
      details: {
        acknowledgement: ACKNOWLEDGEMENT,
        candidates: [{ canonicalMatchId: EXISTING_MATCH, playedAt: CANDIDATE_PLAYED_AT }],
      },
      ok: false,
      refusal: ResultRefusal.PROBABLE_DUPLICATE,
      state: null,
    } as TResultOutcome);

    const answer = (await handler(buildEvent())) as {
      candidates: { canonicalMatchId: string }[];
      refusal: string;
      statusCode: number;
    };

    expect(answer).toMatchObject({ refusal: ResultRefusal.PROBABLE_DUPLICATE, statusCode: 409 });
    expect(answer.candidates.map((candidate): string => candidate.canonicalMatchId)).toEqual([EXISTING_MATCH]);
    // The page sends this back to record anyway; without it there is nothing to answer the warning with
    expect((answer as unknown as { acknowledgement: string }).acknowledgement).toBe(ACKNOWLEDGEMENT);
  });

  it('hands a stale-rules conflict the rules that are current now', async (): Promise<void> => {
    // The one recovery the service cannot supply: it refused because the league moved, and the page needs where the
    // league is now to redraw its caption before Save is offered again
    recordResultMock.mockResolvedValueOnce({
      ok: false,
      refusal: ResultRefusal.STALE_LEAGUE_RULES,
      state: null,
    } as TResultOutcome);

    const answer = (await handler(buildEvent())) as { context: { configurationRevision: number }; refusal: string };

    expect(answer.refusal).toBe(ResultRefusal.STALE_LEAGUE_RULES);
    expect(answer.context.configurationRevision).toBe(4);
  });

  it('carries the existing result the service named, rather than one it looked up itself', async (): Promise<void> => {
    recordResultMock.mockResolvedValueOnce({
      details: { existing: { canonicalMatchId: EXISTING_MATCH } },
      ok: false,
      refusal: ResultRefusal.OPERATION_BODY_CHANGED,
      state: null,
    } as TResultOutcome);

    const answer = (await handler(buildEvent())) as { existing: { canonicalMatchId: string } };

    expect(answer.existing.canonicalMatchId).toBe(EXISTING_MATCH);
  });

  it('says nothing about an existing result the service did not name', async (): Promise<void> => {
    // A receipt is keyed by actor, operation and id, so the match behind it can belong to a league this request
    // never mentioned. When the service withholds it, the route must not invent one
    recordResultMock.mockResolvedValueOnce({
      details: {},
      ok: false,
      refusal: ResultRefusal.OPERATION_BODY_CHANGED,
      state: null,
    } as TResultOutcome);

    const answer = (await handler(buildEvent())) as Record<string, unknown>;

    expect(answer.existing).toBeUndefined();
    expect(answer.refusal).toBe(ResultRefusal.OPERATION_BODY_CHANGED);
  });

  it('throws a refusal that leaves the page nothing to redraw to', async (): Promise<void> => {
    recordResultMock.mockResolvedValueOnce({
      ok: false,
      refusal: ResultRefusal.FORBIDDEN,
      state: null,
    } as TResultOutcome);

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 403 } satisfies Partial<H3Error>);
  });

  it('carries the league’s window into the sentence a thrown play-time refusal states', async (): Promise<void> => {
    // A 422 is thrown rather than returned, so the details have to reach the answer before the throw: without that
    // the sentence falls back to one that names no window at all
    recordResultMock.mockResolvedValueOnce({
      details: { windowHours: 48 },
      ok: false,
      refusal: ResultRefusal.ENTRY_PLAY_TIME,
      state: null,
    } as TResultOutcome);

    await expect(handler(buildEvent())).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: RECORDED_PLAYED_AT_MESSAGE(48),
    } satisfies Partial<H3Error>);
  });

  it('refuses a malformed body before anything reads the league', async (): Promise<void> => {
    body = {
      clientOperationId: 'not-a-uuid',
      expectedLeagueRevision: 1,
      submission: submission(),
    };

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 400 } satisfies Partial<H3Error>);
    expect(readViewerRoleMock).not.toHaveBeenCalled();
    expect(recordResultMock).not.toHaveBeenCalled();
  });

  it('keeps every refusal it decides itself off the statuses that mean a receipt was consulted', async (): Promise<void> => {
    // The Record page reads a refused Check by its status. A 409 and a 422 are reached inside the transaction,
    // after `replayOperation` has looked for the operation's receipt, so either of them answers the check: a 422,
    // and a 409 about the league's rules, because the lookup found nothing, and a changed-body 409 because the
    // lookup found a receipt for another body. Everything the route decides in front of that lookup — the body's
    // shape, the league id, the caller's membership — establishes only that the check did not run, and the earlier
    // save stays outstanding.
    // A preflight that started answering 409 or 422 would silently tell somebody a save that may have committed
    // did not, so the boundary is asserted here rather than left to the order of the code
    const preflight: { body: unknown; leagueId: string; role: string | null }[] = [
      {
        body: {
          clientOperationId: 'not-a-uuid',
          expectedLeagueRevision: 1,
          submission: submission(),
        },
        leagueId: LEAGUE_ID,
        role: 'PLAYER',
      },
      {
        body,
        leagueId: '../leagues',
        role: 'PLAYER',
      },
      {
        body,
        leagueId: LEAGUE_ID,
        role: null,
      },
    ];

    for (const attempt of preflight) {
      vi.clearAllMocks();
      readViewerRoleMock.mockResolvedValue(attempt.role);
      body = attempt.body as typeof body;

      const refusal: H3Error = (await handler(buildEvent(attempt.leagueId)).catch(
        (error: H3Error): H3Error => error,
      )) as H3Error;

      expect([409, 422]).not.toContain(refusal.statusCode);
      expect(recordResultMock).not.toHaveBeenCalled();
    }
  });

  it('answers a malformed league id as the shared not-found, without a query', async (): Promise<void> => {
    await expect(handler(buildEvent('../leagues'))).rejects.toMatchObject({
      statusCode: 404,
    } satisfies Partial<H3Error>);
    expect(recordResultMock).not.toHaveBeenCalled();
  });

  it('reports a transport failure as a retryable 502 rather than a refusal', async (): Promise<void> => {
    // A write whose answer never arrived may still have committed; calling it a definite failure would tell the
    // person to record it again
    useResultTransactionMock.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 502 } satisfies Partial<H3Error>);
  });
});
