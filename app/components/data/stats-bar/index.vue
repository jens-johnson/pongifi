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
 * ███████████████████████████████████████ #components/data/stats-bar/index.vue ████████████████████████████████████████
 *
 * Live landing-page usage figures, counted up on load and hidden until meaningful.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <DataStatsBar />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import type { IPublicStats } from '../../../../server/api/stats.get';
import { COUNT_MS, MINIMUM_GAMES, POLL_MS, STAT_UNITS, STATS } from './constants';
import type { IStatUnit } from './types';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The active route, used to expose the design preview override.
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/**
 * Public statistics and their refresh command.
 * @internal
 * @constant
 */
const { data, refresh } = await useFetch<IPublicStats>('/api/stats');

/**
 * Values currently shown while the count-up animation runs.
 * @internal
 * @constant
 */
const displayed: Ref<Record<string, number>> = ref({});

/**
 * The active animation frame, retained so teardown can cancel it.
 * @internal
 * @constant
 */
let frame: number | null = null;

/**
 * The active polling interval, retained so teardown can cancel it.
 * @internal
 * @constant
 */
let poll: ReturnType<typeof setInterval> | null = null;

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the route forces the stats bar visible for design review.
 * @internal
 * @constant
 */
const previewing: ComputedRef<boolean> = computed((): boolean => route.query.stats === 'preview');

/**
 * Whether the current figures are substantial enough to present as social proof.
 * @internal
 * @constant
 */
const visible: ComputedRef<boolean> = computed((): boolean => {
  if (previewing.value) {
    return true;
  }

  return (data.value?.available ?? false) && (data.value?.gamesRecorded ?? 0) >= MINIMUM_GAMES;
});

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Abbreviates a figure once it outgrows its space.
 *
 * Points and minutes are expected to reach seven figures or more, and a run of digits that long stops being read as a
 * quantity and starts being read as a serial number.
 * @internal
 * @function
 * @param value - Numeric statistic to abbreviate.
 * @returns The locale-formatted or abbreviated value.
 */
function formatStat(value: number): string {
  const unit: IStatUnit | undefined = STAT_UNITS.find(
    (candidate: IStatUnit): boolean => value >= candidate.divisor * 10,
  );

  if (unit === undefined) {
    return value.toLocaleString('en-US');
  }

  return `${(value / unit.divisor).toFixed(1).replace(/\.0$/, '')}${unit.suffix}`;
}

/**
 * Runs the count up towards the latest figures.
 *
 * Eased out rather than linear, so the number decelerates into its final value instead of stopping dead.
 * @internal
 * @function
 */
function animateStats(): void {
  const target: IPublicStats | null = data.value ?? null;

  if (target === null) {
    return;
  }

  const from: Record<string, number> = { ...displayed.value };
  const start: number = performance.now();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    STATS.forEach((stat): void => {
      displayed.value[stat.key] = target[stat.key];
    });

    return;
  }

  const step = (now: number): void => {
    const t: number = Math.min(1, (now - start) / COUNT_MS);
    const eased: number = 1 - Math.pow(1 - t, 3);

    STATS.forEach((stat): void => {
      const begin: number = from[stat.key] ?? 0;

      displayed.value[stat.key] = Math.round(begin + (target[stat.key] - begin) * eased);
    });

    if (t < 1) {
      frame = requestAnimationFrame(step);
    }
  };

  frame = requestAnimationFrame(step);
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

onMounted((): void => {
  animateStats();

  poll = setInterval((): void => {
    void refresh();
  }, POLL_MS);
});

watch(data, (): void => {
  animateStats();
});

onBeforeUnmount((): void => {
  if (frame !== null) {
    cancelAnimationFrame(frame);
  }

  if (poll !== null) {
    clearInterval(poll);
  }
});
</script>

<template>
  <section
    v-if="visible"
    class="border-border border-y px-6 py-12 md:px-16 md:py-16"
  >
    <div class="mx-auto grid max-w-[1120px] gap-10 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="stat in STATS"
        :key="stat.key"
        class="flex flex-col gap-2"
      >
        <span class="font-display text-display text-accent-strong font-medium tracking-tight tabular-nums">
          {{ formatStat(displayed[stat.key] ?? 0) }}
        </span>

        <span class="text-ink-muted text-body-sm">{{ stat.label }}</span>
      </div>
    </div>

    <p
      v-if="previewing"
      class="text-ink-subtle text-caption mx-auto mt-8 max-w-[1120px]"
    >
      Preview mode: this section is normally hidden until there are at least {{ MINIMUM_GAMES }} recorded games.
    </p>
  </section>
</template>
