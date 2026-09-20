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
 * ██████████████████████████████████████████ #server/utils/results/enums.ts ███████████████████████████████████████████
 *
 * Why a result write was refused.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Why a result write was refused.
 *
 * Separate from the four conflict codes a page reads, because a refusal is either something the person can do nothing
 * about or something a re-read resolves, and the handler needs to tell those apart before it chooses a status
 * @public
 * @enum
 */
export enum ResultRefusal {
  /* The caller may not take this action in this league, under the role they hold now */
  FORBIDDEN = 'FORBIDDEN',

  /* Somebody already answered this revision with this action */
  ALREADY_ANSWERED = 'ALREADY_ANSWERED',

  /* The league, the match or the caller's membership is not available to them */
  NOT_FOUND = 'NOT_FOUND',

  /* The same operation key arrived carrying a different body */
  OPERATION_BODY_CHANGED = 'OPERATION_BODY_CHANGED',

  /* The league's configuration moved since the form was drawn */
  STALE_LEAGUE_RULES = 'STALE_LEAGUE_RULES',

  /* The result is at another revision, or in a state this action cannot apply to */
  STALE_RESULT = 'STALE_RESULT',

  /* The submission does not describe a match these rules could produce */
  UNPLAYABLE = 'UNPLAYABLE',
}
