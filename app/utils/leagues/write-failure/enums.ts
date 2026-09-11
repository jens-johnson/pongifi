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
 * ███████████████████████████████████████ #utils/leagues/write-failure/enums.ts ███████████████████████████████████████
 *
 * The ways a failed league-entry write can be read.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * How a failed league-entry write should be read by the page that sent it.
 *
 * The line that matters is between a definite refusal, where the request wrote nothing, and an uncertain outcome,
 * where it may have committed and the page has to reconcile against authoritative state before offering anything
 * @public
 * @enum
 */
export enum WriteFailure {
  /* 409: another request, or an earlier attempt of this one, already changed state */
  CONFLICT = 'CONFLICT',

  /* 403: the caller lacks the role or still owes /welcome */
  FORBIDDEN = 'FORBIDDEN',

  /* 404: the league or invite is not available to this account */
  NOT_FOUND = 'NOT_FOUND',

  /* 429: too many writes; nothing was written */
  RATE_LIMITED = 'RATE_LIMITED',

  /* Any other 4xx: the request was refused and wrote nothing */
  REFUSED = 'REFUSED',

  /* 401: the session ended */
  UNAUTHORIZED = 'UNAUTHORIZED',

  /* No answer, or a 5xx: the write may have committed */
  UNCERTAIN = 'UNCERTAIN',
}
