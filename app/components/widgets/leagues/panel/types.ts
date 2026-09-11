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
 * ████████████████████████████████████ #components/widgets/leagues/panel/types.ts █████████████████████████████████████
 *
 * Props for the leagues panel.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Inputs for the leagues panel.
 * @public
 * @interface
 */
export interface ILeaguesPanelProps {
  /* Offer Create a league and Join with an invite in the zero state; the leagues page has its own row of them */
  showEntryActions?: boolean;

  /* Render the panel's own heading; the leagues page supplies its own H1 instead */
  showHeading?: boolean;

  /* Show the what-happens-next strip beneath the zero state, which only the dashboard does */
  showNextSteps?: boolean;
}
