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
 * ███████████████████████████████████████████ #components/PlayContexts.vue ████████████████████████████████████████████
 *
 * Who It Is For, as a table whose players glide into a new arrangement per playing context.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
interface ISeat {
  /** Whether this player is present in the arrangement at all. */
  on: boolean;
  /** Position in the diagram's own coordinates. */
  x: number;
  /** Position in the diagram's own coordinates. */
  y: number;
}

/**
 *
 */
interface IContext {
  /** The line shown beneath the table when this context is chosen. */
  blurb: string;
  /** The chip label. */
  label: string;
  /**
   * Where each of the four players stands.
   *
   * Every context supplies all four seats even when it does not use them, so a player leaving the arrangement glides
   * off rather than blinking out of existence.
   */
  seats: readonly ISeat[];
}

/**
 * The four places a league tends to live.
 *
 * Deliberately broader than the office the product started in — the office is where it began rather than where it has
 * to stay.
 */
const CONTEXTS: readonly IContext[] = [
  {
    blurb: 'Winner stays on, and the queue is half the fun.',
    label: 'The office',
    seats: [
      {
        on: true,
        x: 52,
        y: 130,
      },
      {
        on: true,
        x: 428,
        y: 130,
      },
      {
        on: true,
        x: 196,
        y: 238,
      },
      {
        on: true,
        x: 246,
        y: 238,
      },
    ],
  },
  {
    blurb: 'Two paddles, one table, and a rivalry that predates the app.',
    label: 'The family',
    seats: [
      {
        on: true,
        x: 52,
        y: 130,
      },
      {
        on: true,
        x: 428,
        y: 130,
      },
      {
        on: false,
        x: 150,
        y: 260,
      },
      {
        on: false,
        x: 330,
        y: 260,
      },
    ],
  },
  {
    blurb: 'Doubles, ladders, and people who already keep score properly.',
    label: 'The club',
    seats: [
      {
        on: true,
        x: 52,
        y: 98,
      },
      {
        on: true,
        x: 428,
        y: 98,
      },
      {
        on: true,
        x: 52,
        y: 162,
      },
      {
        on: true,
        x: 428,
        y: 162,
      },
    ],
  },
  {
    blurb: 'Late nights, questionable lighting, genuine stakes.',
    label: 'The garage',
    seats: [
      {
        on: true,
        x: 52,
        y: 130,
      },
      {
        on: true,
        x: 428,
        y: 130,
      },
      {
        on: true,
        x: 300,
        y: 238,
      },
      {
        on: false,
        x: 330,
        y: 260,
      },
    ],
  },
];

/** How long a context holds before moving on by itself. */
const DWELL_MS: number = 5000;

/**
 * The context on show.
 */
const active = ref<number>(0);

/**
 * Set once someone picks a context themselves, which retires the automatic rotation.
 */
const paused = ref<boolean>(false);

/**
 *
 */
let timer: ReturnType<typeof setInterval> | null = null;

/** The context currently rendered. Indexing is always in range; the union satisfies the type checker. */
const current = computed<IContext | undefined>((): IContext | undefined => CONTEXTS[active.value]);

/**
 * Moves to a specific context and stops the rotation.
 */
const select = (index: number): void => {
  active.value = index;
  paused.value = true;
};

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
        Pongifi can be played anywhere you have a table and a paddle — from office matches to late night garage
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
          @click="select(index)"
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
