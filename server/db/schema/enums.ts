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
  AuthProvider,
  ConfirmationStatus,
  GameStatus,
  InvitationStatus,
  LeagueRole,
  LeagueVisibility,
  MembershipStatus,
  ParticipantOutcome,
  RatingScope,
  RecordingMode,
} from '#shared/domain';
import { EventType, GameType, Side } from '#shared/rules-engine';

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
 * An authentication provider
 * @public
 * @constant
 */
export const authProviderEnum = pgEnum('auth_provider', valuesOf(AuthProvider));

/**
 * Whether a completed result has been accepted
 * @public
 * @constant
 */
export const confirmationStatusEnum = pgEnum('confirmation_status', valuesOf(ConfirmationStatus));

/**
 * An event's type; the same set the rules engine folds over
 * @public
 * @constant
 */
export const gameEventTypeEnum = pgEnum('game_event_type', valuesOf(EventType));

/**
 * A game's lifecycle status
 * @public
 * @constant
 */
export const gameStatusEnum = pgEnum('game_status', valuesOf(GameStatus));

/**
 * Which of the three formats a game is
 * @public
 * @constant
 */
export const gameTypeEnum = pgEnum('game_type', valuesOf(GameType));

/**
 * Where an invitation stands
 * @public
 * @constant
 */
export const invitationStatusEnum = pgEnum('invitation_status', valuesOf(InvitationStatus));

/**
 * A member's role within a league
 * @public
 * @constant
 */
export const leagueRoleEnum = pgEnum('league_role', valuesOf(LeagueRole));

/**
 * Whether a league is discoverable
 * @public
 * @constant
 */
export const leagueVisibilityEnum = pgEnum('league_visibility', valuesOf(LeagueVisibility));

/**
 * Where a user stands in a league
 * @public
 * @constant
 */
export const membershipStatusEnum = pgEnum('membership_status', valuesOf(MembershipStatus));

/**
 * How a participant finished
 * @public
 * @constant
 */
export const participantOutcomeEnum = pgEnum('participant_outcome', valuesOf(ParticipantOutcome));

/**
 * Which side of the table a participant plays on; cutthroat has no sides
 * @public
 * @constant
 */
export const participantSideEnum = pgEnum('participant_side', valuesOf(Side));

/**
 * Which ladder a rating snapshot belongs to
 * @public
 * @constant
 */
export const ratingScopeEnum = pgEnum('rating_scope', valuesOf(RatingScope));

/**
 * How a game's log came to exist
 * @public
 * @constant
 */
export const recordingModeEnum = pgEnum('recording_mode', valuesOf(RecordingMode));
