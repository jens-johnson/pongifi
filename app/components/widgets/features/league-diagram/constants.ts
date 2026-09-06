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
 * █████████████████████████████ #components/widgets/features/league-diagram/constants.ts ██████████████████████████████
 *
 * The depicted league's roster and its configured settings.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ILeagueMember } from './types';

/**
 * The depicted league's roster, one commissioner and one manager among the players
 * @public
 * @constant
 */
export const LEAGUE_MEMBERS: readonly ILeagueMember[] = [
  {
    initials: 'MJ',
    name: 'Maya',
    role: 'Commissioner',
  },
  {
    initials: 'SK',
    name: 'Sam',
    role: 'Manager',
  },
  {
    initials: 'AL',
    name: 'Alex',
    role: 'Player',
  },
  {
    initials: 'RN',
    name: 'Rin',
    role: 'Player',
  },
  {
    initials: 'TK',
    name: 'Taylor',
    role: 'Player',
  },
  {
    initials: 'JO',
    name: 'Jordan',
    role: 'Player',
  },
];

/**
 * The settings panel beside the roster, as a commissioner would have configured it
 * @public
 * @constant
 */
export const LEAGUE_RULES: readonly string[] = [
  'Singles · Doubles',
  'First to 11, win by 2',
  'Best of 3',
  'Results need confirmation · 48 h',
  'Amendments · 24 h',
  'Players record their own games',
];
