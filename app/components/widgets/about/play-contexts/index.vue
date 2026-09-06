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
 * █████████████████████████████████ #components/widgets/about/play-contexts/index.vue █████████████████████████████████
 *
 * Interactive selector showing the settings and groups Pongifi supports.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsAboutPlayContexts />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import { CONTEXTS, DWELL_MS } from './constants';
import type { IPlayContext } from './types';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The context on show.
 * @internal
 * @constant
 */
const active: Ref<number> = ref(0);

/**
 * Set once someone picks a context themselves, which retires the automatic rotation.
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
 * The play context currently rendered; the fallback satisfies indexed-access typing.
 * @internal
 * @constant
 */
const current: ComputedRef<IPlayContext | undefined> = computed((): IPlayContext | undefined => CONTEXTS[active.value]);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Moves to a specific context and stops automatic rotation.
 * @internal
 * @function
 * @param index - Play-context index selected by the visitor.
 */
function selectContext(index: number): void {
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
      active.value = (active.value + 1) % CONTEXTS.length;
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
  <section class="px-6 py-16 md:px-16 md:py-24">
    <div class="mx-auto max-w-[1120px]">
      <h2 class="font-display text-h1 font-medium tracking-tight">Who it is for</h2>

      <p class="text-ink-muted text-body-lg mt-4 max-w-[680px]">
        Pongifi can be played anywhere you have a table and a paddle, from office matches to late night garage
        competitions and everywhere in between. Create a league with your friends, family, clubs, and coworkers, or
        discover leagues that fit your interest and skill level.
      </p>

      <div class="mt-10 flex flex-wrap gap-2">
        <button
          v-for="(context, index) in CONTEXTS"
          :key="context.label"
          :aria-pressed="active === index"
          :class="
            active === index
              ? 'border-accent bg-accent text-accent-ink'
              : 'border-border text-ink-muted hover:border-border-strong hover:text-ink'
          "
          class="text-body-sm cursor-pointer rounded-full border px-4 py-2 font-medium transition-colors"
          type="button"
          @click="selectContext(index)"
        >
          {{ context.label }}
        </button>
      </div>

      <div
        v-if="current"
        class="border-border bg-surface mt-6 rounded-2xl border p-5 md:p-8 lg:p-12"
      >
        <svg
          aria-hidden="true"
          class="contexts__stage"
          viewBox="0 0 480 268"
        >
          <rect
            class="contexts__felt"
            height="140"
            rx="4"
            width="300"
            x="90"
            y="60"
          />

          <rect
            class="contexts__table"
            height="140"
            rx="4"
            width="300"
            x="90"
            y="60"
          />

          <line
            class="contexts__centre"
            x1="90"
            x2="390"
            y1="130"
            y2="130"
          />

          <line
            class="contexts__net"
            x1="240"
            x2="240"
            y1="48"
            y2="212"
          />

          <g
            v-for="(seat, index) in current.seats"
            :key="index"
            :class="[`contexts__seat--${index + 1}`, { 'contexts__seat--off': !seat.on }]"
            class="contexts__seat"
            :style="{ translate: `${seat.x}px ${seat.y}px` }"
          >
            <circle
              class="contexts__halo"
              r="20"
            />

            <circle
              class="contexts__player"
              r="12"
            />
          </g>
        </svg>

        <Transition
          mode="out-in"
          name="blurb"
        >
          <p
            :key="active"
            class="text-ink-muted text-body-lg mt-6 text-center"
          >
            {{ current.blurb }}
          </p>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.contexts__stage {
  display: block;
  width: 100%;
  height: auto;
  max-width: 780px;
  margin: 0 auto;
}

.contexts__felt {
  fill: var(--color-brand-soft);
}

.contexts__table {
  fill: none;
  stroke: var(--color-brand);
  stroke-width: 2.5;
}

.contexts__centre {
  stroke: var(--color-brand);
  stroke-width: 1;
  opacity: 0.4;
}

.contexts__net {
  stroke: var(--color-brand);
  stroke-width: 3.5;
  stroke-linecap: round;
}

.contexts__seat {
  transform-box: view-box;
  transform-origin: 0 0;
  transition:
    translate 700ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 350ms ease,
    scale 500ms ease;
}

.contexts__seat--off {
  opacity: 0;
  scale: 0.4;
}

.contexts__halo {
  fill: currentColor;
  opacity: 0.18;
}

.contexts__player {
  fill: currentColor;
}

.contexts__seat--1 {
  color: var(--color-player-1);
}

.contexts__seat--2 {
  color: var(--color-player-2);
}

.contexts__seat--3 {
  color: var(--color-player-3);
}

.contexts__seat--4 {
  color: var(--color-player-4);
}

.blurb-enter-active,
.blurb-leave-active {
  transition: opacity 250ms ease;
}

.blurb-enter-from,
.blurb-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .contexts__seat,
  .blurb-enter-active,
  .blurb-leave-active {
    transition: none;
  }
}
</style>
