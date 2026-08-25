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
 * A member's role within a league; the authoritative role-to-action mapping lives in spec V.I
 * @public
 */
export enum ELeagueRole {
  COMMISSIONER = 'COMMISSIONER',
  MANAGER = 'MANAGER',
  PLAYER = 'PLAYER',
}

/**
 * Whether a league can be discovered and requested, or is invite only
 * @public
 */
export enum ELeagueVisibility {
  PRIVATE = 'PRIVATE',
  DISCOVERABLE = 'DISCOVERABLE',
}

/**
 * Where a user stands in a league. Historical results are retained in every state; only ACTIVE members appear on
 * default leaderboards and may be selected for new games
 * @public
 */
export enum EMembershipStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  REMOVED = 'REMOVED',
}

/**
 * Where an invitation stands
 * @public
 */
export enum EInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

/**
 * A game's lifecycle status. DRAFT through COMPLETE is the normal path; the rest are terminal alternatives
 * @public
 */
export enum EGameStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETE = 'COMPLETE',
  WALKOVER = 'WALKOVER',
  RETIRED = 'RETIRED',
  NO_CONTEST = 'NO_CONTEST',
  ABANDONED = 'ABANDONED',
  VOID = 'VOID',
}

/**
 * Whether a completed result has been accepted. A second axis entirely from game status; together they determine what
 * a game feeds
 * @public
 */
export enum EConfirmationStatus {
  UNCONFIRMED = 'UNCONFIRMED',
  CONFIRMED = 'CONFIRMED',
  DISPUTED = 'DISPUTED',
}

/**
 * How a game's log came to exist. A retroactive log is synthetic: sufficient to reconstruct the final score, but
 * carrying no point-level or rally-level detail
 * @public
 */
export enum ERecordingMode {
  LIVE = 'LIVE',
  RETROACTIVE = 'RETROACTIVE',
}

/**
 * How a participant finished. Cutthroat produces one winner and two non-winners, so a loss carries no implication of a
 * head-to-head defeat
 * @public
 */
export enum EParticipantOutcome {
  WIN = 'WIN',
  LOSS = 'LOSS',
  NO_RESULT = 'NO_RESULT',
}

/**
 * Which ladder a rating snapshot belongs to. Overall is its own ladder fed by every game type rather than a blend of
 * the others, so a player who only plays doubles still carries a meaningful overall number
 * @public
 */
export enum ERatingScope {
  OVERALL = 'OVERALL',
  SINGLES = 'SINGLES',
  DOUBLES = 'DOUBLES',
  CUTTHROAT = 'CUTTHROAT',
}

/**
 * Who may create a game in a league
 * @public
 */
export enum EGameCreator {
  PLAYER = 'PLAYER',
  MANAGER = 'MANAGER',
}

/**
 * Who may record a result in a league
 * @public
 */
export enum EResultRecorder {
  PARTICIPANTS = 'PARTICIPANTS',
  MANAGER = 'MANAGER',
}

/**
 * An authentication provider a user account may be issued by. Google OIDC is the only one for v1
 * @public
 */
export enum EAuthProvider {
  GOOGLE = 'GOOGLE',
}
