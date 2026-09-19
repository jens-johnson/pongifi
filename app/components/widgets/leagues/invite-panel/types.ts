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
 * █████████████████████████████████ #components/widgets/leagues/invite-panel/types.ts █████████████████████████████████
 *
 * Types for a league's invite panel.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Inputs for a league's invite panel.
 * @public
 * @interface
 */
export interface ILeaguesInvitePanelProps {
  /* The league's short mark, which names the downloaded code */
  abbreviation: string;

  /* The league whose link the panel manages */
  leagueId: string;

  /* The league's name, shown beside the code and printed under the downloaded one */
  leagueName: string;
}

/**
 * One choice in the expiry select.
 * @public
 * @interface
 */
export interface IInviteExpiryOption {
  /* The duration in days, as the endpoints accept it */
  days: number;

  /* How the choice reads */
  label: string;
}
