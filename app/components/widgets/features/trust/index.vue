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
 * ███████████████████████████████████ #components/widgets/features/trust/index.vue ████████████████████████████████████
 *
 * Result confirmation and eligibility section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { TRUST_ELIGIBILITY, TRUST_WORKFLOW } from './constants';
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
              v-for="item in TRUST_WORKFLOW"
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
              v-for="item in TRUST_ELIGIBILITY"
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
