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
 * ███████████████████████████████ #server/api/leagues/[leagueId]/settings.patch.test.ts ███████████████████████████████
 *
 * Unit tests for the league settings save endpoint.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { createError, type EventHandler, type H3Error, type H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import type { ILeagueConfiguration, ISaveSettingsRequest } from '#shared/leagues';
import { LEAGUE_BODY_REJECTED_STATUS, LEAGUE_VALUE_REJECTED_STATUS, SettingsSection } from '#shared/leagues';
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
  saveLeagueSettings: Mock<
    (
      leagueId: string,
      userId: string,
      request: ISaveSettingsRequest,
    ) => Promise<TLeagueOperationResult<ILeagueConfiguration>>
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
  saveLeagueSettings: vi.fn(),
}));

vi.mock('#utils/write-boundary', (): Record<string, unknown> => ({
  assertSameOrigin: mocks.assertSameOrigin,
  assertWithinWriteRateLimit: mocks.assertWithinWriteRateLimit,
}));

vi.mock(
  '#utils/leagues',
  async (importOriginal: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => ({
    ...(await importOriginal()),
    saveLeagueSettings: mocks.saveLeagueSettings,
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

/**
 * A complete Ratings save, the shortest section a case can send
 * @internal
 * @constant
 */
const RATINGS_BODY: Record<string, unknown> = {
  provisionalGames: 10,
  ratingEnabled: true,
  revision: 4,
  section: SettingsSection.RATINGS,
};

/**
 * The configuration the operation answers with unless a case refuses
 * @internal
 * @constant
 */
const SAVED: ILeagueConfiguration = {
  abbreviation: 'FRI',
  configurationRevision: 5,
  description: null,
  name: 'Friday Ladder',
  settings: STANDARD_LEAGUE_SETTINGS,
};

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
const { default: handler }: { default: EventHandler } = await import('./settings.patch');

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
    mocks.saveLeagueSettings.mockResolvedValue({ ok: true, value: SAVED });
    readBodyMock.mockResolvedValue({ ...RATINGS_BODY });
  });

  it('saves the section for the league in the path and answers with what was persisted', async (): Promise<void> => {
    expect(await handler(EVENT)).toEqual(SAVED);
    expect(mocks.saveLeagueSettings).toHaveBeenCalledWith(LEAGUE_ID, USER_ID, {
      identity: null,
      revision: 4,
      section: SettingsSection.RATINGS,
      settings: { provisionalGames: 10, ratingEnabled: true },
    });
    expect(setResponseHeaderMock).toHaveBeenCalledWith(EVENT, 'Cache-Control', 'private, no-store');
  });

  it('refuses a rate-limited request without reading the body', async (): Promise<void> => {
    mocks.assertWithinWriteRateLimit.mockRejectedValueOnce(createError({ statusCode: 429 }));

    expect((await refusal()).statusCode).toBe(429);
    expect(readBodyMock).not.toHaveBeenCalled();
  });

  it('refuses a body reaching into another section without writing', async (): Promise<void> => {
    readBodyMock.mockResolvedValueOnce({ ...RATINGS_BODY, name: 'Renamed' });

    expect((await refusal()).statusCode).toBe(LEAGUE_BODY_REJECTED_STATUS);
    expect(mocks.saveLeagueSettings).not.toHaveBeenCalled();
  });

  it('refuses a value outside its range as the field, not as a malformed body', async (): Promise<void> => {
    readBodyMock.mockResolvedValueOnce({ ...RATINGS_BODY, provisionalGames: 1001 });

    const error: H3Error = await refusal();

    expect(error.statusCode).toBe(LEAGUE_VALUE_REJECTED_STATUS);
    expect(error.statusMessage).toBe('Enter a whole number from 1 to 1,000.');
    expect(mocks.saveLeagueSettings).not.toHaveBeenCalled();
  });

  it('answers a refused role with 403 and a moved configuration with 409', async (): Promise<void> => {
    mocks.saveLeagueSettings.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.SECTION_FORBIDDEN });

    const forbidden: H3Error = await refusal();

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.statusMessage).toBe('Only a commissioner can change these.');

    mocks.saveLeagueSettings.mockResolvedValueOnce({ ok: false, refusal: LeagueRefusal.CONFIGURATION_CHANGED });

    const stale: H3Error = await refusal();

    expect(stale.statusCode).toBe(409);
    expect(stale.statusMessage).toBe('These settings changed while you were editing.');
  });

  it('answers a stale save as a 409 body carrying the current configuration, so the page need not ask again', async (): Promise<void> => {
    const current: ILeagueConfiguration = {
      ...SAVED,
      configurationRevision: 6,
      name: 'Renamed By Someone Else',
    };

    mocks.saveLeagueSettings.mockResolvedValueOnce({
      configuration: current,
      ok: false,
      refusal: LeagueRefusal.CONFIGURATION_CHANGED,
    });

    const event: H3Event = {
      context: { params: { leagueId: LEAGUE_ID } },
      node: { res: {} },
    } as unknown as H3Event;

    expect(await handler(event)).toEqual({
      ...current,
      message: 'These settings changed while you were editing.',
      statusCode: 409,
    });
    expect(event.node.res.statusCode).toBe(409);
  });

  it('refuses a Formats body still carrying a stored fault as that field, without reaching the write', async (): Promise<void> => {
    readBodyMock.mockResolvedValueOnce({
      allowedGameTypes: STANDARD_LEAGUE_SETTINGS.allowedGameTypes,
      cutthroatTimeCap: STANDARD_LEAGUE_SETTINGS.cutthroatTimeCap,
      expediteEnabled: STANDARD_LEAGUE_SETTINGS.expediteEnabled,
      matchFormat: STANDARD_LEAGUE_SETTINGS.matchFormat,
      revision: 4,
      section: SettingsSection.FORMATS,
      serviceInterval: STANDARD_LEAGUE_SETTINGS.serviceInterval,
      targetScore: STANDARD_LEAGUE_SETTINGS.targetScore,
      walkoverGracePeriod: STANDARD_LEAGUE_SETTINGS.walkoverGracePeriod,
      winningMargin: 0,
    });

    const error: H3Error = await refusal();

    // The section's own fields are where validation lives, so an uncorrected fault is refused with the field's message
    expect(error.statusCode).toBe(LEAGUE_VALUE_REJECTED_STATUS);
    expect(error.statusMessage).toBe('Enter a whole number from 1 to 21.');
    expect(mocks.saveLeagueSettings).not.toHaveBeenCalled();
  });

  it('reports a database failure as a retryable 502 rather than a refusal', async (): Promise<void> => {
    mocks.saveLeagueSettings.mockRejectedValueOnce(new Error('fetch failed'));

    expect((await refusal()).statusCode).toBe(502);
  });
});
