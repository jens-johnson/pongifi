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
 * █████████████████████████████████ #components/widgets/features/formats/constants.ts █████████████████████████████████
 *
 * The three game formats the explorer steps through, and what Pongifi tracks across all of them.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IFeaturesFormat } from './types';

/**
 * The three formats the explorer steps through, in the order the tabs present them
 * @public
 * @constant
 */
export const FEATURES_FORMATS: readonly IFeaturesFormat[] = [
  {
    description: "One against one. First to the target, win by the margin, service changing on your league's interval.",
    icon: 'lucide:user',
    id: 'singles',
    stats: [
      { label: 'Players', value: '2' },
      { label: 'Shape', value: '1 vs 1' },
      { label: 'Service', value: 'League interval' },
    ],
    title: 'Singles',
  },
  {
    description:
      'Two against two. Pongifi tracks the full service and receiving order, including the receiving pair swapping order in the deciding game.',
    icon: 'lucide:users',
    id: 'doubles',
    stats: [
      { label: 'Players', value: '4' },
      { label: 'Shape', value: '2 vs 2' },
      { label: 'Service', value: 'Fixed order' },
    ],
    title: 'Doubles',
  },
  {
    description:
      'One against two, on a fixed rotation. Only the server can score. Optional time cap: an outright leader wins when it elapses; tied leaders take service in rotation until one of them wins a rally as server. House rules, and we say so.',
    icon: 'lucide:users-round',
    id: 'cutthroat',
    stats: [
      { label: 'Players', value: '3' },
      { label: 'Shape', value: '1 vs 2' },
      { label: 'Scoring', value: 'Server only' },
    ],
    title: 'Cutthroat',
  },
];

/**
 * What Pongifi tracks across every format, listed beneath the explorer
 * @public
 * @constant
 */
export const FEATURES_RULES: readonly string[] = [
  "Service changing on the league's interval, and every point at deuce (singles and doubles).",
  'Change of ends between games, and at the midpoint of a deciding game in a best-of match.',
  'Doubles service and receiving order, including the deciding-game reversal.',
  'Cutthroat rotation, server-only scoring, and the time cap.',
  'The expedite system, when a league allows it (singles and doubles).',
  'Lets, service doubt warnings and faults, timeouts, towel breaks.',
  'Retirement, with the score at that moment standing; in cutthroat the leader at that moment wins.',
];

/**
 * Independent columns keep wrapped rules from changing the vertical rhythm beside them
 * @public
 * @constant
 */
export const FEATURES_RULE_COLUMNS: readonly (readonly string[])[] = [
  FEATURES_RULES.slice(0, 4),
  FEATURES_RULES.slice(4),
];
