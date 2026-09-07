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
 * █████████████████████████████████ #components/widgets/features/league/constants.ts ██████████████████████████████████
 *
 * The areas a commissioner configures, in the order the section lists them.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ILeagueCapability } from './types';

/**
 * The four areas a commissioner configures, in the order the section lists them
 * @public
 * @constant
 */
export const LEAGUE_CAPABILITIES: readonly ILeagueCapability[] = [
  {
    description:
      'Which formats the league plays, points to win for each, winning margin, service interval, best-of format, expedite, and the cutthroat time cap.',
    title: 'Formats and rules',
  },
  {
    description:
      'Three roles: commissioner, manager, player. Decide whether players or managers create games and record results.',
    title: 'Who does what',
  },
  {
    description:
      'Invite by link or email, with expiry dates and use limits. Private by default; discoverable if you want people to find you.',
    title: 'Invitations and visibility',
  },
  {
    description:
      'Whether results need confirmation and how long they wait before automatic acceptance, how long they stay open for amendment, whether the league is rated, and how long a new player is provisional.',
    title: 'Results and ratings policy',
  },
];
