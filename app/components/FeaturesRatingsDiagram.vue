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
 * ██████████████████████████████████████ #components/FeaturesRatingsDiagram.vue ███████████████████████████████████████
 *
 * Qualitative leaderboard movement illustration for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
interface IPlayerRow {
  movement: 'down' | 'none' | 'up';
  name: string;
  provisional?: boolean;
  rank: number;
}

/**
 *
 */
const PLAYERS: readonly IPlayerRow[] = [
  {
    movement: 'down',
    name: 'Sam',
    rank: 1,
  },
  {
    movement: 'none',
    name: 'Rin',
    rank: 2,
  },
  {
    movement: 'up',
    name: 'Maya',
    provisional: true,
    rank: 3,
  },
  {
    movement: 'none',
    name: 'Alex',
    rank: 4,
  },
];
</script>

<template>
  <figure
    aria-describedby="ratings-diagram-description"
    aria-labelledby="ratings-diagram-label"
    class="border-border bg-surface-raised rounded-lg border p-5 sm:p-7"
  >
    <p
      id="ratings-diagram-label"
      class="sr-only"
    >
      Singles leaderboard after an upset
    </p>

    <p
      id="ratings-diagram-description"
      class="sr-only"
    >
      Maya, ranked third and still provisional, beat first-ranked Sam. Maya moves up and Sam moves down, with no
      invented numerical rating changes shown.
    </p>

    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-ink-subtle text-caption font-mono tracking-widest uppercase">Fourth Floor Open</p>

        <h3 class="font-display text-h2 mt-2 font-medium">Singles leaderboard</h3>
      </div>

      <span class="border-border bg-surface text-body-sm rounded-md border px-3 py-2">Singles</span>
    </div>

    <ol class="mt-6 space-y-2">
      <li
        v-for="player in PLAYERS"
        :key="player.name"
        class="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-3"
        :class="player.movement === 'up' ? 'bg-positive-soft' : 'bg-surface'"
      >
        <span class="text-ink-subtle text-body-sm tabular-nums">#{{ player.rank }}</span>

        <span class="min-w-0">
          <span class="text-body block truncate font-medium">{{ player.name }}</span>

          <span
            v-if="player.provisional"
            class="text-positive-soft-ink text-caption block"
          >
            Provisional
          </span>
        </span>

        <div class="flex items-center gap-3">
          <svg
            v-if="player.name === 'Maya'"
            aria-hidden="true"
            class="sparkline"
            viewBox="0 0 72 28"
          >
            <polyline points="2,22 16,20 30,21 44,15 58,16 70,6" />
          </svg>

          <Icon
            v-if="player.movement !== 'none'"
            aria-hidden="true"
            class="size-5"
            :class="player.movement === 'up' ? 'text-positive' : 'text-negative'"
            :name="player.movement === 'up' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
          />

          <span
            v-else
            aria-hidden="true"
            class="text-ink-subtle text-body"
          >
            —
          </span>
        </div>
      </li>
    </ol>

    <figcaption class="text-ink-subtle text-body-sm mt-5">
      Upset: #3 beat #1. Both ratings moved; the provisional player’s moved further.
    </figcaption>
  </figure>
</template>

<style scoped>
.sparkline {
  width: 4.5rem;
  height: 1.75rem;
}

.sparkline polyline {
  fill: none;
  stroke: var(--color-positive);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
