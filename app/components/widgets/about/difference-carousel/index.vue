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
 * ██████████████████████████████ #components/widgets/about/difference-carousel/index.vue ██████████████████████████████
 *
 * Self-advancing carousel for the About page product differences.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsAboutDifferenceCarousel />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import { DIFFERENCES, DWELL_MS } from './constants';
import type { IDifference } from './types';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The slide on show.
 * @internal
 * @constant
 */
const active: Ref<number> = ref(0);

/**
 * Set once someone drives the carousel themselves, which retires the automatic advance for good.
 * @internal
 * @constant
 */
const paused: Ref<boolean> = ref(false);

/**
 * Which way the last change moved, so the transition can slide the right way.
 * @internal
 * @constant
 */
const reversing: Ref<boolean> = ref(false);

/**
 * The active interval, retained so teardown can cancel it.
 * @internal
 * @constant
 */
let timer: ReturnType<typeof setInterval> | null = null;

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The claim currently rendered; the fallback satisfies indexed-access typing.
 * @internal
 * @constant
 */
const current: ComputedRef<IDifference | undefined> = computed(
  (): IDifference | undefined => DIFFERENCES[active.value],
);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Moves to a specific slide, wrapping at either end.
 *
 * `manual` marks the changes a person made, which is what stops the carousel advancing underneath them.
 * @internal
 * @function
 * @param index - Requested claim index before wrapping.
 * @param manual - Whether a visitor initiated the change.
 */
function selectSlide(index: number, manual: boolean): void {
  const next: number = (index + DIFFERENCES.length) % DIFFERENCES.length;

  reversing.value = next < active.value;
  active.value = next;

  if (manual) {
    paused.value = true;
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

onMounted((): void => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  timer = setInterval((): void => {
    if (!paused.value) {
      selectSlide(active.value + 1, false);
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
      <h2 class="font-display text-h1 font-medium tracking-tight">What makes it different</h2>

      <p class="text-ink-muted text-body-lg mt-4 max-w-[620px]">
        Three things that are true of Pongifi and not true of a spreadsheet.
      </p>

      <div
        aria-label="What makes it different"
        class="border-border bg-surface relative mt-10 overflow-hidden rounded-2xl border lg:min-h-[400px]"
        role="group"
      >
        <Transition :name="reversing ? 'slide-back' : 'slide'">
          <div
            v-if="current"
            :key="active"
            class="grid items-center gap-8 p-6 md:gap-10 md:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:p-14"
          >
            <div>
              <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">
                {{ String(active + 1).padStart(2, '0') }} / {{ String(DIFFERENCES.length).padStart(2, '0') }}
              </span>

              <h3 class="font-display text-h2 mt-4 font-medium tracking-tight">{{ current.title }}</h3>

              <p class="text-ink-muted text-body-lg mt-4">
                {{ current.body
                }}<template v-if="current.link"
                  ><a
                    class="text-accent-strong hover:text-accent underline underline-offset-4 transition-colors"
                    :href="current.link.href"
                    rel="noopener noreferrer"
                    target="_blank"
                    >{{ current.link.label }}</a
                  >{{ current.link.after }}</template
                >
              </p>
            </div>

            <div class="bg-surface-raised rounded-xl p-6">
              <DataDifferenceDiagram :variant="current.diagram" />
            </div>
          </div>
        </Transition>
      </div>

      <div class="mt-6 flex items-center gap-4">
        <button
          aria-label="Previous point"
          class="border-border text-ink-muted hover:border-accent hover:text-accent-strong flex size-9 cursor-pointer items-center justify-center rounded-full border transition-colors"
          type="button"
          @click="selectSlide(active - 1, true)"
        >
          <Icon
            class="size-4"
            name="lucide:chevron-left"
          />
        </button>

        <button
          aria-label="Next point"
          class="border-border text-ink-muted hover:border-accent hover:text-accent-strong flex size-9 cursor-pointer items-center justify-center rounded-full border transition-colors"
          type="button"
          @click="selectSlide(active + 1, true)"
        >
          <Icon
            class="size-4"
            name="lucide:chevron-right"
          />
        </button>

        <div class="ml-2 flex items-center gap-2">
          <button
            v-for="(difference, index) in DIFFERENCES"
            :key="difference.title"
            :aria-current="active === index"
            :aria-label="difference.title"
            :class="active === index ? 'bg-accent w-6' : 'bg-border-strong hover:bg-ink-subtle w-2'"
            class="h-2 cursor-pointer rounded-full transition-all"
            type="button"
            @click="selectSlide(index, true)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
  transition:
    opacity 400ms ease,
    translate 400ms ease;
}

/* the outgoing slide is taken out of the flow so the incoming one does not get pushed below it */
.slide-leave-active,
.slide-back-leave-active {
  position: absolute;
  inset: 0;
}

.slide-enter-from {
  opacity: 0;
  translate: 40px 0;
}

.slide-leave-to {
  opacity: 0;
  translate: -40px 0;
}

.slide-back-enter-from {
  opacity: 0;
  translate: -40px 0;
}

.slide-back-leave-to {
  opacity: 0;
  translate: 40px 0;
}

@media (prefers-reduced-motion: reduce) {
  .slide-enter-active,
  .slide-leave-active,
  .slide-back-enter-active,
  .slide-back-leave-active {
    transition: none;
  }
}
</style>
