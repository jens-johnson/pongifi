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

/**
 * The only field the profile write endpoints accept in a request body.
 *
 * Written once and read by the validator, so the allowlist the request is checked against and the allowlist the
 * message names can never drift apart
 * @public
 * @constant
 */
export const PROFILE_WRITE_BODY_FIELDS: readonly string[] = ['displayName'];

/**
 * Shown when a request body is not an object at all.
 * @public
 * @constant
 */
export const PROFILE_BODY_SHAPE_MESSAGE: string = 'The request body must be an object containing displayName.';

/**
 * Shown when a request body carries a field the endpoint does not accept.
 *
 * The rejected names are deliberately absent from the message: echoing attacker-supplied keys back into a response is
 * how a reflected value ends up rendered somewhere it should not be
 * @public
 * @constant
 */
export const PROFILE_BODY_UNKNOWN_FIELD_MESSAGE: string = 'The request body may only contain displayName.';

/**
 * The status a malformed profile write body is refused with.
 *
 * Distinct from {@link DISPLAY_NAME_REJECTED_STATUS}: a body carrying fields this endpoint does not accept is a
 * malformed request, while a body of the right shape carrying an unusable name is a well-formed request that failed
 * the rule
 * @public
 * @constant
 */
export const PROFILE_BODY_REJECTED_STATUS: number = 400;

/**
 * The status an unusable display name is refused with.
 * @public
 * @constant
 */
export const DISPLAY_NAME_REJECTED_STATUS: number = 422;
