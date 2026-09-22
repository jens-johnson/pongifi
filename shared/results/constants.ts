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
 * ███████████████████████████████████████████ #shared/results/constants.ts ████████████████████████████████████████████
 *
 * The versions, bounds and seat orders a recorded result is written under.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { Seat } from './enums';

/**
 * The version the reconstruction builder writes onto every log it produces. A change to the builder's output for the
 * same submission is a new version, so a stored log is always replayable by the builder that wrote it
 * @public
 * @constant
 */
export const RECONSTRUCTION_VERSION: number = 1;

/**
 * The confirmation protocol a new revision is born under.
 *
 * Version 1 asked every registered participant but the recorder for a vote. Version 2 asks each side for one answer:
 * the recorder's own side is answered by the submission, a guests-only side is exempt, and every other side needs one
 * confirmation from the accounts frozen as eligible for it. Revisions keep the version they were born under, because
 * shrinking an old revision's outstanding requirements would rewrite what its audit says it was waiting for
 * @public
 * @constant
 */
export const CONFIRMATION_RULE_VERSION: number = 2;

/**
 * The version of the frozen administration policy's shape. Stored beside the snapshot so a later field can be added
 * without guessing what an older row meant
 * @public
 * @constant
 */
export const POLICY_SNAPSHOT_VERSION: number = 1;

/**
 * The rating this replay seeds every unseen player at, and the only seed a full replay uses; today's latest rating is
 * never a seed, because an older match inserted behind it would inherit ratings it never earned
 * @public
 * @constant
 */
export const REPLAY_SEED_GAMES_PLAYED: number = 0;

/**
 * The most game rows one result may carry: a best-of-seven played to its limit
 * @public
 * @constant
 */
export const MAX_GAME_ROWS: number = 7;

/**
 * The highest score this first form accepts. A ceiling on the form, not a rules-engine maximum: a longer game is a
 * real thing the engine can replay, and nothing here prevents a later form raising it
 * @public
 * @constant
 */
export const MAX_ENTERED_SCORE: number = 99;

/**
 * The shortest a guest's label may be once trimmed. A nameless guest is a seat nobody can read back, so an empty
 * label is refused rather than stored
 * @public
 * @constant
 */
export const MIN_GUEST_NAME_LENGTH: number = 1;

/**
 * The longest a guest's label may be
 * @public
 * @constant
 */
export const MAX_GUEST_NAME_LENGTH: number = 40;

/**
 * The longest a dispute note may be
 * @public
 * @constant
 */
export const MAX_NOTE_LENGTH: number = 280;

/**
 * How close in time two results have to be before one is offered as a probable duplicate of the other, in minutes
 * @public
 * @constant
 */
export const DUPLICATE_WINDOW_MINUTES: number = 30;

/**
 * The seats singles fills, in the canonical interleaved service order the reconstruction is built on
 * @public
 * @constant
 */
export const SINGLES_SEATS: readonly Seat[] = [Seat.A1, Seat.B1];

/**
 * The seats doubles fills. The interleave is what makes the engine read even indices as side A
 * @public
 * @constant
 */
export const DOUBLES_SEATS: readonly Seat[] = [Seat.A1, Seat.B1, Seat.A2, Seat.B2];

/**
 * What a surface shows in place of a note whose author or subject has deleted their account
 * @public
 * @constant
 */
export const REDACTED_NOTE_TEXT: string = 'Note removed';

/**
 * What a page shows in place of somebody whose account has been deleted.
 *
 * One string, used by every surface that would have named them — the heading, the participants table, the history
 * and the dispute line — because a deletion that reached some of them and not others would be a worse promise than
 * none at all (VI.IV)
 * @public
 * @constant
 */
export const DELETED_ACCOUNT_NAME: string = 'Deleted account';

/**
 * What a play time outside the league's entry window says.
 *
 * Shared between the form and the record route so one rule is stated in one sentence. The window is given in hours
 * rather than as two instants, because the person is deciding whether the match they are thinking of is still
 * enterable, not reading a range
 * @public
 * @function
 * @param windowHours - The league's entry window, in hours
 * @returns The sentence
 */
export function RECORDED_PLAYED_AT_MESSAGE(windowHours: number): string {
  return `Results can be recorded up to ${windowHours} hours after they were played.`;
}

/**
 * What a corrected play time outside the frozen window says.
 *
 * Shared between the form and the amend route so one rule is stated in one sentence: the correction's bound is not
 * the entry bound at all, because it runs from the play time the first revision stated — back by the window the
 * match was recorded under, and forward only as far as now. Saying "recorded up to n hours after they were played"
 * on a correction names a rule this write does not apply
 * @public
 * @function
 * @param windowHours - The frozen amendment window, in hours
 * @returns The sentence
 */
export function AMENDED_PLAYED_AT_MESSAGE(windowHours: number): string {
  return `A corrected play time must be within ${windowHours} hours of the time first recorded, and not in the future.`;
}
