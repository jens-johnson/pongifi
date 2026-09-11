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
 * ██████████████████████████████████ #server/utils/invite-lookup-limit/utils.test.ts ██████████████████████████████████
 *
 * Unit tests for the invite lookup rate limit and client address key.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createHash } from 'node:crypto';

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { symbolName } from '#shared/utils/symbol';
import type { IRateLimitVerdict } from '#utils/write-boundary';

import {
  CLIENT_ADDRESS_HEADER,
  INVITE_LOOKUP_RATE_LIMIT_PREFIX,
  INVITE_LOOKUP_RATE_LIMIT_REQUESTS,
  INVITE_LOOKUP_RATE_LIMIT_TIMEOUT_REASON,
  INVITE_LOOKUP_RATE_LIMIT_UNAVAILABLE_MESSAGE,
  INVITE_LOOKUP_RATE_LIMIT_WINDOW,
  INVITE_LOOKUP_RATE_LIMITED_MESSAGE,
  INVITE_LOOKUP_RATE_LIMITED_STATUS,
  UNKNOWN_CLIENT_ADDRESS,
} from './constants';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The limiter doubles the mocked `@upstash/ratelimit` module is built from.
 * @internal
 * @interface
 */
interface IRateLimitMocks {
  /* Records the options the limiter was constructed with */
  construct: Mock<(options: unknown) => void>;

  /* Stands in for the limiter's verdict on one request */
  limit: Mock<(identifier: string) => Promise<IRateLimitVerdict>>;

  /* Stands in for the sliding-window algorithm factory */
  slidingWindow: Mock<(requests: number, window: string) => unknown>;
}

/**
 * The limiter doubles, hoisted so the module mock can consume them.
 * @internal
 * @constant
 */
const rateLimitMocks: IRateLimitMocks = vi.hoisted((): IRateLimitMocks => ({
  construct: vi.fn(),
  limit: vi.fn(),
  slidingWindow: vi.fn((): unknown => 'sliding-window'),
}));

vi.mock('@upstash/ratelimit', (): Record<string, unknown> => {
  /**
   * Stands in for the limiter the module constructs on first use, so no case reaches Redis.
   * @internal
   * @class
   */
  class RatelimitDouble {
    public static slidingWindow: IRateLimitMocks['slidingWindow'] = rateLimitMocks.slidingWindow;

    public limit: IRateLimitMocks['limit'] = rateLimitMocks.limit;

    public constructor(options: unknown) {
      rateLimitMocks.construct(options);
    }
  }

  return { Ratelimit: RatelimitDouble };
});

vi.mock('#utils/cache', (): Record<string, unknown> => ({ useCache: (): object => ({ redis: true }) }));

/**
 * The client address the platform header carries in these cases
 * @internal
 * @constant
 */
const CLIENT_ADDRESS: string = '203.0.113.4';

/**
 * The moment every case is evaluated at, so a reset timestamp is a fixed distance away
 * @internal
 * @constant
 */
const NOW: Date = new Date('2026-09-10T12:00:00.000Z');

/**
 * The checks under test, imported after the module mocks are registered.
 * @internal
 * @constant
 */
const { assertWithinInviteLookupRateLimit, readClientAddressKey }: typeof import('./utils') = await import('./utils');

/**
 * Fabricates a request carrying the given headers and socket address.
 * @internal
 * @function
 * @param headers - The request headers, lower-cased as Node delivers them
 * @param remoteAddress - The socket's peer address, when there is one
 * @returns The event and the record its response headers land in
 */
function requestWith(
  headers: Record<string, string>,
  remoteAddress?: string,
): { event: H3Event; responseHeaders: Record<string, unknown> } {
  const responseHeaders: Record<string, unknown> = {};
  const event = {
    context: {},
    node: {
      req: { headers, socket: { remoteAddress } },
      res: {
        setHeader(name: string, value: unknown): void {
          responseHeaders[name] = value;
        },
      },
    },
  } as unknown as H3Event;

  return { event, responseHeaders };
}

/**
 * Hashes an address the way the limiter keys it.
 * @internal
 * @function
 * @param address - The client address
 * @returns The expected key
 */
function keyFor(address: string): string {
  return createHash('sha256').update(address).digest('hex');
}

/**
 * Runs the check and returns the H3 error it threw.
 * @internal
 * @function
 * @param event - The request
 * @throws When the check let the request through
 * @returns The thrown error
 */
async function refusalFrom(event: H3Event): Promise<H3Error> {
  try {
    await assertWithinInviteLookupRateLimit(event);
  } catch (error: unknown) {
    return error as H3Error;
  }

  throw new Error('The check accepted a lookup it should have refused.');
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    rateLimitMocks.limit.mockReset();
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  describe(symbolName(readClientAddressKey), (): void => {
    it("charges the platform's address, first entry of the list, and never stores it unhashed", (): void => {
      const { event } = requestWith({ [CLIENT_ADDRESS_HEADER]: `${CLIENT_ADDRESS}, 10.0.0.1` });

      expect(readClientAddressKey(event)).toBe(keyFor(CLIENT_ADDRESS));
    });

    it('ignores a forwarded-for header a visitor could have written, using the socket instead', (): void => {
      const { event } = requestWith({ 'x-forwarded-for': '198.51.100.9' }, '127.0.0.1');

      expect(readClientAddressKey(event)).toBe(keyFor('127.0.0.1'));
    });

    it('charges one shared counter when no address can be found at all', (): void => {
      const { event } = requestWith({});

      expect(readClientAddressKey(event)).toBe(keyFor(UNKNOWN_CLIENT_ADDRESS));
    });
  });

  describe(symbolName(assertWithinInviteLookupRateLimit), (): void => {
    it('lets a lookup inside the allowance through, keyed by the hashed address', async (): Promise<void> => {
      const { event } = requestWith({ [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS });

      rateLimitMocks.limit.mockResolvedValue({ reset: NOW.getTime() + 60_000, success: true });

      await expect(assertWithinInviteLookupRateLimit(event)).resolves.toBeUndefined();
      expect(rateLimitMocks.limit).toHaveBeenCalledWith(keyFor(CLIENT_ADDRESS));
      expect(rateLimitMocks.construct).toHaveBeenCalledWith(
        expect.objectContaining({ prefix: INVITE_LOOKUP_RATE_LIMIT_PREFIX }),
      );
      expect(rateLimitMocks.slidingWindow).toHaveBeenCalledWith(
        INVITE_LOOKUP_RATE_LIMIT_REQUESTS,
        INVITE_LOOKUP_RATE_LIMIT_WINDOW,
      );
    });

    it('refuses a lookup over the allowance with 429 and a retry hint', async (): Promise<void> => {
      const { event, responseHeaders } = requestWith({ [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS });

      rateLimitMocks.limit.mockResolvedValue({ reset: NOW.getTime() + 20_000, success: false });

      const error: H3Error = await refusalFrom(event);

      expect(error.statusCode).toBe(INVITE_LOOKUP_RATE_LIMITED_STATUS);
      expect(error.statusMessage).toBe(INVITE_LOOKUP_RATE_LIMITED_MESSAGE);
      expect(responseHeaders['Retry-After']).toBe(20);
    });

    it('refuses the lookup when the limiter cannot be reached or answered with its own timeout', async (): Promise<void> => {
      const { event } = requestWith({ [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS });

      rateLimitMocks.limit.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await refusalFrom(event)).toMatchObject({
        statusCode: 502,
        statusMessage: INVITE_LOOKUP_RATE_LIMIT_UNAVAILABLE_MESSAGE,
      });

      rateLimitMocks.limit.mockResolvedValueOnce({
        reason: INVITE_LOOKUP_RATE_LIMIT_TIMEOUT_REASON,
        reset: 0,
        success: true,
      });
      expect(await refusalFrom(event)).toMatchObject({ statusCode: 502 });
    });
  });
});
