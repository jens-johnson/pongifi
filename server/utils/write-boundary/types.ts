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
 * ███████████████████████████████████████ #server/utils/write-boundary/types.ts ███████████████████████████████████████
 *
 * Types for the profile write boundary.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The part of `@upstash/ratelimit`'s verdict this module reads.
 *
 * Declared here rather than imported so the limiter's own response type, which carries analytics and pending-write
 * bookkeeping the endpoints have no use for, stays out of the handler contract.
 * @public
 * @interface
 */
export interface IRateLimitVerdict {
  /* Why the limiter answered the way it did, when it has something to say; absent on an ordinary counted verdict */
  reason?: string;

  /* When the current window rolls over, as a millisecond timestamp */
  reset: number;

  /* Whether this request is inside the allowance */
  success: boolean;
}
