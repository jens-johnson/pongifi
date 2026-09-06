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
 * ██████████████████████████████████████████ #components/FeaturesScoring.vue ██████████████████████████████████████████
 *
 * Live and retrospective scoring section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
/* ─── Constants ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the scoring surface does. Every line is scoped to what the rules engine and the schema implement: guest games
 * carry their rating consequence with them, and per-game adjustments are bounded by the league's own settings.
 */
const CAPABILITIES: readonly string[] = [
  'Rally-by-rally live scoring. In singles and doubles the server and receiver are always shown; in cutthroat the server and the receiving pair are.',
  'Undo the last rally; the score is derived from the log, so nothing is lost.',
  'Deuce, service changes, and changes of ends handled automatically.',
  'Lets, timeouts, towel breaks, and service warnings recorded as they happen.',
  'Enter a finished game after the fact, single score or full match.',
  'Schedule a game for later and record it when you play.',
  'Guests play by name, no account needed (guest games are unrated for everyone in them).',
  'Per-game adjustments within what the league allows: points to win, winning margin, service interval, best-of format.',
];

/** Separate columns prevent a wrapped item from changing the spacing in the neighboring column. */
const CAPABILITY_COLUMNS: readonly (readonly string[])[] = [CAPABILITIES.slice(0, 4), CAPABILITIES.slice(4)];
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

      <FeaturesScoringDiagram />

      <div class="mt-12 grid gap-x-12 gap-y-4 md:grid-cols-2">
        <ul
          v-for="(capabilities, columnIndex) in CAPABILITY_COLUMNS"
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
