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
 * ███████████████████████████████████████████ #shared/rules-engine/enums.ts ███████████████████████████████████████████
 *
 * Enums for the rules engine: game types, event types, rally outcomes, sides, and match status.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The three game types Pongifi supports
 * @public
 */
export enum EGameType {
  /* Standard 1v1 */
  SINGLES = 'SINGLES',

  /* Standard 2v2 */
  DOUBLES = 'DOUBLES',

  /* House-rules 1v1v1; server-only scoring on a fixed rotation */
  CUTTHROAT = 'CUTTHROAT',
}

/**
 * Every event that may appear in a match log
 * @public
 */
export enum EEventType {
  /* Sequence zero; establishes the rotation and starting ends */
  MATCH_INIT = 'MATCH_INIT',

  /* A completed rally, won by either the serving or the receiving side */
  RALLY = 'RALLY',

  /* A let; awards no point, does not advance the service rotation */
  LET = 'LET',

  /* A service the receiving side calls doubtful; the first is a warning, later ones are faults */
  SERVICE_DOUBT = 'SERVICE_DOUBT',

  /* A time-out taken between rallies */
  TIMEOUT = 'TIMEOUT',

  /* A towel break */
  TOWEL_BREAK = 'TOWEL_BREAK',

  /* The expedite system has been introduced; appended rather than read from a clock */
  EXPEDITE_INTRODUCED = 'EXPEDITE_INTRODUCED',

  /* A cutthroat time cap has elapsed; appended rather than read from a clock */
  TIME_CAP_REACHED = 'TIME_CAP_REACHED',

  /* A participant has withdrawn, conceding the match */
  RETIREMENT = 'RETIREMENT',
}

/**
 * Which side won a rally; the only unambiguous way to express a cutthroat outcome, where the pair side has no single
 * identifiable winner
 * @public
 */
export enum ERallyWinner {
  /* The player holding service won the rally */
  SERVING = 'SERVING',

  /* The receiving side won the rally */
  RECEIVING = 'RECEIVING',
}

/**
 * The two sides of a singles or doubles match; cutthroat has no sides
 * @public
 */
export enum ESide {
  A = 'A',
  B = 'B',
}

/**
 * How a match currently stands
 * @public
 */
export enum EMatchStatus {
  /* Play is under way */
  IN_PROGRESS = 'IN_PROGRESS',

  /* Played to a result */
  COMPLETE = 'COMPLETE',

  /* Ended early by a withdrawal */
  RETIRED = 'RETIRED',
}
