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
 * ███████████████████████████████ #components/widgets/results/record-form/constants.ts ████████████████████████████████
 *
 * What the Record form says about a play time it cannot take.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IResultFormContext } from '#shared/results';

/**
 * An hour, in milliseconds
 * @internal
 * @constant
 */
const HOUR_MS: number = 60 * 60 * 1000;

/**
 * What a play time outside the league's entry window says.
 *
 * The window is stated in hours rather than as two timestamps, because the person is deciding whether the match
 * they are thinking of is still enterable, not reading a range
 * @public
 * @function
 * @param context - The league's rules, which carry the window's two ends
 * @returns The message
 */
export function PLAYED_AT_MESSAGE(context: IResultFormContext): string {
  const hours: number = Math.round((Date.parse(context.now) - Date.parse(context.earliest)) / HOUR_MS);

  return `Results can be recorded up to ${hours} hours after they were played.`;
}
