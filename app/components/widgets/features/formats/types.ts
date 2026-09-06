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
 * ███████████████████████████████████ #components/widgets/features/formats/types.ts ███████████████████████████████████
 *
 * Types for the Features format explorer: a format and the compact facts shown beside it.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { TFeaturesFormat } from '../formats-diagram/types';

/**
 * One compact fact about a format, rendered in the panel's definition list
 * @public
 */
export interface IFeaturesFormatStat {
  /* What the figure describes, i.e. "Players" */
  label: string;

  /* The figure itself, i.e. "4" */
  value: string;
}

/**
 * Copy, controls and facts for one mode in the format explorer
 * @public
 */
export interface IFeaturesFormat {
  /* How the format is played, as prose */
  description: string;

  /* Icon name for the format's tab */
  icon: string;

  /* Identifier shared with the diagram, and the basis of the tab and panel element ids */
  id: TFeaturesFormat;

  /* The facts shown beside the description */
  stats: readonly IFeaturesFormatStat[];

  /* The format's display name */
  title: string;
}
