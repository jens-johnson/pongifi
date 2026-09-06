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
 * ██████████████████████████████████████████ #components/FeaturesFormats.vue ██████████████████████████████████████████
 *
 * Singles, doubles and cutthroat section for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
import type { TFeaturesFormat } from './FeaturesFormatsDiagram.vue';

/** One compact fact about a format. */
interface IFormatStat {
  label: string;
  value: string;
}

/** Copy, controls and facts for one mode in the explorer. */
interface IFormat {
  description: string;
  icon: string;
  id: TFeaturesFormat;
  stats: readonly IFormatStat[];
  title: string;
}

/**
 *
 */
const FORMATS: readonly IFormat[] = [
  {
    description: "One against one. First to the target, win by the margin, service changing on your league's interval.",
    icon: 'lucide:user',
    id: 'singles',
    stats: [
      { label: 'Players', value: '2' },
      { label: 'Shape', value: '1 vs 1' },
      { label: 'Service', value: 'League interval' },
    ],
    title: 'Singles',
  },
  {
    description:
      'Two against two. Pongifi tracks the full service and receiving order, including the receiving pair swapping order in the deciding game.',
    icon: 'lucide:users',
    id: 'doubles',
    stats: [
      { label: 'Players', value: '4' },
      { label: 'Shape', value: '2 vs 2' },
      { label: 'Service', value: 'Fixed order' },
    ],
    title: 'Doubles',
  },
  {
    description:
      'One against two, on a fixed rotation. Only the server can score. Optional time cap: an outright leader wins when it elapses; tied leaders take service in rotation until one of them wins a rally as server. House rules, and we say so.',
    icon: 'lucide:users-round',
    id: 'cutthroat',
    stats: [
      { label: 'Players', value: '3' },
      { label: 'Shape', value: '1 vs 2' },
      { label: 'Scoring', value: 'Server only' },
    ],
    title: 'Cutthroat',
  },
];

/** The format currently shown in the explorer. It changes only when the visitor asks it to. */
const active = ref<number>(0);

/** Announced only when the adjacent controls change the panel without moving focus to a tab. */
const announcement = ref<string | null>(null);

/** The current format. The index is always wrapped before it reaches this computed value. */
const current = computed<IFormat | undefined>((): IFormat | undefined => FORMATS[active.value]);

/** Selects one of the three formats. */
const select = (index: number, announce: boolean = false): void => {
  active.value = (index + FORMATS.length) % FORMATS.length;
  announcement.value = announce ? `${FORMATS[active.value]?.title ?? 'Format'} selected.` : null;
};

/** Moves relative to the current format, wrapping at either end. */
const move = (offset: number): void => {
  select(active.value + offset, true);
};

/** Selects a tab and puts keyboard focus on it. */
const selectAndFocus = (index: number): void => {
  select(index);

  void nextTick((): void => {
    const format: IFormat | undefined = FORMATS[active.value];

    if (format !== undefined) {
      document.getElementById(`format-tab-${format.id}`)?.focus();
    }
  });
};

/**
 *
 */
const RULES: readonly string[] = [
  "Service changing on the league's interval, and every point at deuce (singles and doubles).",
  'Change of ends between games, and at the midpoint of a deciding game in a best-of match.',
  'Doubles service and receiving order, including the deciding-game reversal.',
  'Cutthroat rotation, server-only scoring, and the time cap.',
  'The expedite system, when a league allows it (singles and doubles).',
  'Lets, service doubt warnings and faults, timeouts, towel breaks.',
  'Retirement, with the score at that moment standing; in cutthroat the leader at that moment wins.',
];

/** Independent columns keep wrapped rules from changing the vertical rhythm beside them. */
const RULE_COLUMNS: readonly (readonly string[])[] = [RULES.slice(0, 4), RULES.slice(4)];
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
            v-for="(format, index) in FORMATS"
            :id="`format-tab-${format.id}`"
            :key="format.id"
            :aria-selected="active === index"
            :class="active === index ? 'border-accent text-ink' : 'hover:text-ink text-ink-muted border-transparent'"
            class="-mb-px flex min-h-16 cursor-pointer items-center justify-center gap-2 border-b-2 px-2 py-3 transition-colors sm:px-4"
            role="tab"
            :tabindex="active === index ? 0 : -1"
            type="button"
            @click="select(index)"
            @keydown.end.prevent="selectAndFocus(FORMATS.length - 1)"
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
              {{ String(active + 1).padStart(2, '0') }} / {{ String(FORMATS.length).padStart(2, '0') }}
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
                  v-for="format in FORMATS"
                  :key="format.id"
                  :class="current.id === format.id ? 'bg-accent w-6' : 'bg-border-strong w-2'"
                  class="h-2 rounded-full transition-all"
                />
              </div>
            </div>
          </div>

          <div class="bg-brand-soft flex min-h-[320px] items-center p-4 sm:p-8">
            <FeaturesFormatsDiagram
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
            v-for="(rules, columnIndex) in RULE_COLUMNS"
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
