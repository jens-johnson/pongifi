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
 * ████████████████████████████████ #components/widgets/leagues/settings-field/types.ts ████████████████████████████████
 *
 * Inputs for one labelled control on the league settings page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Inputs for one labelled control on the league settings page.
 * @public
 * @interface
 */
export interface ILeaguesSettingsFieldProps {
  /* The caption beneath the control, or null when the label says enough */
  caption?: string | null;

  /* The control, as the editor addresses it; it becomes the element id the label points at */
  field: string;

  /* The label above the control */
  label: string;

  /* The message beneath the control, or null when the value is accepted */
  message?: string | null;
}
