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
 * ████████████████████████████████████ #server/utils/invite-lookup-limit/utils.ts █████████████████████████████████████
 *
 * The per-address rate limit every public invite lookup passes through.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createHash } from 'node:crypto';

import type { Ratelimit as TRatelimit } from '@upstash/ratelimit';
import { Ratelimit } from '@upstash/ratelimit';
import { createError, getRequestHeader, getRequestIP, type H3Event, setResponseHeader } from 'h3';

import { defineSymbol } from '#shared/utils/symbol';
import { useCache } from '#utils/cache';
import { runUpstream } from '#utils/http';
import type { IRateLimitVerdict } from '#utils/write-boundary';
import { MILLISECONDS_PER_SECOND } from '#utils/write-boundary';

import {
  CLIENT_ADDRESS_HEADER,
  INVITE_LOOKUP_RATE_LIMIT_PREFIX,
  INVITE_LOOKUP_RATE_LIMIT_REQUESTS,
  INVITE_LOOKUP_RATE_LIMIT_TIMEOUT,
  INVITE_LOOKUP_RATE_LIMIT_TIMEOUT_REASON,
  INVITE_LOOKUP_RATE_LIMIT_UNAVAILABLE_MESSAGE,
  INVITE_LOOKUP_RATE_LIMIT_WINDOW,
  INVITE_LOOKUP_RATE_LIMITED_MESSAGE,
  INVITE_LOOKUP_RATE_LIMITED_STATUS,
  UNKNOWN_CLIENT_ADDRESS,
} from './constants';

/**
 * The memoized limiter; built once per function instance, like the cache client it sits on
 * @internal
 */
let limiter: TRatelimit | undefined;

/**
 * Returns the limiter, building it on first use.
 * @internal
 * @function
 * @returns The sliding-window limiter for invite lookups
 */
function useInviteLookupRateLimiter(): TRatelimit {
  limiter ??= new Ratelimit({
    limiter: Ratelimit.slidingWindow(INVITE_LOOKUP_RATE_LIMIT_REQUESTS, INVITE_LOOKUP_RATE_LIMIT_WINDOW),
    prefix: INVITE_LOOKUP_RATE_LIMIT_PREFIX,
    redis: useCache(),
    timeout: INVITE_LOOKUP_RATE_LIMIT_TIMEOUT,
  });

  return limiter;
}

/**
 * Asks the limiter about one lookup, rejecting the allowance `@upstash/ratelimit` invents when its timeout fires.
 *
 * Async so a cache client that throws while being built is inside the returned promise, where the upstream guard
 * translates it
 * @internal
 * @function
 * @param identifier - The hashed client address
 * @throws When the limiter did not answer inside {@link INVITE_LOOKUP_RATE_LIMIT_TIMEOUT}
 * @returns The limiter's verdict
 */
async function checkInviteLookupRateLimit(identifier: string): Promise<IRateLimitVerdict> {
  const verdict: IRateLimitVerdict = await useInviteLookupRateLimiter().limit(identifier);

  if (verdict.reason === INVITE_LOOKUP_RATE_LIMIT_TIMEOUT_REASON) {
    throw new Error(`The invite lookup rate limiter did not answer within ${INVITE_LOOKUP_RATE_LIMIT_TIMEOUT}ms.`);
  }

  return verdict;
}

/**
 * Reads the address a lookup is charged to, hashed so no address is written to Redis.
 *
 * On Vercel the platform's own header is the source. Elsewhere, which means local development, the socket address is
 * used; a forwarded header is never trusted there, because anyone can send one
 * @public
 * @function
 * @param event - The request being handled
 * @returns A SHA-256 hex digest of the client address
 */
export function readClientAddressKey(event: H3Event): string {
  // The platform header can carry a list; the first entry is the client
  const platform: string | undefined = getRequestHeader(event, CLIENT_ADDRESS_HEADER)?.split(',')[0]?.trim();
  const address: string = platform || getRequestIP(event) || UNKNOWN_CLIENT_ADDRESS;

  return createHash('sha256').update(address).digest('hex');
}

/**
 * Refuses an invite lookup once a client address has spent its allowance for the window.
 *
 * Every lookup counts, whether the token turns out to be valid or not, and the check runs before the database is
 * touched. An unreachable limiter refuses the lookup
 * @public
 * @function
 * @param event - The request being handled
 * @throws 429 when the address is over the limit, or 502 when the limiter cannot be reached, answered in time, or
 * configured
 */
export async function assertWithinInviteLookupRateLimit(event: H3Event): Promise<void> {
  const verdict: IRateLimitVerdict = await runUpstream(
    checkInviteLookupRateLimit(readClientAddressKey(event)),
    INVITE_LOOKUP_RATE_LIMIT_UNAVAILABLE_MESSAGE,
  );

  if (verdict.success) {
    return;
  }

  // Seconds until the window rolls, floored at one so a caller told to retry never reads it as "retry immediately"
  const seconds: number = Math.max(1, Math.ceil((verdict.reset - Date.now()) / MILLISECONDS_PER_SECOND));

  setResponseHeader(event, 'Retry-After', seconds);

  throw createError({
    statusCode: INVITE_LOOKUP_RATE_LIMITED_STATUS,
    statusMessage: INVITE_LOOKUP_RATE_LIMITED_MESSAGE,
  });
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suites can title their describe blocks from the source symbols
defineSymbol(readClientAddressKey, {
  name: 'Read Client Address Key',
  description: 'Reads the hashed client address an invite lookup is charged to.',
});

defineSymbol(assertWithinInviteLookupRateLimit, {
  name: 'Assert Within Invite Lookup Rate Limit',
  description: 'Refuses an invite lookup once a client address has spent its allowance.',
});
