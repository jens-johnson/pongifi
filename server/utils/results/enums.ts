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

  /**
   * An entry states a play time the league's window no longer accepts, or one the database's clock has not reached.
   * Separate from the bound above because the page has a sentence that states the window in hours, and the general
   * validation message would tell somebody with a late play time that their scores were wrong
   */
  ENTRY_PLAY_TIME = 'ENTRY_PLAY_TIME',

  /**
   * A correction states a play time outside the window the match was recorded under. Separate from the entry bound
   * because the rule is a different one — measured from the play time the first revision stated rather than from
   * now — and its sentence says so
   */
  AMENDMENT_PLAY_TIME = 'AMENDMENT_PLAY_TIME',

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
