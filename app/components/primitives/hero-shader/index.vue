<script setup lang="ts">
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
 * ███████████████████████████████████ #components/primitives/hero-shader/index.vue ████████████████████████████████████
 *
 * Dithered WebGL video backdrop for the landing-page hero.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <PrimitivesHeroShader class="absolute inset-0" />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • blackPoint
 *     - Description: luminance at or below which the source becomes transparent
 *     - Type: number
 *     - Required: false
 *     - Default: 0.13
 *   • cropBottom
 *     - Description: fraction of video height removed from the bottom
 *     - Type: number
 *     - Required: false
 *     - Default: 0.07
 *   • dotFill
 *     - Description: dot diameter as a fraction of each dither cell
 *     - Type: number
 *     - Required: false
 *     - Default: 0.82
 *   • gamma
 *     - Description: midtone shaping applied after the levels stretch
 *     - Type: number
 *     - Required: false
 *     - Default: 0.9
 *   • invert
 *     - Description: whether dark source values render as ink
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *   • pitch
 *     - Description: dither cell pitch in CSS pixels
 *     - Type: number
 *     - Required: false
 *     - Default: 6
 *   • pointerRadius
 *     - Description: radius of the pointer highlight in CSS pixels
 *     - Type: number
 *     - Required: false
 *     - Default: 150
 *   • src
 *     - Description: public video source
 *     - Type: string
 *     - Required: false
 *     - Default: "/dither/paddle.mp4"
 *   • whitePoint
 *     - Description: luminance at or above which the source becomes solid ink
 *     - Type: number
 *     - Required: false
 *     - Default: 0.4
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { TPropsWithDefaults } from '@jens-johnson/style-guide/types/vue';
import type { Ref } from 'vue';

import { FALLBACK_INK, FRAGMENT_SHADER, VERTEX_SHADER } from './constants';
import type { IHeroShaderPointer, IHeroShaderProps, TColorChannels } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Tunables. Every one of these is a shader uniform read per frame, so changing it here takes effect immediately.
 * @internal
 * @constant
 */
const props: TPropsWithDefaults<IHeroShaderProps, keyof IHeroShaderProps> = withDefaults(
  defineProps<IHeroShaderProps>(),
  {
    blackPoint: 0.13,
    cropBottom: 0.07,
    dotFill: 0.82,
    gamma: 0.9,
    invert: false,
    pitch: 6,
    pointerRadius: 150,
    src: '/dither/paddle.mp4',
    whitePoint: 0.4,
  },
);

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Canvas receiving the live WebGL render.
 * @internal
 * @constant
 */
const canvas: Ref<HTMLCanvasElement | null> = ref(null);

/**
 * Hidden source video supplying frames to the WebGL texture.
 * @internal
 * @constant
 */
const video: Ref<HTMLVideoElement | null> = ref(null);

/**
 * Whether WebGL initialization failed and the decorative canvas should stay hidden.
 * @internal
 * @constant
 */
const failed: Ref<boolean> = ref(false);

/**
 * Active WebGL context.
 * @internal
 * @constant
 */
let gl: WebGL2RenderingContext | null = null;

/**
 * Linked shader program used for each frame.
 * @internal
 * @constant
 */
let program: WebGLProgram | null = null;

/**
 * Video texture uploaded before each draw.
 * @internal
 * @constant
 */
let texture: WebGLTexture | null = null;

/**
 * Active animation frame, retained so teardown can cancel it.
 * @internal
 * @constant
 */
let frame: number | null = null;

/**
 * Theme observer used to redraw a reduced-motion still after token changes.
 * @internal
 * @constant
 */
let observer: MutationObserver | null = null;

/**
 * Latest pointer position in viewport coordinates.
 * @internal
 * @constant
 */
const pointer: IHeroShaderPointer = { x: null, y: null };

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Tracks the cursor.
 *
 * Bound to the window rather than the canvas because the hero canvas is `pointer-events-none` so it never intercepts
 * clicks on the call to action underneath it.
 * @internal
 * @function
 * @param event - Pointer position relative to the viewport.
 */
function onPointerMove(event: PointerEvent): void {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
}

/**
 * Drops the highlight when the cursor leaves the window.
 * @internal
 * @function
 */
function onPointerLeave(): void {
  pointer.x = null;
  pointer.y = null;
}

/**
 * Resolves a colour token to normalised RGB via a probe element, since the computed `color` is always `rgb(...)`
 * whatever format the token was authored in.
 * @internal
 * @function
 * @param token - CSS custom property name to resolve.
 * @returns The token's normalized RGB channels.
 */
function readColorToken(token: string): TColorChannels {
  const probe: HTMLSpanElement = document.createElement('span');

  probe.style.color = `var(${token})`;
  probe.style.display = 'none';
  document.body.appendChild(probe);

  const computed: string = getComputedStyle(probe).color;

  probe.remove();

  const channels: number[] = (computed.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const red: number = channels[0] ?? FALLBACK_INK[0];
  const green: number = channels[1] ?? FALLBACK_INK[1];
  const blue: number = channels[2] ?? FALLBACK_INK[2];

  return [red / 255, green / 255, blue / 255];
}

/**
 * Compiles one shader stage, returning null and logging the driver's message on failure.
 * @internal
 * @function
 * @param context - Active WebGL context.
 * @param type - WebGL shader-stage constant.
 * @param source - GLSL source for the stage.
 * @returns The compiled shader, or null when creation or compilation fails.
 */
function compileShader(context: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader: WebGLShader | null = context.createShader(type);

  if (shader === null) {
    return null;
  }

  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    // surfaced through `failed` so the hero degrades to empty rather than to a black box
    console.error('[HeroShader]', context.getShaderInfoLog(shader));

    return null;
  }

  return shader;
}

/**
 * Uploads the current video frame and redraws, then schedules the next frame.
 *
 * Uniforms are set every frame rather than cached, so a theme change or a prop tweak is picked up without any
 * bookkeeping; the cost is a handful of uniform writes against one full-screen quad.
 * @internal
 * @function
 */
function drawFrame(): void {
  const context: WebGL2RenderingContext | null = gl;
  const element: HTMLVideoElement | null = video.value;
  const surface: HTMLCanvasElement | null = canvas.value;

  if (context === null || element === null || surface === null || program === null) {
    return;
  }

  const ratio: number = Math.min(window.devicePixelRatio || 1, 2);
  const width: number = Math.round(surface.clientWidth * ratio);
  const height: number = Math.round(surface.clientHeight * ratio);

  if (surface.width !== width || surface.height !== height) {
    surface.width = width;
    surface.height = height;
  }

  context.viewport(0, 0, width, height);
  context.clearColor(0, 0, 0, 0);
  context.clear(context.COLOR_BUFFER_BIT);

  if (element.readyState >= element.HAVE_CURRENT_DATA) {
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, element);
  }

  const set = (name: string): WebGLUniformLocation | null => context.getUniformLocation(program!, name);

  context.uniform2f(set('uResolution'), width, height);
  context.uniform2f(set('uVideoSize'), element.videoWidth || 1, element.videoHeight || 1);
  context.uniform3fv(set('uInk'), readColorToken('--color-ink'));
  context.uniform3fv(set('uAccent'), readColorToken('--color-accent'));
  context.uniform1f(set('uPointerRadius'), props.pointerRadius * ratio);

  const rect: DOMRect = surface.getBoundingClientRect();

  // gl_FragCoord counts from the bottom, the DOM counts from the top
  context.uniform2f(
    set('uPointer'),
    pointer.x === null ? -9999 : (pointer.x - rect.left) * ratio,
    pointer.y === null ? -9999 : (rect.bottom - pointer.y) * ratio,
  );
  context.uniform1f(set('uPitch'), props.pitch * ratio);
  context.uniform1f(set('uDotFill'), props.dotFill);
  context.uniform1f(set('uBlackPoint'), props.blackPoint);
  context.uniform1f(set('uWhitePoint'), props.whitePoint);
  context.uniform1f(set('uGamma'), props.gamma);
  context.uniform1f(set('uCropBottom'), props.cropBottom);
  context.uniform1f(set('uInvert'), props.invert ? 1 : 0);

  context.drawArrays(context.TRIANGLES, 0, 6);

  frame = requestAnimationFrame(drawFrame);
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

onMounted(async (): Promise<void> => {
  const surface: HTMLCanvasElement | null = canvas.value;
  const element: HTMLVideoElement | null = video.value;

  if (surface === null || element === null) {
    return;
  }

  gl = surface.getContext('webgl2', { alpha: true, premultipliedAlpha: false });

  if (gl === null) {
    failed.value = true;

    return;
  }

  const vertex: WebGLShader | null = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment: WebGLShader | null = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  if (vertex === null || fragment === null) {
    failed.value = true;

    return;
  }

  program = gl.createProgram();

  if (program === null) {
    failed.value = true;

    return;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer: WebGLBuffer | null = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const position: number = gl.getAttribLocation(program, 'aPosition');

  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // a still frame is a complete fallback, because the dither reads the same paused
  const reduced: boolean = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduced) {
    await element.play().catch((): void => undefined);
  }

  // the ink uniform is read per frame, so the theme only needs a redraw when motion is paused
  observer = new MutationObserver((): void => {
    if (frame === null) {
      drawFrame();
    }
  });

  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);

  drawFrame();
});

onBeforeUnmount((): void => {
  if (frame !== null) {
    cancelAnimationFrame(frame);
  }

  observer?.disconnect();
  window.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerleave', onPointerLeave);
});
</script>

<template>
  <div class="relative h-full w-full">
    <video
      ref="video"
      :src="props.src"
      aria-hidden="true"
      class="pointer-events-none absolute h-px w-px opacity-0"
      loop
      muted
      playsinline
      preload="auto"
    />

    <canvas
      v-show="!failed"
      ref="canvas"
      aria-hidden="true"
      class="h-full w-full"
    />
  </div>
</template>
