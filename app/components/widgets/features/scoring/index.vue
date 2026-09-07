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
 * ██████████████████████████████████ #components/widgets/features/scoring/index.vue ███████████████████████████████████
 *
 * Live and after-the-fact scoring section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { SCORING_CAPABILITY_COLUMNS } from './constants';
</script>

<template>
  <section
    id="scoring"
    class="scroll-mt-16 px-6 py-16 md:px-16 md:py-24"
  >
    <div class="mx-auto max-w-[1120px]">
      <div class="mx-auto max-w-[720px] text-center">
        <h2
          id="scoring-heading"
          class="font-display text-h1 font-medium tracking-tight"
          tabindex="-1"
        >
          Score it live, or log it after.
        </h2>

        <p class="text-ink-muted text-body-lg mt-6">
          The table is the interface. Tap who won the rally and Pongifi keeps the score, tracks who is serving, calls
          deuce, and swaps ends when the rules say so. No phone at the table? Enter the final scores afterwards;
          eligible results still count toward records and ratings. Rally and service statistics need a live recording.
        </p>
      </div>

      <WidgetsFeaturesScoringDiagram />

      <div class="mt-12 grid gap-x-12 gap-y-4 md:grid-cols-2">
        <ul
          v-for="(capabilities, columnIndex) in SCORING_CAPABILITY_COLUMNS"
          :key="columnIndex"
          class="grid content-start gap-4"
        >
          <li
            v-for="capability in capabilities"
            :key="capability"
            class="text-ink-muted text-body flex gap-3"
          >
            <Icon
              aria-hidden="true"
              class="text-accent mt-1 size-4 shrink-0"
              name="lucide:check"
            />

            <span>{{ capability }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
