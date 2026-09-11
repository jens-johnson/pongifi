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
 * ██████████████████████████████████ #server/utils/invite-lookup-limit/constants.ts ███████████████████████████████████
 *
 * The per-address rate-limit policy for public invite lookups.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { Duration } from '@upstash/ratelimit';

/**
 * How many invite lookups one client address may make inside {@link INVITE_LOOKUP_RATE_LIMIT_WINDOW}, valid and
 * invalid tokens alike.
 *
 * An initial operational policy, sized so an office behind one address can open a link together; the token's entropy,
 * not this limit, is what makes a token unguessable
 * @public
 * @constant
 */
export const INVITE_LOOKUP_RATE_LIMIT_REQUESTS: number = 60;

/**
 * The window {@link INVITE_LOOKUP_RATE_LIMIT_REQUESTS} is counted over, in the duration form `@upstash/ratelimit`
 * parses.
 * @public
 * @constant
 */
export const INVITE_LOOKUP_RATE_LIMIT_WINDOW: Duration = '1 m';

/**
 * The Redis key prefix the lookup counters live under, apart from the account write limiter's.
 * @public
 * @constant
 */
export const INVITE_LOOKUP_RATE_LIMIT_PREFIX: string = 'pongifi:invite-lookup-rate-limit';

/**
 * How long the limiter may take to answer before its verdict is treated as unavailable, in milliseconds; the same
 * pinned value the write limiter uses.
 * @public
 * @constant
 */
export const INVITE_LOOKUP_RATE_LIMIT_TIMEOUT: number = 5000;

/**
 * The `reason` `@upstash/ratelimit` stamps on the allowance it invents when its own timeout fires.
 * @public
 * @constant
 */
export const INVITE_LOOKUP_RATE_LIMIT_TIMEOUT_REASON: string = 'timeout';

/**
 * The request header the client address is read from.
 *
 * Vercel sets it on every request, and unlike `x-forwarded-for` it cannot be replaced by a proxy placed in front of the
 * deployment, so a visitor cannot choose which counter they are charged to
 * @public
 * @constant
 * @see {@link https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for}
 */
export const CLIENT_ADDRESS_HEADER: string = 'x-vercel-forwarded-for';

/**
 * The counter a request is charged to when no address can be established at all, so an unknown address shares one
 * budget rather than escaping the limit.
 * @public
 * @constant
 */
export const UNKNOWN_CLIENT_ADDRESS: string = 'unknown';

/**
 * The status a lookup over the limit is refused with.
 * @public
 * @constant
 */
export const INVITE_LOOKUP_RATE_LIMITED_STATUS: number = 429;

/**
 * Returned when a client address has spent its lookup allowance.
 * @public
 * @constant
 */
export const INVITE_LOOKUP_RATE_LIMITED_MESSAGE: string =
  'Too many attempts from this connection. Wait a minute and open the link again.';

/**
 * Returned when the limiter itself cannot be reached; the lookup is refused rather than waved through.
 * @public
 * @constant
 */
export const INVITE_LOOKUP_RATE_LIMIT_UNAVAILABLE_MESSAGE: string = 'Pongifi could not check recent activity.';
