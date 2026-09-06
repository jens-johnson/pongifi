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
 * ███████████████████████████████ #components/widgets/features/anchor-nav/constants.ts ████████████████████████████████
 *
 * The Features page sections in page order, and the band that decides which one is active.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IFeaturesSectionLink } from './types';

/**
 * The five sections, in page order. Each `id` is matched by a section on the page and a heading
 * `${id}-heading`
 * @public
 * @constant
 */
export const FEATURES_SECTIONS: readonly IFeaturesSectionLink[] = [
  { id: 'scoring', label: 'Scoring' },
  { id: 'formats', label: 'Formats' },
  { id: 'league', label: 'Your league' },
  { id: 'trust', label: 'Trust' },
  { id: 'ratings', label: 'Ratings' },
];

/**
 * The observation band, expressed as a root margin: a zero-height line across the viewport's top third. A
 * section intersects it exactly while it is the one crossing that line, which is the active-state rule in the
 * specification
 * @public
 * @constant
 */
export const TOP_THIRD_BAND: string = '-32% 0px -66% 0px';
