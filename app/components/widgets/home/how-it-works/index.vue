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
 * ██████████████████████████████████ #components/widgets/home/how-it-works/index.vue ██████████████████████████████████
 *
 * Interactive landing-page walkthrough from league creation to ratings.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsHomeHowItWorks />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import { DWELL_MS, STEPS } from './constants';
import type { IHowItWorksStep } from './types';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The selected workflow step index.
 * @internal
 * @constant
 */
const active: Ref<number> = ref(0);

/**
 * Whether visitor input has retired automatic advance.
 * @internal
 * @constant
 */
const paused: Ref<boolean> = ref(false);

/**
 * The active interval, retained so teardown can cancel it.
 * @internal
 * @constant
 */
let timer: ReturnType<typeof setInterval> | null = null;

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The workflow step currently expanded; the fallback satisfies indexed-access typing.
 * @internal
 * @constant
 */
const current: ComputedRef<IHowItWorksStep | undefined> = computed(
  (): IHowItWorksStep | undefined => STEPS[active.value],
);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Moves to a specific step and stops the automatic advance.
 *
 * Once someone has chosen a step, continuing to rotate underneath them would be taking the control back.
 * @internal
 * @function
 * @param index - Workflow step index selected by the visitor.
 */
function selectStep(index: number): void {
  active.value = index;
  paused.value = true;
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

onMounted((): void => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  timer = setInterval((): void => {
    if (!paused.value) {
      active.value = (active.value + 1) % STEPS.length;
    }
  }, DWELL_MS);
});

onBeforeUnmount((): void => {
  if (timer !== null) {
    clearInterval(timer);
  }
});
</script>

<template>
  <section
    id="how-it-works"
    class="px-6 py-16 md:px-16 md:py-24"
  >
    <div class="mx-auto max-w-[1120px]">
      <h2 class="font-display text-h1 font-medium tracking-tight">How it works</h2>

      <div class="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          class="flex flex-col gap-2"
          role="tablist"
        >
          <button
            v-for="(step, index) in STEPS"
            :id="`how-tab-${index}`"
            :key="step.label"
            :aria-controls="`how-panel-${index}`"
            :aria-selected="active === index"
            :class="
              active === index
                ? 'border-accent bg-surface-raised text-ink'
                : 'text-ink-muted hover:text-ink hover:border-border border-transparent'
            "
            class="flex cursor-pointer items-center gap-4 rounded-lg border-l-2 px-5 py-4 text-left transition-colors"
            role="tab"
            type="button"
            @click="selectStep(index)"
          >
            <span
              :class="active === index ? 'bg-accent text-accent-ink' : 'bg-surface-raised text-ink-subtle'"
              class="text-body-sm flex size-8 shrink-0 items-center justify-center rounded-full font-medium transition-colors"
            >
              {{ index + 1 }}
            </span>

            <span class="text-body-lg font-medium">{{ step.label }}</span>
          </button>
        </div>

        <div
          v-if="current"
          :id="`how-panel-${active}`"
          :aria-labelledby="`how-tab-${active}`"
          class="border-border bg-surface flex flex-col justify-center rounded-xl border p-10"
          role="tabpanel"
        >
          <Icon
            :name="current.icon"
            class="text-accent size-8"
          />

          <h3 class="font-display text-h2 mt-6 font-medium tracking-tight">{{ current.title }}</h3>

          <p class="text-ink-muted text-body-lg mt-4">{{ current.body }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
