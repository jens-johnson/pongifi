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
 * ██████████████████████████████ #components/widgets/about/difference-carousel/types.ts ███████████████████████████████
 *
 * Content types for the About page difference carousel.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { TDifferenceDiagram } from '../../../data/difference-diagram/types';

/**
 * Optional inline citation attached to a difference claim.
 * @internal
 * @interface
 */
export interface IDifferenceLink {
  /* Copy rendered after the linked label */
  after: string;

  /* External destination for the citation */
  href: string;

  /* Linked citation text */
  label: string;
}

/**
 * One claim presented by the About page difference carousel.
 * @internal
 * @interface
 */
export interface IDifference {
  /* Supporting copy rendered before an optional citation */
  body: string;

  /* Illustration paired with the claim */
  diagram: TDifferenceDiagram;

  /* Optional inline citation */
  link?: IDifferenceLink;

  /* Claim heading */
  title: string;
}
