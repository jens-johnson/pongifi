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
 * █████████████████████████████████████████ #utils/leagues/entry/constants.ts █████████████████████████████████████████
 *
 * Limits and paths for reading pasted invites and prefilling short marks.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The longest value the join field will try to read as an invite. Anything longer is refused before it is parsed.
 * @public
 * @constant
 */
export const INVITE_INPUT_MAX_LENGTH: number = 512;

/**
 * The path prefix of the invite landing, as it appears in a pasted link.
 * @public
 * @constant
 */
export const INVITE_PATH_PREFIX: string = '/invite/';

/**
 * The longest short mark the create form prefills from a name, matching the column it is stored in.
 * @public
 * @constant
 */
export const DERIVED_ABBREVIATION_MAX_LENGTH: number = 8;
