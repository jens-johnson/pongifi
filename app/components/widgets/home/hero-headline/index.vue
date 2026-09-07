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
 * █████████████████████████████████ #components/widgets/home/hero-headline/index.vue ██████████████████████████████████
 *
 * Rotating landing-page headline that cycles through Pongifi play contexts.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsHomeHeroHeadline />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import { HEADLINES, INTERVAL_MS } from './constants';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Index of the hero line currently shown.
 * @internal
 * @constant
 */
const index: Ref<number> = ref(0);

/**
 * The active interval, retained so teardown can cancel it.
 * @internal
 * @constant
 */
let timer: ReturnType<typeof setInterval> | null = null;

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The hero line currently shown; the fallback satisfies indexed-access typing.
 * @internal
 * @constant
 */
const current: ComputedRef<string> = computed((): string => HEADLINES[index.value] ?? '');

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

onMounted((): void => {
  // rotating copy is motion; when it is suppressed the first line simply stays
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  timer = setInterval((): void => {
    index.value = (index.value + 1) % HEADLINES.length;
  }, INTERVAL_MS);
});

onBeforeUnmount((): void => {
  if (timer !== null) {
    clearInterval(timer);
  }
});
</script>

<template>
  <!-- aria-live is off deliberately: an h1 that re-announces itself every five seconds is hostile -->
  <span
    aria-live="off"
    class="relative block"
  >
    <Transition name="headline">
      <span
        :key="index"
        class="block whitespace-pre-line"
        >{{ current }}</span
      >
    </Transition>
  </span>
</template>

<style scoped>
.headline-enter-active,
.headline-leave-active {
  transition:
    opacity 600ms ease,
    transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.headline-enter-from {
  opacity: 0;
  transform: translateY(0.32em);
}

.headline-leave-to {
  opacity: 0;
  transform: translateY(-0.32em);
}

/* the outgoing line leaves the flow so the two cross over in place rather than stacking */
.headline-leave-active {
  position: absolute;
  inset: 0;
}
</style>
