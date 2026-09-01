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
 * █████████████████████████████████████████████ #components/StatsBar.vue ██████████████████████████████████████████████
 *
 * Live usage figures for the landing page, counted up on load and hidden until the numbers are worth showing.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
import type { IPublicStats } from '../../server/api/stats.get';

/**
 *
 */
interface IStat {
  key: keyof Pick<IPublicStats, 'gamesRecorded' | 'leaguesActiveThisWeek' | 'minutesLogged' | 'pointsScored'>;
  label: string;
  suffix?: string;
}

/**
 *
 */
const STATS: readonly IStat[] = [
  { key: 'gamesRecorded', label: 'games recorded' },
  { key: 'pointsScored', label: 'points scored' },
  { key: 'minutesLogged', label: 'minutes at the table' },
  { key: 'leaguesActiveThisWeek', label: 'leagues active this week' },
];

/**
 * Games needed before the figures are shown at all.
 *
 * Totals are social proof, and social proof at zero argues against you. Below this the section stays hidden rather than
 * announcing that nobody has played yet.
 */
const MINIMUM_GAMES: number = 25;

/** How long the count up runs. */
const COUNT_MS: number = 1400;

/** How often the figures are refreshed once the page is open. */
const POLL_MS: number = 30000;

/**
 *
 */
const route = useRoute();

/**
 *
 */
const { data, refresh } = await useFetch<IPublicStats>('/api/stats');

/**
 *
 */
const displayed = ref<Record<string, number>>({});

/**
 *
 */
let frame: number | null = null;
/**
 *
 */
let poll: ReturnType<typeof setInterval> | null = null;

/** `?stats=preview` shows the section whatever the figures say, for reviewing the design before there is data. */
const previewing = computed<boolean>((): boolean => route.query.stats === 'preview');

/**
 *
 */
const visible = computed<boolean>((): boolean => {
  if (previewing.value) {
    return true;
  }

  return (data.value?.available ?? false) && (data.value?.gamesRecorded ?? 0) >= MINIMUM_GAMES;
});

/**
 * Abbreviates a figure once it outgrows its space.
 *
 * Points and minutes are expected to reach seven figures or more, and a run of digits that long stops being read as a
 * quantity and starts being read as a serial number.
 */
const format = (value: number): string => {
  const units: readonly { divisor: number; suffix: string }[] = [
    { divisor: 1e9, suffix: 'B' },
    { divisor: 1e6, suffix: 'M' },
    { divisor: 1e3, suffix: 'K' },
  ];

  const unit = units.find((candidate): boolean => value >= candidate.divisor * 10);

  if (unit === undefined) {
    return value.toLocaleString('en-US');
  }

  return `${(value / unit.divisor).toFixed(1).replace(/\.0$/, '')}${unit.suffix}`;
};

/**
 * Runs the count up towards the latest figures.
 *
 * Eased out rather than linear, so the number decelerates into its final value instead of stopping dead.
 */
const animate = (): void => {
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
};

onMounted((): void => {
  animate();

  poll = setInterval((): void => {
    void refresh();
  }, POLL_MS);
});

watch(data, (): void => {
  animate();
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
    class="border-border border-y px-16 py-16"
  >
    <div class="mx-auto grid max-w-[1120px] gap-10 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="stat in STATS"
        :key="stat.key"
        class="flex flex-col gap-2"
      >
        <span class="font-display text-display text-accent-strong font-medium tracking-tight tabular-nums">
          {{ format(displayed[stat.key] ?? 0) }}
        </span>

        <span class="text-ink-muted text-body-sm">{{ stat.label }}</span>
      </div>
    </div>

    <p
      v-if="previewing"
      class="text-ink-subtle text-caption mx-auto mt-8 max-w-[1120px]"
    >
      Preview mode — this section is normally hidden until there are at least {{ MINIMUM_GAMES }} recorded games.
    </p>
  </section>
</template>
