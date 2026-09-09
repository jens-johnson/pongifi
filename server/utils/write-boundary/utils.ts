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
 * ███████████████████████████████████████ #server/utils/write-boundary/utils.ts ███████████████████████████████████████
 *
 * Origin and rate-limit checks every profile write passes through.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { Ratelimit as TRatelimit } from '@upstash/ratelimit';
import { Ratelimit } from '@upstash/ratelimit';
import { createError, getRequestHeader, getRequestHost, type H3Event, setResponseHeader } from 'h3';

import { defineSymbol } from '#shared/utils/symbol';
import { useCache } from '#utils/cache';
import { runUpstream } from '#utils/http';

import {
  CROSS_ORIGIN_MESSAGE,
  CROSS_ORIGIN_REJECTED_STATUS,
  MILLISECONDS_PER_SECOND,
  RATE_LIMIT_UNAVAILABLE_MESSAGE,
  RATE_LIMITED_MESSAGE,
  RATE_LIMITED_STATUS,
  WRITE_RATE_LIMIT_PREFIX,
  WRITE_RATE_LIMIT_REQUESTS,
  WRITE_RATE_LIMIT_WINDOW,
} from './constants';
import type { IRateLimitVerdict } from './types';

/**
 * The memoized limiter; built once per function instance rather than once per request, like the cache client it sits on
 * @internal
 */
let limiter: TRatelimit | undefined;

/**
 * Whether a stated origin or referrer names the same host the request arrived on.
 *
 * Compared against the request's own host rather than a configured site URL, because every preview deployment has a
 * different hostname and a check keyed to production would refuse every write made on one. `Origin: null`, which is
 * what a sandboxed frame sends, fails to parse and is refused with everything else that does not
 * @internal
 * @function
 * @param stated - The `Origin` or `Referer` header value
 * @param host - The host this request actually arrived on
 * @returns Whether the two name the same host
 */
function isSameHost(stated: string, host: string): boolean {
  try {
    return new URL(stated).host === host;
  } catch {
    return false;
  }
}

/**
 * Returns the limiter, building it on first use.
 * @internal
 * @function
 * @returns The sliding-window limiter shared by every write endpoint
 */
function useWriteRateLimiter(): TRatelimit {
  limiter ??= new Ratelimit({
    limiter: Ratelimit.slidingWindow(WRITE_RATE_LIMIT_REQUESTS, WRITE_RATE_LIMIT_WINDOW),
    prefix: WRITE_RATE_LIMIT_PREFIX,
    redis: useCache(),
  });

  return limiter;
}

/**
 * Asks the limiter about one request, building it if this is the first.
 *
 * Async so that building the limiter is inside the returned promise rather than before it: the cache client throws
 * synchronously when its credentials are absent, and a throw raised while assembling an argument never reaches the
 * guard that argument is being passed to. Unwrapped, a deployment missing its Redis configuration answered a write
 * with an opaque 500 instead of the message this module publishes
 * @internal
 * @function
 * @param userId - The identifier taken from the verified session, never from the request
 * @returns The limiter's verdict on this request
 */
async function checkWriteRateLimit(userId: string): Promise<IRateLimitVerdict> {
  return useWriteRateLimiter().limit(userId);
}

/**
 * Refuses a state-changing request that did not come from this deployment.
 *
 * A sealed session cookie is sent by the browser whether or not the page that triggered the request belongs to
 * Pongifi, so the session alone does not establish that the player asked for the write. The stated origin does, and a
 * request that states nothing is refused rather than trusted: browsers attach `Origin` to every non-GET fetch, so an
 * absent one is not a browser the profile form runs in
 * @public
 * @function
 * @param event - The request being handled
 * @throws 403 when the request states no origin, or states one that is not this host
 */
export function assertSameOrigin(event: H3Event): void {
  const host: string | undefined = getRequestHost(event, { xForwardedHost: true });
  const stated: string | undefined = getRequestHeader(event, 'origin') ?? getRequestHeader(event, 'referer');

  if (!host || !stated || !isSameHost(stated, host)) {
    throw createError({ statusCode: CROSS_ORIGIN_REJECTED_STATUS, statusMessage: CROSS_ORIGIN_MESSAGE });
  }
}

/**
 * Refuses a write once an account has spent its allowance for the window.
 *
 * Counted per account rather than per address, because the address a request arrives from is shared by everyone behind
 * one office router and is not shared by one person moving between networks. An unreachable limiter refuses the write:
 * a limit that lapses whenever its store does is not one
 * @public
 * @function
 * @param event - The request being handled, for the `Retry-After` hint
 * @param userId - The identifier taken from the verified session, never from the request
 * @throws 429 when the account is over the limit, or 502 when the limiter cannot be reached or configured
 */
export async function assertWithinWriteRateLimit(event: H3Event, userId: string): Promise<void> {
  const verdict: IRateLimitVerdict = await runUpstream(checkWriteRateLimit(userId), RATE_LIMIT_UNAVAILABLE_MESSAGE);

  if (verdict.success) {
    return;
  }

  // Seconds until the window rolls, floored at one so a caller told to retry never reads it as "retry immediately"
  const seconds: number = Math.max(1, Math.ceil((verdict.reset - Date.now()) / MILLISECONDS_PER_SECOND));

  setResponseHeader(event, 'Retry-After', seconds);

  throw createError({ statusCode: RATE_LIMITED_STATUS, statusMessage: RATE_LIMITED_MESSAGE });
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suites can title their describe blocks from the source symbols
defineSymbol(assertSameOrigin, {
  name: 'Assert Same Origin',
  description: 'Refuses a state-changing request that did not come from this deployment.',
});

defineSymbol(assertWithinWriteRateLimit, {
  name: 'Assert Within Write Rate Limit',
  description: 'Refuses a write once an account has spent its allowance for the window.',
});
