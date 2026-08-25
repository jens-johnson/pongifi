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
 * ████████████████████████████████████████████ #server/db/schema/enums.ts █████████████████████████████████████████████
 *
 * Postgres enum types, derived from the shared domain enums so the database and the application cannot drift apart.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { pgEnum } from 'drizzle-orm/pg-core';

import {
  EAuthProvider,
  EConfirmationStatus,
  EGameStatus,
  EInvitationStatus,
  ELeagueRole,
  ELeagueVisibility,
  EMembershipStatus,
  EParticipantOutcome,
  ERatingScope,
  ERecordingMode,
} from '#shared/domain';
import { EEventType, EGameType, ESide } from '#shared/rules-engine';

/**
 * Widens a string enum into the non-empty tuple `pgEnum` expects, so the database enum and the TypeScript enum cannot
 * drift apart
 * @internal
 * @function
 * @param source - The string enum to read values from
 * @returns The enum's values as a non-empty tuple
 */
function valuesOf<TEnum extends Record<string, string>>(source: TEnum): [string, ...string[]] {
  return Object.values(source) as [string, ...string[]];
}

/**
 * A member's role within a league
 * @public
 * @constant
 */
export const leagueRoleEnum = pgEnum('league_role', valuesOf(ELeagueRole));

/**
 * Whether a league is discoverable
 * @public
 * @constant
 */
export const leagueVisibilityEnum = pgEnum('league_visibility', valuesOf(ELeagueVisibility));

/**
 * Where a user stands in a league
 * @public
 * @constant
 */
export const membershipStatusEnum = pgEnum('membership_status', valuesOf(EMembershipStatus));

/**
 * Where an invitation stands
 * @public
 * @constant
 */
export const invitationStatusEnum = pgEnum('invitation_status', valuesOf(EInvitationStatus));

/**
 * Which of the three formats a game is
 * @public
 * @constant
 */
export const gameTypeEnum = pgEnum('game_type', valuesOf(EGameType));

/**
 * A game's lifecycle status
 * @public
 * @constant
 */
export const gameStatusEnum = pgEnum('game_status', valuesOf(EGameStatus));

/**
 * Whether a completed result has been accepted
 * @public
 * @constant
 */
export const confirmationStatusEnum = pgEnum('confirmation_status', valuesOf(EConfirmationStatus));

/**
 * How a game's log came to exist
 * @public
 * @constant
 */
export const recordingModeEnum = pgEnum('recording_mode', valuesOf(ERecordingMode));

/**
 * How a participant finished
 * @public
 * @constant
 */
export const participantOutcomeEnum = pgEnum('participant_outcome', valuesOf(EParticipantOutcome));

/**
 * Which ladder a rating snapshot belongs to
 * @public
 * @constant
 */
export const ratingScopeEnum = pgEnum('rating_scope', valuesOf(ERatingScope));

/**
 * An event's type; the same set the rules engine folds over
 * @public
 * @constant
 */
export const gameEventTypeEnum = pgEnum('game_event_type', valuesOf(EEventType));

/**
 * An authentication provider
 * @public
 * @constant
 */
export const authProviderEnum = pgEnum('auth_provider', valuesOf(EAuthProvider));

/**
 * Which side of the table a participant plays on; cutthroat has no sides
 * @public
 * @constant
 */
export const participantSideEnum = pgEnum('participant_side', valuesOf(ESide));
