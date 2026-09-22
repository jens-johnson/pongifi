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
 * ████████████████████████████████████████ #utils/results/record/constants.ts █████████████████████████████████████████
 *
 * What the Record form says when it refuses something.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The most a score input accepts.
 *
 * A limit of this first form rather than a rule of the game — 100-98 is a legal game to 11 — so the message that
 * carries it says so
 * @public
 * @constant
 */
export const MAX_FORM_SCORE: number = 99;

/**
 * What a guest name may be, after trimming
 * @public
 * @constant
 */
export const MIN_GUEST_NAME: number = 1;

/**
 * The longest guest name the form takes
 * @public
 * @constant
 */
export const MAX_GUEST_NAME: number = 40;

/**
 * What the derived line says while the match is still open
 * @public
 * @constant
 */
export const UNDECIDED_LINE: string = 'Match not decided yet';

/**
 * What a seat with nobody in it says
 * @public
 * @constant
 */
export const EMPTY_SEAT_MESSAGE: string = 'Pick a member or add a guest';

/**
 * What a match of guests alone says
 * @public
 * @constant
 */
export const NO_MEMBER_MESSAGE: string = 'At least one league member must play';

/**
 * What a recorder who left themselves out says, where the league only lets participants record
 * @public
 * @constant
 */
export const RECORDER_ABSENT_MESSAGE: string = 'You must be in a game you record';

/**
 * What a score that is not a whole number in range says
 * @public
 * @constant
 */
export const SCORE_CEILING_MESSAGE: string = `Scores above ${MAX_FORM_SCORE} can't be entered here yet`;

/**
 * What an empty score says. Empty is a message rather than a zero, because a blank box is somebody who has not
 * finished typing and 0-0 is a real score a retirement can carry
 * @public
 * @constant
 */
export const SCORE_MISSING_MESSAGE: string = 'Enter a score';

/**
 * What a score that is not a whole number says
 * @public
 * @constant
 */
export const SCORE_SHAPE_MESSAGE: string = 'Scores are whole numbers';

/**
 * What a guest name outside its bounds says
 * @public
 * @constant
 */
export const GUEST_NAME_MESSAGE: string = `A guest's name is 1 to ${MAX_GUEST_NAME} characters`;
