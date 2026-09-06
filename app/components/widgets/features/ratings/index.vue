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
 * ██████████████████████████████████ #components/widgets/features/ratings/index.vue ███████████████████████████████████
 *
 * Ratings and leaderboard section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { RATING_CAPABILITIES } from './constants';
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
            v-for="capability in RATING_CAPABILITIES"
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

      <WidgetsFeaturesRatingsDiagram />
    </div>
  </section>
</template>
