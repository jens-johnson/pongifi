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
 * ████████████████████████████████████████████ #components/HeroDither.vue █████████████████████████████████████████████
 *
 * Decorative dithered hero animation, recoloured at runtime so one Lottie asset serves both themes.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
import type { AnimationItem } from 'lottie-web';

/**
 * The frame held when motion is suppressed; chosen because the ball reads clearly at this point in the arc.
 */
const STILL_FRAME: number = 80;

/**
 * Playback rate. The export runs at 30fps, which reads as agitated at full speed; this stretches the ~5s loop to ~10s.
 */
const SPEED: number = 0.5;

/**
 * The token the dots are painted with. Swapping this is the whole colour decision for the hero.
 */
const DOT_TOKEN: string = '--color-ink';

/**
 * Fallback colour, matching `--color-ink` in the light theme, used only if the probe cannot resolve one.
 */
const FALLBACK_DOT: readonly [number, number, number] = [23, 28, 38];

/**
 *
 */
const container = ref<HTMLDivElement | null>(null);

/**
 *
 */
let animation: AnimationItem | null = null;
/**
 *
 */
let observer: MutationObserver | null = null;
/**
 *
 */
let pristine: string | null = null;

/**
 * Resolves the dot token to normalised RGB.
 *
 * Reads through a probe element rather than parsing the custom property directly, because the computed `color` is
 * always serialised as `rgb(...)` whatever format the token was authored in.
 */
const readDotColour = (): [number, number, number] => {
  const probe: HTMLSpanElement = document.createElement('span');

  probe.style.color = `var(${DOT_TOKEN})`;
  probe.style.display = 'none';
  document.body.appendChild(probe);

  const computed: string = getComputedStyle(probe).color;

  probe.remove();

  const channels: number[] = (computed.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const [r = FALLBACK_DOT[0], g = FALLBACK_DOT[1], b = FALLBACK_DOT[2]] = channels;

  return [r / 255, g / 255, b / 255];
};

/**
 * Rewrites every fill in a Lottie document to the given colour, in place.
 *
 * The export is a single-colour dot field, so recolouring at load time is what lets one asset serve both themes.
 */
const recolour = (node: unknown, rgb: readonly [number, number, number]): void => {
  if (Array.isArray(node)) {
    node.forEach((child: unknown): void => recolour(child, rgb));

    return;
  }

  if (node === null || typeof node !== 'object') {
    return;
  }

  const record: Record<string, unknown> = node as Record<string, unknown>;

  if (record.ty === 'fl' && record.c !== null && typeof record.c === 'object') {
    (record.c as { k: number[] }).k = [rgb[0], rgb[1], rgb[2], 1];
  }

  Object.values(record).forEach((value: unknown): void => recolour(value, rgb));
};

/**
 * Builds (or rebuilds) the animation against the current theme.
 */
const render = async (): Promise<void> => {
  if (container.value === null || pristine === null) {
    return;
  }

  const lottie = (await import('lottie-web')).default;

  animation?.destroy();

  const data: unknown = JSON.parse(pristine);

  recolour(data, readDotColour());

  // a static frame is a complete fallback here, because the resting state is already the finished design
  const reduced: boolean = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  animation = lottie.loadAnimation({
    animationData: data,
    autoplay: !reduced,
    container: container.value,
    loop: true,
    renderer: 'svg',
  });

  animation.setSpeed(SPEED);

  if (reduced) {
    animation.goToAndStop(STILL_FRAME, true);
  }
};

onMounted(async (): Promise<void> => {
  pristine = await (await fetch('/dither/hero.json')).text();

  await render();

  // the palette is swapped by an attribute, so the animation has to be rebuilt when it changes
  observer = new MutationObserver((): void => {
    void render();
  });

  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
});

onBeforeUnmount((): void => {
  observer?.disconnect();
  animation?.destroy();
});
</script>

<template>
  <div
    ref="container"
    aria-hidden="true"
    class="h-full w-full"
  />
</template>
