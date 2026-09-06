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
 * ███████████████████████████████████ #components/widgets/features/limits/index.vue ███████████████████████████████████
 *
 * Launch-scope limits strip for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { LATER_CAPABILITIES } from './constants';
</script>

<template>
  <section class="bg-surface-raised px-6 py-12 md:px-16">
    <div class="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] md:items-center">
      <div>
        <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">Later</span>

        <h2 class="font-display text-h2 mt-3 font-medium tracking-tight">Not in the first release</h2>
      </div>

      <ul class="grid gap-4 sm:grid-cols-3">
        <li
          v-for="item in LATER_CAPABILITIES"
          :key="item"
          class="text-ink-muted text-body flex items-center gap-3"
        >
          <Icon
            aria-hidden="true"
            class="text-ink-subtle size-4 shrink-0"
            name="lucide:clock-3"
          />

          <span>{{ item }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
