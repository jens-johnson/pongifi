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
 * ████████████████████████████████████████ #server/api/me/leagues.get.test.ts █████████████████████████████████████████
 *
 * Unit tests for the league membership endpoint's account revalidation.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { EventHandler, H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LeagueRole } from '#shared/domain';
import type { ILeagueMembership } from '#shared/profile';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The profile query doubles this handler reads through.
 * @internal
 * @interface
 */
interface IProfileMocks {
  /* Stands in for the account revalidation the sealed session cannot perform itself */
  isActiveAccount: Mock<(userId: string) => Promise<boolean>>;

  /* Stands in for the membership read, the payload a refused request must never receive */
  readMemberships: Mock<(userId: string) => Promise<ILeagueMembership[]>>;
}

/**
 * The profile query doubles, hoisted so the module mock can consume them.
 * @internal
 * @constant
 */
const profileMocks: IProfileMocks = vi.hoisted((): IProfileMocks => ({
  isActiveAccount: vi.fn(),
  readMemberships: vi.fn(),
}));

vi.mock('#utils/profile', (): Record<string, unknown> => ({ ...profileMocks }));

/**
 * The session teardown a rejected read performs.
 * @internal
 * @constant
 */
const clearUserSessionMock: Mock<(event: H3Event) => Promise<void>> = vi.fn(async (): Promise<void> => {});

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
vi.stubGlobal('clearUserSession', clearUserSessionMock);
vi.stubGlobal('setResponseHeader', setResponseHeaderMock);

/**
 * The handler under test, imported after its globals and module mocks are in place.
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./leagues.get');

/**
 * A minimal event identity; every boundary the handler crosses is a double
 * @internal
 * @constant
 */
const EVENT: H3Event = {} as H3Event;

/**
 * The memberships a live account reads back
 * @internal
 * @constant
 */
const MEMBERSHIPS: ILeagueMembership[] = [
  {
    abbreviation: 'WW',
    id: 'a4f1c0de-0000-4000-8000-000000000002',
    joinedAt: '2026-02-11T09:30:00.000Z',
    name: 'Warehouse Wednesdays',
    role: LeagueRole.PLAYER,
  },
];

/**
 * Runs the handler and returns the H3 error it threw.
 * @internal
 * @function
 * @returns The thrown error
 */
async function refusal(): Promise<H3Error> {
  try {
    await handler(EVENT);
  } catch (error: unknown) {
    return error as H3Error;
  }

  throw new Error('The handler answered a request it should have refused.');
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    profileMocks.isActiveAccount.mockResolvedValue(true);
    profileMocks.readMemberships.mockResolvedValue(MEMBERSHIPS);
  });

  it('returns the memberships of a live account', async (): Promise<void> => {
    expect(await handler(EVENT)).toEqual(MEMBERSHIPS);
    expect(profileMocks.readMemberships).toHaveBeenCalledWith(USER_ID);
  });

  it('refuses a retained cookie after the account was soft-deleted', async (): Promise<void> => {
    profileMocks.isActiveAccount.mockResolvedValue(false);

    const error: H3Error = await refusal();

    expect(error.statusCode).toBe(401);
    // An empty array would have hidden a session that should not be resolving at all
    expect(profileMocks.readMemberships).not.toHaveBeenCalled();
  });

  it('ends the session it just refused, rather than leaving it to be retried', async (): Promise<void> => {
    profileMocks.isActiveAccount.mockResolvedValue(false);

    await refusal();

    expect(clearUserSessionMock).toHaveBeenCalledWith(EVENT);
  });

  it('revalidates the account the session names, not one supplied by the request', async (): Promise<void> => {
    await handler(EVENT);

    expect(profileMocks.isActiveAccount).toHaveBeenCalledWith(USER_ID);
  });

  it('marks the response private, since it names the leagues one player belongs to', async (): Promise<void> => {
    await handler(EVENT);

    expect(setResponseHeaderMock).toHaveBeenCalledWith(EVENT, 'Cache-Control', 'private, no-store');
  });

  it('surfaces an unreachable database as a gateway error rather than an empty list', async (): Promise<void> => {
    profileMocks.isActiveAccount.mockRejectedValue(new Error('ECONNREFUSED'));

    expect((await refusal()).statusCode).toBe(502);
    expect(profileMocks.readMemberships).not.toHaveBeenCalled();
  });
});
