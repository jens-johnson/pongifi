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
 * ████████████████████████████████████ #server/utils/write-boundary/utils.test.ts █████████████████████████████████████
 *
 * Unit tests for the origin and rate-limit checks every profile write passes through.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { H3Error } from 'h3';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import {
  CROSS_ORIGIN_MESSAGE,
  CROSS_ORIGIN_REJECTED_STATUS,
  RATE_LIMIT_UNAVAILABLE_MESSAGE,
  RATE_LIMITED_MESSAGE,
  RATE_LIMITED_STATUS,
  WRITE_RATE_LIMIT_PREFIX,
  WRITE_RATE_LIMIT_REQUESTS,
  WRITE_RATE_LIMIT_WINDOW,
} from './constants';
import type { IRateLimitVerdict } from './types';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The shape of the limiter doubles the mocked `@upstash/ratelimit` module is built from.
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
 * A fabricated request, paired with the response headers the handler set on it.
 * @internal
 * @interface
 */
interface IRequestDouble {
  /* The event passed to the checks, carrying only the pieces h3's real helpers read */
  event: TEventDouble;

  /* Every response header set while handling the request, kept in the type h3 passed it as */
  responseHeaders: Record<string, unknown>;
}

/**
 * The subset of an H3 event the origin and rate-limit checks touch.
 * @internal
 */
type TEventDouble = Parameters<typeof import('./utils').assertSameOrigin>[0];

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

/**
 * The cache client the limiter is built on; the doubles never reach Redis, so an identity is enough
 * @internal
 * @constant
 */
const CACHE: object = { redis: true };

/**
 * The cache double, hoisted so one case can make it fail the way an unconfigured deployment does.
 * @internal
 * @constant
 */
const cacheMocks: { useCache: Mock<() => object> } = vi.hoisted((): { useCache: Mock<() => object> } => ({
  useCache: vi.fn((): object => CACHE),
}));

vi.mock('#utils/cache', (): Record<string, unknown> => ({ ...cacheMocks }));

/**
 * The host every accepted request in this suite arrives on
 * @internal
 * @constant
 */
const HOST: string = 'pongifi.com';

/**
 * A preview deployment's host, present so the check is proven to follow the request rather than a configured site URL
 * @internal
 * @constant
 */
const PREVIEW_HOST: string = 'pongifi-git-feat-profile-dashboard.vercel.app';

/**
 * The identifier the limiter is keyed by
 * @internal
 * @constant
 */
const USER_ID: string = 'a4f1c0de-0000-4000-8000-000000000001';

/**
 * The moment every rate-limit case is evaluated at, so a reset timestamp is a fixed distance away
 * @internal
 * @constant
 */
const NOW: Date = new Date('2026-09-09T12:00:00.000Z');

/**
 * The checks under test, imported after the module mocks are registered.
 * @internal
 * @constant
 */
const { assertSameOrigin, assertWithinWriteRateLimit }: typeof import('./utils') = await import('./utils');

/**
 * Fabricates a request carrying the given headers.
 * @internal
 * @function
 * @param headers - The request headers, lower-cased as Node delivers them
 * @returns The event and the record its response headers land in
 */
function requestWith(headers: Record<string, string>): IRequestDouble {
  const responseHeaders: Record<string, unknown> = {};

  const event = {
    node: {
      req: { headers },
      res: {
        setHeader(name: string, value: unknown): void {
          responseHeaders[name] = value;
        },
      },
    },
  } as unknown as TEventDouble;

  return { event, responseHeaders };
}

/**
 * Runs an operation and returns the H3 error it threw.
 * @internal
 * @function
 * @param operation - The check expected to refuse
 * @returns The thrown error
 */
async function refusalFrom(operation: () => unknown): Promise<H3Error> {
  try {
    await operation();
  } catch (error: unknown) {
    return error as H3Error;
  }

  throw new Error('The check accepted a request it should have refused.');
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

  describe(symbolName(assertSameOrigin), (): void => {
    it('accepts a request stating this host as its origin', (): void => {
      const { event }: IRequestDouble = requestWith({ host: HOST, origin: `https://${HOST}` });

      expect((): void => assertSameOrigin(event)).not.toThrow();
    });

    it('accepts a preview deployment, whose host is not the production one', (): void => {
      const { event }: IRequestDouble = requestWith({ host: PREVIEW_HOST, origin: `https://${PREVIEW_HOST}` });

      expect((): void => assertSameOrigin(event)).not.toThrow();
    });

    it('follows the forwarded host, which is the one the browser actually addressed', (): void => {
      const { event }: IRequestDouble = requestWith({
        host: 'internal.vercel.internal',
        origin: `https://${HOST}`,
        'x-forwarded-host': HOST,
      });

      expect((): void => assertSameOrigin(event)).not.toThrow();
    });

    it('falls back to the referrer when no origin is stated', (): void => {
      const { event }: IRequestDouble = requestWith({ host: HOST, referer: `https://${HOST}/profile` });

      expect((): void => assertSameOrigin(event)).not.toThrow();
    });

    it('refuses a request from another site', async (): Promise<void> => {
      const { event }: IRequestDouble = requestWith({ host: HOST, origin: 'https://not-pongifi.example' });

      const error: H3Error = await refusalFrom((): void => assertSameOrigin(event));

      expect(error.statusCode).toBe(CROSS_ORIGIN_REJECTED_STATUS);
      expect(error.statusMessage).toBe(CROSS_ORIGIN_MESSAGE);
    });

    it('refuses a request whose origin only starts with this host', async (): Promise<void> => {
      const { event }: IRequestDouble = requestWith({ host: HOST, origin: `https://${HOST}.attacker.example` });

      expect((await refusalFrom((): void => assertSameOrigin(event))).statusCode).toBe(CROSS_ORIGIN_REJECTED_STATUS);
    });

    it('refuses a request that states no origin at all', async (): Promise<void> => {
      const { event }: IRequestDouble = requestWith({ host: HOST });

      expect((await refusalFrom((): void => assertSameOrigin(event))).statusCode).toBe(CROSS_ORIGIN_REJECTED_STATUS);
    });

    it('refuses the null origin a sandboxed frame sends', async (): Promise<void> => {
      const { event }: IRequestDouble = requestWith({ host: HOST, origin: 'null' });

      expect((await refusalFrom((): void => assertSameOrigin(event))).statusCode).toBe(CROSS_ORIGIN_REJECTED_STATUS);
    });

    it('prefers the origin over a referrer that would have passed', async (): Promise<void> => {
      // A cross-site form post can state a same-site referrer; the origin is the header that settles it
      const { event }: IRequestDouble = requestWith({
        host: HOST,
        origin: 'https://not-pongifi.example',
        referer: `https://${HOST}/profile`,
      });

      expect((await refusalFrom((): void => assertSameOrigin(event))).statusCode).toBe(CROSS_ORIGIN_REJECTED_STATUS);
    });
  });

  describe(symbolName(assertWithinWriteRateLimit), (): void => {
    it('lets a request inside the allowance through without a retry hint', async (): Promise<void> => {
      const { event, responseHeaders }: IRequestDouble = requestWith({ host: HOST });

      rateLimitMocks.limit.mockResolvedValue({ reset: NOW.getTime() + 60_000, success: true });

      await expect(assertWithinWriteRateLimit(event, USER_ID)).resolves.toBeUndefined();
      expect(responseHeaders['Retry-After']).toBeUndefined();
    });

    it('counts against the account rather than the address', async (): Promise<void> => {
      const { event }: IRequestDouble = requestWith({ host: HOST, 'x-forwarded-for': '203.0.113.4' });

      rateLimitMocks.limit.mockResolvedValue({ reset: NOW.getTime() + 60_000, success: true });

      await assertWithinWriteRateLimit(event, USER_ID);

      expect(rateLimitMocks.limit).toHaveBeenCalledWith(USER_ID);
    });

    it('refuses a request over the allowance and says when to try again', async (): Promise<void> => {
      const { event, responseHeaders }: IRequestDouble = requestWith({ host: HOST });

      rateLimitMocks.limit.mockResolvedValue({ reset: NOW.getTime() + 30_000, success: false });

      const error: H3Error = await refusalFrom((): Promise<void> => assertWithinWriteRateLimit(event, USER_ID));

      expect(error.statusCode).toBe(RATE_LIMITED_STATUS);
      expect(error.statusMessage).toBe(RATE_LIMITED_MESSAGE);
      expect(responseHeaders['Retry-After']).toBe(30);
    });

    it('never tells a caller to retry immediately, even once the window has rolled', async (): Promise<void> => {
      const { event, responseHeaders }: IRequestDouble = requestWith({ host: HOST });

      rateLimitMocks.limit.mockResolvedValue({ reset: NOW.getTime() - 5_000, success: false });

      await refusalFrom((): Promise<void> => assertWithinWriteRateLimit(event, USER_ID));

      expect(responseHeaders['Retry-After']).toBe(1);
    });

    it('refuses the write when the limiter itself cannot be reached', async (): Promise<void> => {
      const { event }: IRequestDouble = requestWith({ host: HOST });

      rateLimitMocks.limit.mockRejectedValue(new Error('ECONNREFUSED'));

      const error: H3Error = await refusalFrom((): Promise<void> => assertWithinWriteRateLimit(event, USER_ID));

      // A limit that lapses whenever its store does is not a limit
      expect(error.statusCode).toBe(502);
      expect(error.statusMessage).toBe(RATE_LIMIT_UNAVAILABLE_MESSAGE);
    });

    it('builds one limiter for the whole instance, from the published policy', async (): Promise<void> => {
      const { event }: IRequestDouble = requestWith({ host: HOST });

      rateLimitMocks.limit.mockResolvedValue({ reset: NOW.getTime() + 60_000, success: true });

      await assertWithinWriteRateLimit(event, USER_ID);
      await assertWithinWriteRateLimit(event, USER_ID);

      expect(rateLimitMocks.construct).toHaveBeenCalledTimes(1);
      expect(rateLimitMocks.construct).toHaveBeenCalledWith(
        expect.objectContaining({ prefix: WRITE_RATE_LIMIT_PREFIX, redis: CACHE }),
      );
      expect(rateLimitMocks.slidingWindow).toHaveBeenCalledWith(WRITE_RATE_LIMIT_REQUESTS, WRITE_RATE_LIMIT_WINDOW);
    });

    it('reports a cache it could not even build as unavailable, rather than as an opaque failure', async (): Promise<void> => {
      // The client throws synchronously when its credentials are absent, before any promise exists to guard
      vi.resetModules();
      cacheMocks.useCache.mockImplementationOnce((): never => {
        throw new Error('Upstash Redis credentials are not configured.');
      });

      const fresh: typeof import('./utils') = await import('./utils');
      const { event }: IRequestDouble = requestWith({ host: HOST });

      const error: H3Error = await refusalFrom((): Promise<void> => fresh.assertWithinWriteRateLimit(event, USER_ID));

      expect(error.statusCode).toBe(502);
      expect(error.statusMessage).toBe(RATE_LIMIT_UNAVAILABLE_MESSAGE);
    });
  });
});
