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
 * Coming-soon strip for the Features page: capabilities beyond the first release.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { COMING_SOON_ITEMS } from './constants';
</script>

<template>
  <section class="bg-surface-raised px-6 py-12 md:px-16">
    <div class="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] md:items-center">
      <div>
        <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">Later</span>

        <h2 class="font-display text-h2 mt-3 font-medium tracking-tight">Coming soon</h2>
      </div>

      <ul class="grid gap-4 sm:grid-cols-3">
        <li
          v-for="item in COMING_SOON_ITEMS"
          :key="item.label"
          class="border-border bg-surface flex items-center gap-3 rounded-lg border p-4"
        >
          <span class="bg-brand-soft text-accent-strong grid size-9 shrink-0 place-items-center rounded-md">
            <Icon
              aria-hidden="true"
              class="size-5"
              :name="item.icon"
            />
          </span>

          <span class="text-ink text-body font-medium">{{ item.label }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
