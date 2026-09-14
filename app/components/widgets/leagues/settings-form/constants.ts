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
 * ██████████████████████████████ #components/widgets/leagues/settings-form/constants.ts ███████████████████████████████
 *
 * The state a settings section starts in.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ISectionState } from '~/utils/leagues/settings';
import { SettingsSectionPhase } from '~/utils/leagues/settings';

/**
 * The state every section starts in.
 * @public
 * @function
 * @param revision - The revision the page loaded at
 * @returns A section with nothing in flight and nothing to say
 */
export function toInitialSectionState(revision: number): ISectionState {
  return {
    alert: null,
    confirmed: false,
    errors: {},
    message: null,
    phase: SettingsSectionPhase.IDLE,
    revision,
  };
}
