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
 * ███████████████████████████████████████████ #components/HeroHeadline.vue ████████████████████████████████████████████
 *
 * Hero headline that rotates through a set of lines on an interval, with a slide and fade between them.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
/**
 * The rotating hero lines.
 *
 * The first is the one that matters: it renders server-side, so it is what search engines and a visitor on a slow
 * connection see. The rest are variations on the same promise rather than new claims.
 */
const HEADLINES: readonly string[] = [
  'Ping pong,\nproperly scored.',
  'Make every\ngame count.',
  'Crown the next\noffice champion.',
  'Bragging rights\nstart here.',
  'From lunch break\nto leaderboard.',
  'Winner\nstays on.',
  'Settle it\non the table.',
  'The table tennis app\nyou actually needed.',
];

/** How long each line holds before the next slides in. */
const INTERVAL_MS: number = 5000;

/**
 *
 */
const index = ref<number>(0);

/**
 *
 */
let timer: ReturnType<typeof setInterval> | null = null;

/** The line currently on screen. Indexing is always in range, so the fallback is only for the type checker. */
const current = computed<string>((): string => HEADLINES[index.value] ?? '');

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
