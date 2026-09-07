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
 * █████████████████████████████████ #components/widgets/features/limits/constants.ts ██████████████████████████████████
 *
 * Capabilities on the roadmap beyond the first release, each with its icon.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IFeaturesComingSoonItem } from './types';

/**
 * Capabilities deliberately held beyond the first release. The trailing entry is open-ended on purpose: it signals
 * that the list is a direction rather than a commitment, so nothing here reads as a dated promise
 * @public
 * @constant
 */
export const COMING_SOON_ITEMS: readonly IFeaturesComingSoonItem[] = [
  { icon: 'lucide:shield-check', label: 'Achievements' },
  { icon: 'lucide:trophy', label: 'Global Leaderboards' },
  { icon: 'lucide:sparkles', label: '… and more' },
];
