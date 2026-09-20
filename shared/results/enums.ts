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
 * █████████████████████████████████████████████ #shared/results/enums.ts ██████████████████████████████████████████████
 *
 * The states, actions and refusals a recorded result moves through.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * A seat at the table, stable across every revision of a result.
 *
 * Seats are the identity the reconstruction is built on: a guest has no user id and a participant may be replaced by
 * an amendment, but the seat a score belongs to never moves. Singles fills A1 and B1; doubles fills all four
 * @public
 * @enum
 */
export enum Seat {
  A1 = 'A1',

  A2 = 'A2',

  B1 = 'B1',

  B2 = 'B2',
}

/**
 * How a match stopped. A completed match played every game out; a retired one ended when somebody withdrew, which is
 * the only way a result carries an unfinished final game (VII.IV)
 * @public
 * @enum
 */
export enum ResultEnding {
  COMPLETED = 'COMPLETED',

  RETIRED = 'RETIRED',
}

/**
 * How one side of a match came to be satisfied, recorded rather than inferred.
 *
 * Revision 2.3 of the contract asks each side for one answer instead of asking each person: the side that entered the
 * score answered by entering it, a side with nobody registered on it has nobody to ask, and every other side needs one
 * explicit confirmation from one of the accounts frozen as eligible for it. Keeping the three apart is what stops a
 * reader turning a recorder's submission or a guest side's exemption into a vote somebody cast
 * @public
 * @enum
 */
export enum SideSatisfaction {
  /* One eligible account on this side confirmed it; the row carries which account and when */
  CONFIRMATION = 'CONFIRMATION',

  /* Nobody registered plays on this side, so there is nobody to ask */
  EXEMPT = 'EXEMPT',

  /* This side still owes an answer */
  PENDING = 'PENDING',

  /* The recorder plays on this side, and entering the score is this side's answer */
  SUBMISSION = 'SUBMISSION',
}

/**
 * The reason a revision reached a settled state, recorded so an audit never has to infer it from timestamps
 * @public
 * @enum
 */
export enum ResultSettleReason {
  /* Every required answerer confirmed */
  CONFIRMED_BY_ALL = 'CONFIRMED_BY_ALL',

  /* The confirmation window passed with no dispute */
  DEADLINE_PASSED = 'DEADLINE_PASSED',

  /* Confirmation is off in this league, or nobody but the recorder was seated */
  NO_CONFIRMATION_NEEDED = 'NO_CONFIRMATION_NEEDED',

  /* A commissioner took the result out of every count and every ladder; no vote and no deadline is implied by it */
  VOIDED = 'VOIDED',
}

/**
 * A durable vote or ruling recorded against one revision
 * @public
 * @enum
 */
export enum ResultAction {
  CONFIRM = 'CONFIRM',

  DISPUTE = 'DISPUTE',

  VOID = 'VOID',
}

/**
 * A write against a result. Every one of them carries an operation identity, so a lost response can be resolved
 * rather than retried blind
 * @public
 * @enum
 */
export enum ResultOperation {
  AMEND = 'AMEND',

  CONFIRM = 'CONFIRM',

  CREATE = 'CREATE',

  DISPUTE = 'DISPUTE',

  VOID = 'VOID',
}

/**
 * Where a revision stands. Distinct from a game row's confirmation status, which is the projection this drives
 * @public
 * @enum
 */
export enum ResultState {
  CONFIRMED = 'CONFIRMED',

  DISPUTED = 'DISPUTED',

  UNCONFIRMED = 'UNCONFIRMED',

  VOID = 'VOID',
}

/**
 * The four refusals a write can meet that are not a plain validation failure. They are separate codes because a page
 * answers each of them differently: re-read the rules, re-read the result, resolve a receipt, or ask a question
 * @public
 * @enum
 */
export enum ResultConflict {
  /* A result matching this one already exists in the league inside the duplicate window */
  DUPLICATE_SUSPECTED = 'DUPLICATE_SUSPECTED',

  /* The same operation key arrived with a different body */
  OPERATION_BODY_CHANGED = 'OPERATION_BODY_CHANGED',

  /* The league's configuration moved since the form was drawn */
  STALE_LEAGUE_RULES = 'STALE_LEAGUE_RULES',

  /* The result moved to a newer revision, or a state this action cannot apply to */
  STALE_RESULT = 'STALE_RESULT',
}
