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
 * ███████████████████████████████████ #components/data/difference-diagram/types.ts ████████████████████████████████████
 *
 * Variants and props for the About page difference diagram.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component and About widgets.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Illustrations available to the About page difference carousel.
 * @internal
 * @enum
 */
export enum DifferenceDiagram {
  /* Agreement flow between two players */
  AGREED = 'agreed',

  /* Rating movement after a result */
  RATINGS = 'ratings',

  /* Official rules applied to a match */
  RULES = 'rules',
}

/**
 * String values accepted by the difference diagram variant prop.
 * @internal
 */
export type TDifferenceDiagram = `${DifferenceDiagram}`;

/**
 * Props accepted by the difference diagram.
 * @internal
 * @interface
 */
export interface IDifferenceDiagramProps {
  /* Which of the three About page claims the diagram illustrates */
  variant: TDifferenceDiagram;
}
