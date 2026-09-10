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
 * █████████████████████████████████████ #server/utils/write-boundary/constants.ts █████████████████████████████████████
 *
 * The origin and rate-limit policy the profile write endpoints enforce.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { Duration } from '@upstash/ratelimit';

/* ─── Same Origin ────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The status a write arriving from somewhere other than Pongifi is refused with.
 *
 * A forbidden rather than an unauthorized: the session is valid, and telling the browser to re-authenticate would send
 * the player around a sign-in loop that cannot fix the actual problem
 * @public
 * @constant
 */
export const CROSS_ORIGIN_REJECTED_STATUS: number = 403;

/**
 * Returned when a write's stated origin is not this deployment.
 * @public
 * @constant
 */
export const CROSS_ORIGIN_MESSAGE: string = 'This request did not come from Pongifi.';

/* ─── Rate Limit ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * How many writes one account may make inside {@link WRITE_RATE_LIMIT_WINDOW}.
 *
 * Sized for a person changing their mind about a name, not for a script: renaming twice, reconsidering and renaming
 * again stays comfortably inside it, while a loop hits the wall immediately
 * @public
 * @constant
 */
export const WRITE_RATE_LIMIT_REQUESTS: number = 10;

/**
 * The window {@link WRITE_RATE_LIMIT_REQUESTS} is counted over, in the duration form `@upstash/ratelimit` parses.
 * @public
 * @constant
 */
export const WRITE_RATE_LIMIT_WINDOW: Duration = '1 m';

/**
 * The Redis key prefix the limiter's counters live under, so they are recognisable beside the cache's other keys.
 * @public
 * @constant
 */
export const WRITE_RATE_LIMIT_PREFIX: string = 'pongifi:write-rate-limit';

/**
 * How long the limiter may take to answer before its verdict is treated as unavailable, in milliseconds.
 *
 * Stated rather than inherited: `@upstash/ratelimit` applies a five-second timeout of its own by default, and pinning
 * the value here keeps the number this module reasons about from moving underneath it on a dependency bump
 * @public
 * @constant
 */
export const WRITE_RATE_LIMIT_TIMEOUT: number = 5000;

/**
 * The `reason` `@upstash/ratelimit` stamps on the verdict it invents when its own timeout fires.
 *
 * That verdict arrives as `success: true`, so it reads as an allowance rather than the failure it is. It is matched by
 * this reason and refused, because a limiter that could not be reached in time has not counted the request
 * @public
 * @constant
 */
export const WRITE_RATE_LIMIT_TIMEOUT_REASON: string = 'timeout';

/**
 * The status a write over the limit is refused with.
 * @public
 * @constant
 */
export const RATE_LIMITED_STATUS: number = 429;

/**
 * Returned when an account has spent its write allowance.
 * @public
 * @constant
 */
export const RATE_LIMITED_MESSAGE: string = 'Too many changes in a row. Try that again in a moment.';

/**
 * Returned when the limiter itself cannot be reached.
 *
 * The write is refused rather than waved through: a rate limit that disappears whenever its backing store does is not
 * a rate limit
 * @public
 * @constant
 */
export const RATE_LIMIT_UNAVAILABLE_MESSAGE: string = 'Pongifi could not check your recent activity.';

/**
 * Milliseconds per second, for turning the limiter's reset timestamp into a `Retry-After` value.
 * @internal
 * @constant
 */
export const MILLISECONDS_PER_SECOND: number = 1000;
