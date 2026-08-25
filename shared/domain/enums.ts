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
 * ██████████████████████████████████████████████ #shared/domain/enums.ts ██████████████████████████████████████████████
 *
 * Domain enums shared across the app: league roles and visibility, membership and game lifecycle, outcomes, and rating
 * scopes.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * An authentication provider a user account may be issued by. Google OIDC is the only one for v1
 * @public
 * @enum
 */
export enum AuthProvider {
  GOOGLE = 'GOOGLE',
}

/**
 * Whether a completed result has been accepted. A second axis entirely from game status; together they determine what
 * a game feeds
 * @public
 * @enum
 */
export enum ConfirmationStatus {
  CONFIRMED = 'CONFIRMED',

  DISPUTED = 'DISPUTED',

  UNCONFIRMED = 'UNCONFIRMED',
}

/**
 * Who may create a game in a league
 * @public
 * @enum
 */
export enum GameCreator {
  MANAGER = 'MANAGER',

  PLAYER = 'PLAYER',
}

/**
 * A game's lifecycle status. DRAFT through COMPLETE is the normal path; the rest are terminal alternatives
 * @public
 * @enum
 */
export enum GameStatus {
  /* Left in progress past a timeout with no resolution; behaves as a no contest */
  ABANDONED = 'ABANDONED',

  COMPLETE = 'COMPLETE',

  DRAFT = 'DRAFT',

  IN_PROGRESS = 'IN_PROGRESS',

  /* Stopped for reasons outside the players' control and not resumed */
  NO_CONTEST = 'NO_CONTEST',

  /* Ended by a withdrawal; the score at that moment stands */
  RETIRED = 'RETIRED',

  SCHEDULED = 'SCHEDULED',

  /* Deleted by a commissioner */
  VOID = 'VOID',

  /* Awarded because a player failed to appear within the grace period */
  WALKOVER = 'WALKOVER',
}

/**
 * Where an invitation stands
 * @public
 * @enum
 */
export enum InvitationStatus {
  ACCEPTED = 'ACCEPTED',

  DECLINED = 'DECLINED',

  EXPIRED = 'EXPIRED',

  PENDING = 'PENDING',

  REVOKED = 'REVOKED',
}

/**
 * A member's role within a league; the authoritative role-to-action mapping lives in spec V.I
 * @public
 * @enum
 */
export enum LeagueRole {
  COMMISSIONER = 'COMMISSIONER',

  MANAGER = 'MANAGER',

  PLAYER = 'PLAYER',
}

/**
 * Whether a league can be discovered and requested, or is invite only
 * @public
 * @enum
 */
export enum LeagueVisibility {
  DISCOVERABLE = 'DISCOVERABLE',

  PRIVATE = 'PRIVATE',
}

/**
 * Where a user stands in a league. Historical results are retained in every state; only ACTIVE members appear on
 * default leaderboards and may be selected for new games
 * @public
 * @enum
 */
export enum MembershipStatus {
  ACTIVE = 'ACTIVE',

  INACTIVE = 'INACTIVE',

  INVITED = 'INVITED',

  REMOVED = 'REMOVED',
}

/**
 * How a participant finished. Cutthroat produces one winner and two non-winners, so a loss carries no implication of a
 * head-to-head defeat
 * @public
 * @enum
 */
export enum ParticipantOutcome {
  LOSS = 'LOSS',

  NO_RESULT = 'NO_RESULT',

  WIN = 'WIN',
}

/**
 * Which ladder a rating snapshot belongs to. Overall is its own ladder fed by every game type rather than a blend of
 * the others, so a player who only plays doubles still carries a meaningful overall number
 * @public
 * @enum
 */
export enum RatingScope {
  CUTTHROAT = 'CUTTHROAT',

  DOUBLES = 'DOUBLES',

  OVERALL = 'OVERALL',

  SINGLES = 'SINGLES',
}

/**
 * How a game's log came to exist. A retroactive log is synthetic: sufficient to reconstruct the final score, but
 * carrying no point-level or rally-level detail
 * @public
 * @enum
 */
export enum RecordingMode {
  LIVE = 'LIVE',

  RETROACTIVE = 'RETROACTIVE',
}

/**
 * Who may record a result in a league
 * @public
 * @enum
 */
export enum ResultRecorder {
  MANAGER = 'MANAGER',

  PARTICIPANTS = 'PARTICIPANTS',
}
