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
 * ███████████████████████████████ #components/widgets/features/trust-diagram/index.vue ████████████████████████████████
 *
 * Illustration of a result moving from recorded to accepted and into the standings.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { TRUST_DIAGRAM_STEPS } from './constants';
</script>

<template>
  <figure
    aria-describedby="trust-diagram-description"
    aria-labelledby="trust-diagram-label"
    class="mt-12"
  >
    <p
      id="trust-diagram-label"
      class="sr-only"
    >
      A result moving from recorded to accepted and into the standings
    </p>

    <p
      id="trust-diagram-description"
      class="sr-only"
    >
      Maya leads Sam by two games to one. The result is waiting for Sam's confirmation and will be accepted
      automatically in 36 hours. Accepted results feed the records and ratings they qualify for; disputed results are
      held until a manager resolves them.
    </p>

    <div
      aria-hidden="true"
      class="border-border bg-surface rounded-lg border p-6 sm:p-8"
    >
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p class="text-ink-subtle text-caption font-mono tracking-widest uppercase">Singles · Best of 3</p>

          <p class="font-display text-h2 mt-3 font-medium">
            Maya <span class="text-ink-muted">11-8 · 9-11 · 11-6</span> Sam
          </p>
        </div>

        <span class="bg-caution-soft text-caution-soft-ink text-caption w-fit rounded-full px-3 py-1.5 font-medium">
          Awaiting Sam
        </span>
      </div>

      <p class="text-ink-muted text-body-sm mt-5">Accepted automatically in 36 h</p>

      <ol class="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-0">
        <li
          v-for="(step, index) in TRUST_DIAGRAM_STEPS"
          :key="step"
          class="step relative flex items-center gap-3 sm:block sm:text-center"
        >
          <span
            class="relative z-10 grid size-8 shrink-0 place-items-center rounded-full"
            :class="
              index === 0 ? 'bg-positive text-ink-inverse' : 'border-border-strong bg-surface text-ink-muted border'
            "
          >
            <Icon
              v-if="index === 0"
              class="size-4"
              name="lucide:check"
            />

            <span
              v-else
              class="text-caption font-medium"
              >{{ index + 1 }}</span
            >
          </span>

          <span
            class="text-body-sm sm:mt-3 sm:block"
            :class="index === 0 ? 'text-ink font-medium' : 'text-ink-muted'"
          >
            {{ step }}
          </span>
        </li>
      </ol>
    </div>

    <figcaption class="text-ink-subtle text-body-sm mt-4 text-center">
      Accepted feeds the records and ratings it qualifies for. Disputed holds it out until a manager resolves it.
    </figcaption>
  </figure>
</template>

<style scoped>
@media (width >= 40rem) {
  .step:not(:last-child)::after {
    position: absolute;
    top: 1rem;
    left: calc(50% + 1.25rem);
    width: calc(100% - 2.5rem);
    height: 1px;
    content: '';
    background: var(--color-border-strong);
  }
}
</style>
