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
  /* When the current window rolls over, as a millisecond timestamp */
  reset: number;

  /* Whether this request is inside the allowance */
  success: boolean;
}
