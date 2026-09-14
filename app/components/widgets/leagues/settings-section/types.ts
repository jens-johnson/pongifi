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
 * ███████████████████████████████ #components/widgets/leagues/settings-section/types.ts ███████████████████████████████
 *
 * Inputs for one section of the league settings page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { SettingsSection } from '#shared/leagues';
import type { ISectionState, ISettingsRow } from '~/utils/leagues/settings';

/**
 * Inputs for one section of the league settings page.
 * @public
 * @interface
 */
export interface ILeaguesSettingsSectionProps {
  /* The configuration as it now stands, drawn beside the draft while the section is stale */
  currentRows: ISettingsRow[];

  /* Whether anything in the section differs from the values it was loaded with */
  dirty: boolean;

  /* The section's own rows, drawn instead of controls for a viewer who may not change it */
  rows: ISettingsRow[];

  /* Whether this viewer's role may save this section */
  editable: boolean;

  /* The section's heading */
  heading: string;

  /* The line a viewer with no controls here is shown */
  readOnlyCaption: string;

  /* The section being drawn */
  section: SettingsSection;

  /* Where the section stands and what it is showing */
  state: ISectionState;
}

/**
 * What one settings section asks the page to do; the page owns every write and every revision.
 * @public
 * @interface
 */
export interface ILeaguesSettingsSectionEmits {
  /* Restore the values this section was loaded with */
  cancel: [];

  /* Send the held snapshot again, at the revision it was submitted with */
  retry: [];

  /* Read the league again after a reconciliation that could not be made */
  retryCheck: [];

  /* Keep the draft, against the values now shown, at the revision they came back at */
  reviewDraft: [];

  /* Validate and send this section */
  save: [];

  /* Discard the draft and take the values now shown */
  useCurrent: [];
}
