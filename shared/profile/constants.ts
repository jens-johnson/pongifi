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
 * ███████████████████████████████████████████ #shared/profile/constants.ts ████████████████████████████████████████████
 *
 * Shared display name limits and the messages the profile and welcome forms show.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The longest display name Pongifi stores. Standings put names beside scores, so a name long enough to break that
 * layout is refused rather than truncated at render time.
 * @public
 * @constant
 */
export const DISPLAY_NAME_MAX_LENGTH: number = 80;

/**
 * The point past which the profile and welcome forms start showing a character counter. Below it the counter is noise;
 * above it the user is close enough to the limit to want the warning.
 * @public
 * @constant
 */
export const DISPLAY_NAME_COUNTER_THRESHOLD: number = 60;

/**
 * Shown when a display name is missing or is only whitespace.
 * @public
 * @constant
 */
export const DISPLAY_NAME_EMPTY_MESSAGE: string = 'The name cannot be empty';

/**
 * Shown when a display name exceeds {@link DISPLAY_NAME_MAX_LENGTH}.
 * @public
 * @constant
 */
export const DISPLAY_NAME_TOO_LONG_MESSAGE: string = 'Keep it under 80 characters';
