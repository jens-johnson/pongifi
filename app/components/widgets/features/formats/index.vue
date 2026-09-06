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
 * ██████████████████████████████████ #components/widgets/features/formats/index.vue ███████████████████████████████████
 *
 * Game format explorer for the Features page: a tab list over singles, doubles and cutthroat.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import { FEATURES_FORMATS, FEATURES_RULE_COLUMNS } from './constants';
import type { IFeaturesFormat } from './types';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The format currently shown in the explorer. It changes only when the visitor asks it to
 * @internal
 * @constant
 */
const active: Ref<number> = ref<number>(0);

/**
 * Announced only when the adjacent controls change the panel without moving focus to a tab
 * @internal
 * @constant
 */
const announcement: Ref<string | null> = ref<string | null>(null);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The current format. The index is always wrapped before it reaches this computed value
 * @internal
 * @constant
 */
const current: ComputedRef<IFeaturesFormat | undefined> = computed<IFeaturesFormat | undefined>(
  (): IFeaturesFormat | undefined => FEATURES_FORMATS[active.value],
);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Selects one of the three formats, wrapping at either end
 * @internal
 * @function
 * @param index - The format to show; values outside the range wrap
 * @param announce - Whether the change needs announcing, for controls that do not move focus
 */
function select(index: number, announce: boolean = false): void {
  active.value = (index + FEATURES_FORMATS.length) % FEATURES_FORMATS.length;
  announcement.value = announce ? `${FEATURES_FORMATS[active.value]?.title ?? 'Format'} selected.` : null;
}

/**
 * Moves relative to the current format, for the previous and next controls
 * @internal
 * @function
 * @param offset - How far to move, in formats
 */
function move(offset: number): void {
  select(active.value + offset, true);
}

/**
 * Selects a tab and puts keyboard focus on it, as a horizontal tab list is expected to
 * @internal
 * @function
 * @param index - The tab to select and focus
 */
function selectAndFocus(index: number): void {
  select(index);

  void nextTick((): void => {
    const format: IFeaturesFormat | undefined = FEATURES_FORMATS[active.value];

    if (format !== undefined) {
      document.getElementById(`format-tab-${format.id}`)?.focus();
    }
  });
}
</script>

<template>
  <section
    id="formats"
    class="bg-surface-raised scroll-mt-16 px-6 py-16 md:px-16 md:py-24"
  >
    <div class="mx-auto max-w-[1120px]">
      <div class="mx-auto max-w-[760px] text-center">
        <h2
          id="formats-heading"
          class="font-display text-h1 font-medium tracking-tight"
          tabindex="-1"
        >
          Three game formats. Endless possibilities.
        </h2>

        <p class="text-ink-muted text-body-lg mt-6">
          Two standard formats and one house rule. Pongifi knows the service order, the change of ends, and the
          deciding-game quirks for each, so an unusual match still scores correctly.
        </p>
      </div>

      <div class="mt-12">
        <div
          aria-label="Choose a game format"
          class="border-border mx-auto grid max-w-[760px] grid-cols-3 border-b"
          role="tablist"
        >
          <button
            v-for="(format, index) in FEATURES_FORMATS"
            :id="`format-tab-${format.id}`"
            :key="format.id"
            :aria-selected="active === index"
            :class="active === index ? 'border-accent text-ink' : 'hover:text-ink text-ink-muted border-transparent'"
            class="-mb-px flex min-h-16 cursor-pointer items-center justify-center gap-2 border-b-2 px-2 py-3 transition-colors sm:px-4"
            role="tab"
            :tabindex="active === index ? 0 : -1"
            type="button"
            @click="select(index)"
            @keydown.end.prevent="selectAndFocus(FEATURES_FORMATS.length - 1)"
            @keydown.home.prevent="selectAndFocus(0)"
            @keydown.left.prevent="selectAndFocus(active - 1)"
            @keydown.right.prevent="selectAndFocus(active + 1)"
          >
            <Icon
              aria-hidden="true"
              class="size-4 shrink-0"
              :name="format.icon"
            />

            <span class="text-body-sm font-medium sm:text-base">{{ format.title }}</span>
          </button>
        </div>

        <p
          aria-atomic="true"
          aria-live="polite"
          class="sr-only"
        >
          {{ announcement }}
        </p>

        <div
          v-if="current"
          :aria-labelledby="`format-tab-${current.id}`"
          class="border-border bg-surface mt-8 grid min-h-[440px] overflow-hidden rounded-lg border lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
          role="tabpanel"
        >
          <div class="flex flex-col p-6 sm:p-8 lg:p-10">
            <span class="text-accent-strong text-caption font-mono uppercase">
              {{ String(active + 1).padStart(2, '0') }} / {{ String(FEATURES_FORMATS.length).padStart(2, '0') }}
            </span>

            <h3 class="font-display text-h2 mt-4 font-medium tracking-tight">{{ current.title }}</h3>

            <p class="text-ink-muted text-body-lg mt-4">{{ current.description }}</p>

            <dl class="border-border mt-8 grid grid-cols-3 border-y">
              <div
                v-for="stat in current.stats"
                :key="stat.label"
                class="border-border py-4 not-first:pl-3 not-last:border-r not-last:pr-3"
              >
                <dt class="text-ink-subtle text-caption">{{ stat.label }}</dt>

                <dd class="text-body-sm mt-1 font-medium">{{ stat.value }}</dd>
              </div>
            </dl>

            <div class="mt-auto flex items-center gap-3 pt-8">
              <button
                aria-label="Previous game format"
                class="border-border text-ink-muted hover:border-accent hover:text-accent-strong flex size-10 cursor-pointer items-center justify-center rounded-full border transition-colors"
                title="Previous game format"
                type="button"
                @click="move(-1)"
              >
                <Icon
                  aria-hidden="true"
                  class="size-4"
                  name="lucide:chevron-left"
                />
              </button>

              <button
                aria-label="Next game format"
                class="border-border text-ink-muted hover:border-accent hover:text-accent-strong flex size-10 cursor-pointer items-center justify-center rounded-full border transition-colors"
                title="Next game format"
                type="button"
                @click="move(1)"
              >
                <Icon
                  aria-hidden="true"
                  class="size-4"
                  name="lucide:chevron-right"
                />
              </button>

              <div
                aria-hidden="true"
                class="ml-2 flex items-center gap-2"
              >
                <span
                  v-for="format in FEATURES_FORMATS"
                  :key="format.id"
                  :class="current.id === format.id ? 'bg-accent w-6' : 'bg-border-strong w-2'"
                  class="h-2 rounded-full transition-all"
                />
              </div>
            </div>
          </div>

          <div class="bg-brand-soft flex min-h-[320px] items-center p-4 sm:p-8">
            <WidgetsFeaturesFormatsDiagram
              :key="current.id"
              :format="current.id"
            />
          </div>
        </div>
      </div>

      <div class="mx-auto mt-14 max-w-[960px]">
        <h3 class="font-display text-h2 text-center font-medium tracking-tight">What Pongifi keeps track of</h3>

        <div class="mt-8 grid gap-x-12 gap-y-4 md:grid-cols-2">
          <ul
            v-for="(rules, columnIndex) in FEATURES_RULE_COLUMNS"
            :key="columnIndex"
            class="grid content-start gap-4"
          >
            <li
              v-for="rule in rules"
              :key="rule"
              class="text-ink-muted text-body flex gap-3"
            >
              <Icon
                aria-hidden="true"
                class="text-accent mt-1 size-4 shrink-0"
                name="lucide:check"
              />

              <span>{{ rule }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
