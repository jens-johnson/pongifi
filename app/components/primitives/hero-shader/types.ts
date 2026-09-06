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
 * ████████████████████████████████████ #components/primitives/hero-shader/types.ts ████████████████████████████████████
 *
 * Props and renderer state types for the dithered hero.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Props controlling the dithered hero renderer.
 * @internal
 * @interface
 */
export interface IHeroShaderProps {
  /* Luminance at or below which the source becomes transparent */
  blackPoint?: number;

  /* Fraction of the video height removed from the bottom */
  cropBottom?: number;

  /* Dot diameter as a fraction of each dither cell */
  dotFill?: number;

  /* Midtone shaping applied after the levels stretch */
  gamma?: number;

  /* Whether dark source values render as ink */
  invert?: boolean;

  /* Dither cell pitch in CSS pixels */
  pitch?: number;

  /* Radius of the pointer highlight in CSS pixels */
  pointerRadius?: number;

  /* Public video source */
  src?: string;

  /* Luminance at or above which the source becomes solid ink */
  whitePoint?: number;
}

/**
 * Latest pointer position in viewport coordinates.
 * @internal
 * @interface
 */
export interface IHeroShaderPointer {
  /* Horizontal viewport coordinate, or null outside the window */
  x: number | null;

  /* Vertical viewport coordinate, or null outside the window */
  y: number | null;
}

/**
 * Normalized red, green, and blue color channels.
 * @internal
 */
export type TColorChannels = [number, number, number];
