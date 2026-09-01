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
 * ████████████████████████████████████████████ #components/HeroShader.vue █████████████████████████████████████████████
 *
 * Hero backdrop: the source video dithered live in a WebGL fragment shader, tinted from the ink token.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
interface IProps {
  /** Luminance mapped to black. Everything at or below this drops out entirely. */
  blackPoint?: number;
  /** Midtone shaping after the levels stretch. Below 1 lifts the shadows. */
  gamma?: number;
  /** Dot diameter as a fraction of the cell. 1 fills the cell completely. */
  dotFill?: number;
  /** Treat dark as ink rather than light. The source is a lit subject on black, so this is off. */
  invert?: boolean;
  /** Radius of the cursor highlight in CSS pixels. Dots inside it tint towards the accent. */
  pointerRadius?: number;
  /** Fraction of the video height ignored at the bottom, to drop artefacts below the subject. */
  cropBottom?: number;
  /** Cell pitch in CSS pixels. This is the dot resolution. */
  pitch?: number;
  /** Source video, served from public/. */
  src?: string;
  /** Luminance mapped to full ink. Everything at or above this is solid. */
  whitePoint?: number;
}

/**
 * Tunables. Every one of these is a shader uniform read per frame, so changing it here takes effect immediately.
 */
const props = withDefaults(defineProps<IProps>(), {
  blackPoint: 0.13,
  cropBottom: 0.07,
  dotFill: 0.82,
  gamma: 0.9,
  invert: false,
  pitch: 6,
  pointerRadius: 150,
  src: '/dither/paddle.mp4',
  whitePoint: 0.4,
});

/** Fallback ink, matching `--color-ink` in the light theme. */
const FALLBACK_INK: readonly [number, number, number] = [23, 28, 38];

/**
 *
 */
const VERTEX_SHADER: string = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

/**
 * Ordered (Bayer) dithering.
 *
 * Chosen over error diffusion because the threshold for a given cell is fixed, so a pixel that does not change between
 * frames does not flicker. Floyd-Steinberg boils; this does not.
 */
const FRAGMENT_SHADER: string = `#version 300 es
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
 *
 */
const canvas = ref<HTMLCanvasElement | null>(null);
/**
 *
 */
const video = ref<HTMLVideoElement | null>(null);
/**
 *
 */
const failed = ref<boolean>(false);

/**
 *
 */
let gl: WebGL2RenderingContext | null = null;
/**
 *
 */
let program: WebGLProgram | null = null;
/**
 *
 */
let texture: WebGLTexture | null = null;
/**
 *
 */
let frame: number | null = null;
/**
 *
 */
let observer: MutationObserver | null = null;

/** Latest pointer position in client coordinates; null when the cursor has left the window. */
const pointer: { x: number | null; y: number | null } = { x: null, y: null };

/**
 * Tracks the cursor.
 *
 * Bound to the window rather than the canvas because the hero canvas is `pointer-events-none` so it never intercepts
 * clicks on the call to action underneath it.
 */
const onPointerMove = (event: PointerEvent): void => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
};

/**
 * Drops the highlight when the cursor leaves the window.
 */
const onPointerLeave = (): void => {
  pointer.x = null;
  pointer.y = null;
};

/**
 * Resolves a colour token to normalised RGB via a probe element, since the computed `color` is always `rgb(...)`
 * whatever format the token was authored in.
 */
const readToken = (token: string): [number, number, number] => {
  const probe: HTMLSpanElement = document.createElement('span');

  probe.style.color = `var(${token})`;
  probe.style.display = 'none';
  document.body.appendChild(probe);

  const computed: string = getComputedStyle(probe).color;

  probe.remove();

  const channels: number[] = (computed.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const [r = FALLBACK_INK[0], g = FALLBACK_INK[1], b = FALLBACK_INK[2]] = channels;

  return [r / 255, g / 255, b / 255];
};

/**
 *
 */
/**
 * Compiles one shader stage, returning null and logging the driver's message on failure.
 */
const compile = (context: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
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
};

/**
 *
 */
/**
 * Uploads the current video frame and redraws, then schedules the next frame.
 *
 * Uniforms are set every frame rather than cached, so a theme change or a prop tweak is picked up without any
 * bookkeeping — the cost is a handful of uniform writes against one full-screen quad.
 */
const draw = (): void => {
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
  context.uniform3fv(set('uInk'), readToken('--color-ink'));
  context.uniform3fv(set('uAccent'), readToken('--color-accent'));
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

  frame = requestAnimationFrame(draw);
};

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

  const vertex: WebGLShader | null = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment: WebGLShader | null = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

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
      draw();
    }
  });

  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);

  draw();
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
