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
 * ██████████████████████████████████████ #server/api/leagues/index.post.test.ts ███████████████████████████████████████
 *
 * Unit tests for the create-league endpoint write boundary, validation and refusal answers.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { createError, type EventHandler, type H3Error, type H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICreateLeagueRequest, ICreateLeagueResponse } from '#shared/leagues';
import { LEAGUE_BODY_REJECTED_STATUS, LEAGUE_NAME_EMPTY_MESSAGE, LEAGUE_VALUE_REJECTED_STATUS } from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
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
  createLeague: Mock<
    (userId: string, request: ICreateLeagueRequest) => Promise<TLeagueOperationResult<ICreateLeagueResponse>>
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
  createLeague: vi.fn(),
}));

vi.mock('#utils/write-boundary', (): Record<string, unknown> => ({
  assertSameOrigin: mocks.assertSameOrigin,
  assertWithinWriteRateLimit: mocks.assertWithinWriteRateLimit,
}));

vi.mock(
  '#utils/leagues',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    createLeague: mocks.createLeague,
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
 * A minimal event; every boundary the handler crosses is a double
 * @internal
 * @constant
 */
const EVENT: H3Event = { context: {}, node: { res: {} } } as unknown as H3Event;

/**
 * A valid body
 * @internal
 * @constant
 */
const BODY: Record<string, unknown> = {
  abbreviation: 'fri',
  allowedGameTypes: [GameType.SINGLES],
  description: '',
  name: 'Friday Ladder',
  submissionId: 'a4f1c0de-0000-4000-8000-00000000abcd',
};

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
    mocks.createLeague.mockResolvedValue({ ok: true, value: { leagueId: 'league-1' } });
    readBodyMock.mockResolvedValue(BODY);
  });

  it('creates the league from the normalized request and returns its id privately', async (): Promise<void> => {
    expect(await handler(EVENT)).toEqual({ leagueId: 'league-1' });
    expect(mocks.createLeague).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ abbreviation: 'FRI' }));
    expect(setResponseHeaderMock).toHaveBeenCalledWith(EVENT, 'Cache-Control', 'private, no-store');
  });

  it('refuses a cross-origin or rate-limited request without reading the body', async (): Promise<void> => {
    mocks.assertSameOrigin.mockImplementationOnce((): never => {
      throw createError({ statusCode: 403 });
    });

    expect((await refusal()).statusCode).toBe(403);

    mocks.assertWithinWriteRateLimit.mockRejectedValueOnce(createError({ statusCode: 429 }));

    expect((await refusal()).statusCode).toBe(429);
    expect(readBodyMock).not.toHaveBeenCalled();
    expect(mocks.createLeague).not.toHaveBeenCalled();
  });

  it('refuses a malformed body and an unusable value without writing', async (): Promise<void> => {
    readBodyMock.mockResolvedValueOnce({ ...BODY, visibility: 'DISCOVERABLE' });

    expect((await refusal()).statusCode).toBe(LEAGUE_BODY_REJECTED_STATUS);

    readBodyMock.mockResolvedValueOnce({ ...BODY, name: ' ' });

    expect(await refusal()).toMatchObject({
      statusCode: LEAGUE_VALUE_REJECTED_STATUS,
      statusMessage: LEAGUE_NAME_EMPTY_MESSAGE,
    });
    expect(mocks.createLeague).not.toHaveBeenCalled();
  });

  it('answers a changed replay with a conflict and an unfinished account with a welcome refusal', async (): Promise<void> => {
    mocks.createLeague.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.CONFLICT });

    expect((await refusal()).statusCode).toBe(409);

    mocks.createLeague.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.NEEDS_WELCOME });

    expect((await refusal()).statusCode).toBe(403);
  });

  it('reports a database failure as a retryable 502', async (): Promise<void> => {
    mocks.createLeague.mockRejectedValueOnce(new Error('fetch failed'));

    expect((await refusal()).statusCode).toBe(502);
  });
});
