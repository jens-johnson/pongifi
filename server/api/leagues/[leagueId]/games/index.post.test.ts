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
import { ResultEnding, ResultState, Seat } from '#shared/results';
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
 * The duplicate read double
 * @internal
 * @constant
 */
const readDuplicateCandidatesMock: Mock<
  (...args: unknown[]) => Promise<{ canonicalMatchId: string; playedAt: string }[]>
> = vi.hoisted((): Mock<(...args: unknown[]) => Promise<{ canonicalMatchId: string; playedAt: string }[]>> => vi.fn());

/**
 * The membership check double: what role, if any, this account holds in the league
 * @internal
 * @constant
 */
const readViewerRoleMock: Mock<(...args: unknown[]) => Promise<string | null>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<string | null>> => vi.fn(),
);

/**
 * The receipt double: what this operation had already written, when it had
 * @internal
 * @constant
 */
const readOperationReceiptMock: Mock<(...args: unknown[]) => Promise<{ canonicalMatchId: string } | null>> = vi.hoisted(
  (): Mock<(...args: unknown[]) => Promise<{ canonicalMatchId: string } | null>> => vi.fn(),
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
vi.mock('#utils/results/queries', (): Record<string, unknown> => ({
  readDuplicateCandidates: readDuplicateCandidatesMock,
  readFormContext: readFormContextMock,
  readOperationReceipt: readOperationReceiptMock,
}));
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
    for (const double of [
      readDuplicateCandidatesMock,
      readFormContextMock,
      readOperationReceiptMock,
      readViewerRoleMock,
      recordResultMock,
    ]) {
      double.mockReset();
    }

    useResultTransactionMock.mockImplementation(
      async (run: (transaction: unknown) => Promise<unknown>): Promise<unknown> => run({}),
    );
    readDuplicateCandidatesMock.mockResolvedValue([]);
    readViewerRoleMock.mockResolvedValue('PLAYER');
    readOperationReceiptMock.mockResolvedValue(null);
    readFormContextMock.mockResolvedValue({ configurationRevision: 4 });
    body = {
      clientOperationId: OPERATION,
      expectedLeagueRevision: 1,
      submission: submission(),
    };
  });

  it('records the result inside one transaction and answers with what it did', async (): Promise<void> => {
    recordResultMock.mockResolvedValueOnce(RECORDED);

    const answer = (await handler(buildEvent())) as { effect: unknown; replayed: boolean };

    expect(answer.effect).toEqual(RECORDED.ok && RECORDED.value);
    expect(answer.replayed).toBe(false);
    expect(useResultTransactionMock).toHaveBeenCalledTimes(1);
    expect(recordResultMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({
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

  it('warns about a match that looks like this one, and records nothing yet', async (): Promise<void> => {
    readDuplicateCandidatesMock.mockResolvedValueOnce([
      { canonicalMatchId: EXISTING_MATCH, playedAt: CANDIDATE_PLAYED_AT },
    ]);

    const answer = (await handler(buildEvent())) as { candidates: unknown[]; refusal: string };

    expect(answer.refusal).toBe('PROBABLE_DUPLICATE');
    expect(answer.candidates).toHaveLength(1);
    expect(recordResultMock).not.toHaveBeenCalled();
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 409);
  });

  it('records it once the person has seen that candidate and pressed again', async (): Promise<void> => {
    // Two identical honest matches in one evening stay possible; the warning is answered, not enforced
    readDuplicateCandidatesMock.mockResolvedValueOnce([
      { canonicalMatchId: EXISTING_MATCH, playedAt: CANDIDATE_PLAYED_AT },
    ]);
    recordResultMock.mockResolvedValueOnce(RECORDED);
    body = { ...body, acknowledgedDuplicates: [EXISTING_MATCH] };

    await handler(buildEvent());

    expect(recordResultMock).toHaveBeenCalledTimes(1);
  });

  it('warns again when a different match appears after the acknowledgement', async (): Promise<void> => {
    readDuplicateCandidatesMock.mockResolvedValueOnce([
      { canonicalMatchId: EXISTING_MATCH, playedAt: CANDIDATE_PLAYED_AT },
      { canonicalMatchId: LEAGUE_ID, playedAt: '2026-09-20T12:20:00.000Z' },
    ]);
    body = { ...body, acknowledgedDuplicates: [EXISTING_MATCH] };

    const answer = (await handler(buildEvent())) as { candidates: { canonicalMatchId: string }[] };

    expect(answer.candidates.map((candidate): string => candidate.canonicalMatchId)).toEqual([LEAGUE_ID]);
    expect(recordResultMock).not.toHaveBeenCalled();
  });

  it('tells a non-member nothing about the league, not even that a match matches', async (): Promise<void> => {
    // The disclosure this ordering exists to prevent: a match id and a play time are private league data, and a
    // session is authentication rather than access
    readViewerRoleMock.mockResolvedValueOnce(null);
    readDuplicateCandidatesMock.mockResolvedValueOnce([
      { canonicalMatchId: EXISTING_MATCH, playedAt: CANDIDATE_PLAYED_AT },
    ]);

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 404 } satisfies Partial<H3Error>);
    expect(readDuplicateCandidatesMock).not.toHaveBeenCalled();
    expect(recordResultMock).not.toHaveBeenCalled();
  });

  it('answers a member removed since the page loaded with the same not-found', async (): Promise<void> => {
    readViewerRoleMock.mockResolvedValueOnce(null);

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 404 } satisfies Partial<H3Error>);
  });

  it('passes the asking account to the duplicate read rather than trusting a check above it', async (): Promise<void> => {
    recordResultMock.mockResolvedValueOnce(RECORDED);

    await handler(buildEvent());

    expect(readDuplicateCandidatesMock).toHaveBeenCalledWith(LEAGUE_ID, USER_ID, expect.anything());
  });

  it('replays a committed save whose response was lost, rather than warning about its own match', async (): Promise<void> => {
    // The retry now matches the match it created a moment ago. Warning here would hide the receipt the service is
    // holding for exactly this case, and tell the person their own committed result looks like a duplicate of itself
    readOperationReceiptMock.mockResolvedValueOnce({ canonicalMatchId: EXISTING_MATCH });
    readDuplicateCandidatesMock.mockResolvedValueOnce([
      { canonicalMatchId: EXISTING_MATCH, playedAt: '2026-09-20T12:00:00.000Z' },
    ]);
    recordResultMock.mockResolvedValueOnce({ ...RECORDED, replayed: true } as TResultOutcome);

    const answer = (await handler(buildEvent())) as { replayed: boolean };

    expect(answer.replayed).toBe(true);
    expect(readDuplicateCandidatesMock).not.toHaveBeenCalled();
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 200);
  });

  it('replays a committed save even when a different match has since appeared', async (): Promise<void> => {
    readOperationReceiptMock.mockResolvedValueOnce({ canonicalMatchId: EXISTING_MATCH });
    readDuplicateCandidatesMock.mockResolvedValueOnce([
      { canonicalMatchId: LEAGUE_ID, playedAt: '2026-09-20T12:05:00.000Z' },
    ]);
    recordResultMock.mockResolvedValueOnce({ ...RECORDED, replayed: true } as TResultOutcome);

    await handler(buildEvent());

    expect(recordResultMock).toHaveBeenCalledTimes(1);
    expect(readDuplicateCandidatesMock).not.toHaveBeenCalled();
  });

  it('hands a stale-rules conflict the rules that are current now', async (): Promise<void> => {
    // A name tells the page which conflict it met; it does not tell it what to draw. Without the current rules the
    // caption cannot redraw, and Save cannot be re-enabled against something the person has actually seen
    recordResultMock.mockResolvedValueOnce({
      ok: false,
      refusal: ResultRefusal.STALE_LEAGUE_RULES,
      state: null,
    } as TResultOutcome);

    const answer = (await handler(buildEvent())) as { context: { configurationRevision: number }; refusal: string };

    expect(answer.refusal).toBe(ResultRefusal.STALE_LEAGUE_RULES);
    expect(answer.context.configurationRevision).toBe(4);
  });

  it('hands a changed-body conflict the result that already exists', async (): Promise<void> => {
    readOperationReceiptMock.mockResolvedValueOnce({ canonicalMatchId: EXISTING_MATCH });
    recordResultMock.mockResolvedValueOnce({
      ok: false,
      refusal: ResultRefusal.OPERATION_BODY_CHANGED,
      state: null,
    } as TResultOutcome);

    const answer = (await handler(buildEvent())) as { existing: { canonicalMatchId: string } };

    expect(answer.existing.canonicalMatchId).toBe(EXISTING_MATCH);
  });

  it('answers a stale league revision as a conflict the page can tell from the others', async (): Promise<void> => {
    recordResultMock.mockResolvedValueOnce({
      ok: false,
      refusal: ResultRefusal.STALE_LEAGUE_RULES,
      state: null,
    } as TResultOutcome);

    const answer = (await handler(buildEvent())) as { refusal: string; statusCode: number };

    expect(answer).toMatchObject({ refusal: ResultRefusal.STALE_LEAGUE_RULES, statusCode: 409 });
  });

  it('throws a refusal that leaves the page nothing to redraw to', async (): Promise<void> => {
    recordResultMock.mockResolvedValueOnce({
      ok: false,
      refusal: ResultRefusal.FORBIDDEN,
      state: null,
    } as TResultOutcome);

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 403 } satisfies Partial<H3Error>);
  });

  it('refuses a malformed body before anything reads the league', async (): Promise<void> => {
    body = {
      clientOperationId: 'not-a-uuid',
      expectedLeagueRevision: 1,
      submission: submission(),
    };

    await expect(handler(buildEvent())).rejects.toMatchObject({ statusCode: 400 } satisfies Partial<H3Error>);
    expect(readDuplicateCandidatesMock).not.toHaveBeenCalled();
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
