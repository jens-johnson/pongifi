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

  /* The body breaks one of the form's own bounds: a score, a seat, a guest label, a note or the stated play time */
  INVALID_SUBMISSION = 'INVALID_SUBMISSION',

  /* A seat names somebody who is not an active member of this league, or an account that has been deleted */
  SEAT_NOT_A_MEMBER = 'SEAT_NOT_A_MEMBER',

  /* Somebody already answered this revision with this action */
  ALREADY_ANSWERED = 'ALREADY_ANSWERED',

  /* The league, the match or the caller's membership is not available to them */
  NOT_FOUND = 'NOT_FOUND',

  /**
   * A match already in this league that this entry looks like. Advisory rather than final: the person is shown what
   * was found and records anyway if they mean to, which is what keeps two identical honest matches in one evening
   * possible
   */
  PROBABLE_DUPLICATE = 'PROBABLE_DUPLICATE',

  /* The same operation key arrived carrying a different body */
  OPERATION_BODY_CHANGED = 'OPERATION_BODY_CHANGED',

  /* The league's configuration moved since the form was drawn */
  STALE_LEAGUE_RULES = 'STALE_LEAGUE_RULES',

  /* The result is at another revision, or in a state this action cannot apply to */
  STALE_RESULT = 'STALE_RESULT',

  /* The submission does not describe a match these rules could produce */
  UNPLAYABLE = 'UNPLAYABLE',
}
