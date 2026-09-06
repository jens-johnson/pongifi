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
 * ███████████████████████████████████ #components/widgets/features/league/index.vue ███████████████████████████████████
 *
 * League configuration section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { LEAGUE_CAPABILITIES } from './constants';
</script>

<template>
  <section
    id="league"
    class="scroll-mt-16 px-6 py-16 md:px-16 md:py-24"
  >
    <div class="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
      <WidgetsFeaturesLeagueDiagram />

      <div>
        <h2
          id="league-heading"
          class="font-display text-h1 font-medium tracking-tight"
          tabindex="-1"
        >
          Your league, your rules.
        </h2>

        <p class="text-ink-muted text-body-lg mt-6">
          Set the rules once when you create the league. Every game after that inherits them, so nobody relitigates “win
          by two” at the table.
        </p>

        <dl class="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
          <div
            v-for="capability in LEAGUE_CAPABILITIES"
            :key="capability.title"
          >
            <dt class="text-body font-medium">{{ capability.title }}</dt>

            <dd class="text-ink-muted text-body-sm mt-2">{{ capability.description }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
