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
 * ██████████████████████████████████████████ #components/FeaturesRatings.vue ██████████████████████████████████████████
 *
 * Ratings and standings section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
const CAPABILITIES: readonly string[] = [
  'A rating per player, per league, based on Elo.',
  'Separate ratings for singles, doubles, and cutthroat, plus an overall.',
  'A provisional period where new ratings move faster, then settle.',
  'In singles and doubles, margin of victory nudges the exchange within limits, so 11-3 and 11-9 do not count identically.',
  'Ratings recompute when a result is amended or voided, so the ladder always reflects the log.',
  'Rating history per player, and a league leaderboard per scope.',
  'Games, points, and minutes at the table, per player and per league.',
];
</script>

<template>
  <section
    id="ratings"
    class="scroll-mt-16 px-6 py-16 md:px-16 md:py-24"
  >
    <div class="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-2 lg:items-center">
      <div>
        <h2
          id="ratings-heading"
          class="font-display text-h1 font-medium tracking-tight"
          tabindex="-1"
        >
          A leaderboard that means something.
        </h2>

        <p class="text-ink-muted text-body-lg mt-6">
          Beating someone better than you moves your rating further than beating someone worse. New players settle
          quickly, established players move deliberately, and the table ends up saying who is actually best.
        </p>

        <ul class="mt-9 space-y-4">
          <li
            v-for="capability in CAPABILITIES"
            :key="capability"
            class="text-ink-muted text-body flex gap-3"
          >
            <Icon
              aria-hidden="true"
              class="text-accent mt-1 size-4 shrink-0"
              name="lucide:trending-up"
            />

            <span>{{ capability }}</span>
          </li>
        </ul>
      </div>

      <FeaturesRatingsDiagram />
    </div>
  </section>
</template>
