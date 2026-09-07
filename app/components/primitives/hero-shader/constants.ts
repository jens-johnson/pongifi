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
 * ██████████████████████████████████ #components/primitives/hero-shader/constants.ts ██████████████████████████████████
 *
 * WebGL shaders and rendering fallbacks for the dithered hero.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { TColorChannels } from './types';

/**
 * Fragment shader that applies ordered Bayer dithering and pointer tinting to the video texture.
 * @internal
 * @constant
 */
export const FRAGMENT_SHADER: string = `#version 300 es
precision highp float;

uniform sampler2D uVideo;
uniform vec2 uResolution;
uniform vec2 uVideoSize;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec2 uPointer;
uniform float uPointerRadius;
uniform float uPitch;
uniform float uDotFill;
uniform float uBlackPoint;
uniform float uWhitePoint;
uniform float uGamma;
uniform float uCropBottom;
uniform float uInvert;

out vec4 fragColor;

const float BAYER[64] = float[64](
   0.0, 32.0,  8.0, 40.0,  2.0, 34.0, 10.0, 42.0,
  48.0, 16.0, 56.0, 24.0, 50.0, 18.0, 58.0, 26.0,
  12.0, 44.0,  4.0, 36.0, 14.0, 46.0,  6.0, 38.0,
  60.0, 28.0, 52.0, 20.0, 62.0, 30.0, 54.0, 22.0,
   3.0, 35.0, 11.0, 43.0,  1.0, 33.0,  9.0, 41.0,
  51.0, 19.0, 59.0, 27.0, 49.0, 17.0, 57.0, 25.0,
  15.0, 47.0,  7.0, 39.0, 13.0, 45.0,  5.0, 37.0,
  63.0, 31.0, 55.0, 23.0, 61.0, 29.0, 53.0, 21.0
);

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uPitch);
  vec2 cellCentre = (cell + 0.5) * uPitch;

  // contain the video within the canvas, preserving its aspect
  float canvasAspect = uResolution.x / uResolution.y;
  float videoAspect = uVideoSize.x / uVideoSize.y;
  vec2 scale = canvasAspect > videoAspect
    ? vec2(videoAspect / canvasAspect, 1.0)
    : vec2(1.0, canvasAspect / videoAspect);

  vec2 uv = (cellCentre / uResolution - 0.5) / scale + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

  // the source has a few stray specks well below the paddle; uv.y counts from the bottom,
  // so this trims the base of the frame without touching the subject
  if (uv.y < uCropBottom) discard;

  vec3 rgb = texture(uVideo, vec2(uv.x, 1.0 - uv.y)).rgb;
  float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  lum = mix(lum, 1.0 - lum, uInvert);

  // levels, not brightness/contrast: the source is a lit subject on near-black, so the useful
  // signal is a narrow band just above the floor, not a spread around mid grey
  lum = clamp((lum - uBlackPoint) / max(uWhitePoint - uBlackPoint, 0.001), 0.0, 1.0);
  lum = pow(lum, uGamma);

  int index = int(mod(cell.y, 8.0)) * 8 + int(mod(cell.x, 8.0));
  float threshold = (BAYER[index] + 0.5) / 64.0;
  if (lum < threshold) discard;

  // round dot rather than a filled cell
  float dist = length((gl_FragCoord.xy - cellCentre) / (uPitch * 0.5));
  float alpha = 1.0 - smoothstep(uDotFill - 0.15, uDotFill + 0.15, dist);
  if (alpha <= 0.001) discard;

  // the cursor tints dots towards the accent; when the pointer is away the uniform sits
  // far off-canvas, so the falloff resolves to zero without needing a second flag
  float reach = distance(cellCentre, uPointer);
  float heat = 1.0 - smoothstep(uPointerRadius * 0.35, uPointerRadius, reach);

  fragColor = vec4(mix(uInk, uAccent, heat), alpha);
}`;

/**
 * Fallback ink color matching the light theme's ink token.
 * @internal
 * @constant
 */
export const FALLBACK_INK: Readonly<TColorChannels> = [23, 28, 38];

/**
 * Vertex shader for the full-canvas triangle pair.
 * @internal
 * @constant
 */
export const VERTEX_SHADER: string = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;
