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
 * ███████████████████████████████████████████ #components/FeaturesTrust.vue ███████████████████████████████████████████
 *
 * Result confirmation and eligibility section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
const WORKFLOW: readonly string[] = [
  'When confirmation is on, recording a result asks the other participants to confirm it.',
  "If nobody responds inside the league's confirmation window, the result is accepted automatically.",
  'Accepted results count toward the records and ratings they qualify for.',
  'Disputed results are held out of everything until a manager resolves them.',
  "Results can be amended inside the league's amendment window; anything that depended on them is recalculated.",
  'Retirements, walkovers, and no contests are recorded as what they were. A walkover counts as a win and nothing else; no ball was struck, so there is nothing to rate.',
  'Commissioners can void a game, and the ratings that depended on it are replayed.',
];

/**
 *
 */
const ELIGIBILITY: readonly string[] = [
  'Win/loss counts accepted games, including walkovers. A walkover credits the win and nothing else: no ball was struck, so there is nothing to rate and nothing to measure.',
  'Ratings require an accepted, played game in a league that rates games, with no guest in the game and no unrated override on it.',
  'Point statistics count any accepted, played game. A retirement contributes the points scored before the withdrawal; a walkover contributes none, having been awarded rather than played.',
  'Rally statistics additionally require that the game was scored live.',
  'The practical version: you can seat someone without an account as a guest, and that game still counts for points and for win/loss. It is simply unrated for everyone in it, guest and members alike.',
];
</script>

<template>
  <section
    id="trust"
    class="bg-surface-raised scroll-mt-16 px-6 py-16 md:px-16 md:py-24"
  >
    <div class="mx-auto max-w-[820px]">
      <div class="text-center">
        <h2
          id="trust-heading"
          class="font-display text-h1 font-medium tracking-tight"
          tabindex="-1"
        >
          Results people trust.
        </h2>

        <p class="text-ink-muted text-body-lg mt-6">
          Choose how your league accepts results: participant confirmation, an automatic acceptance window, or
          confirmation switched off. Until a result is accepted, it feeds nothing: not the standings, not the ratings.
        </p>
      </div>

      <WidgetsFeaturesTrustDiagram />

      <div class="mt-12 grid gap-10 md:grid-cols-2">
        <div>
          <h3 class="font-display text-h2 font-medium tracking-tight">How it works</h3>

          <ul class="mt-6 space-y-4">
            <li
              v-for="item in WORKFLOW"
              :key="item"
              class="text-ink-muted text-body-sm flex gap-3"
            >
              <Icon
                aria-hidden="true"
                class="text-positive mt-1 size-4 shrink-0"
                name="lucide:check-circle-2"
              />

              <span>{{ item }}</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 class="font-display text-h2 font-medium tracking-tight">What counts, and what does not</h3>

          <ul class="mt-6 space-y-4">
            <li
              v-for="item in ELIGIBILITY"
              :key="item"
              class="text-ink-muted text-body-sm flex gap-3"
            >
              <Icon
                aria-hidden="true"
                class="text-brand mt-1 size-4 shrink-0"
                name="lucide:circle-dot"
              />

              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
