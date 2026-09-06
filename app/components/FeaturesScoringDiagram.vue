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
 * ██████████████████████████████████████ #components/FeaturesScoringDiagram.vue ███████████████████████████████████████
 *
 * Engine-derived interactive scoring demo for the Features page.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
import type { TMatchEvent } from '#shared/rules-engine';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The fixed starting log. Undo never crosses this boundary, so the useful deuce state remains one click away.
 */
const initialEvents: TMatchEvent[] = buildScoringFixtureEvents();

/** The demo's current event log. Every displayed state is replayed from this sequence. */
const events = ref<TMatchEvent[]>([...initialEvents]);

/** The last interaction, included in the live announcement so a score change has context. */
const lastAction = ref<string | null>(null);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The displayed state, replayed from the current event log. */
const fixture = computed<IScoringFixture>((): IScoringFixture => buildScoringFixture(events.value));

/** The near player, drawn at the bottom of the table. */
const near = computed<IScoringFixturePlayer | undefined>(
  (): IScoringFixturePlayer | undefined => fixture.value.players[0],
);

/** The far player, drawn at the top of the table. */
const far = computed<IScoringFixturePlayer | undefined>(
  (): IScoringFixturePlayer | undefined => fixture.value.players[1],
);

/** The player holding service, named in words beside the diagram as well as marked on it. */
const server = computed<IScoringFixturePlayer | undefined>((): IScoringFixturePlayer | undefined =>
  fixture.value.players.find((player: IScoringFixturePlayer): boolean => player.isServing),
);

/** Whether the visitor has awarded at least one rally. */
const hasChanges = computed<boolean>((): boolean => events.value.length > initialEvents.length);

/** A self-contained status update for assistive technology. */
const announcement = computed<string>((): string =>
  [lastAction.value, fixture.value.description].filter(Boolean).join(' '),
);

/* ─── Actions ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Awards the next rally to a player through the same rules engine used by the application. */
const award = (player: IScoringFixturePlayer): void => {
  if (fixture.value.isComplete) {
    return;
  }

  events.value = scoreScoringFixturePoint(events.value, player.name);
  lastAction.value = `${player.name} won the rally.`;
};

/** Removes the visitor's most recent rally without changing the fixture's starting state. */
const undo = (): void => {
  if (!hasChanges.value) {
    return;
  }

  events.value = events.value.slice(0, -1);
  lastAction.value = 'Last rally undone.';
};

/** Returns the demo to its ten-all starting state. */
const reset = (): void => {
  if (!hasChanges.value) {
    return;
  }

  events.value = [...initialEvents];
  lastAction.value = 'Scoring demo reset.';
};
</script>

<template>
  <figure class="mt-12">
    <!-- The description is also live so a screen-reader user hears each derived score and service change. -->
    <p
      id="scoring-diagram-label"
      class="sr-only"
    >
      Interactive singles scoring demo
    </p>

    <p
      id="scoring-diagram-description"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {{ announcement }}
    </p>

    <div
      aria-describedby="scoring-diagram-description"
      aria-labelledby="scoring-diagram-label"
      class="border-border bg-surface grid gap-8 rounded-2xl border p-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] md:items-center md:gap-12 md:p-10"
      role="group"
    >
      <!-- The table, drawn from above: the net runs across it and the players sit at either end. -->
      <svg
        aria-hidden="true"
        class="table"
        viewBox="0 0 360 440"
      >
        <rect
          class="table__felt"
          height="280"
          rx="4"
          width="200"
          x="80"
          y="80"
        />

        <rect
          class="table__edge"
          height="280"
          rx="4"
          width="200"
          x="80"
          y="80"
        />

        <line
          class="table__centre"
          x1="180"
          x2="180"
          y1="80"
          y2="360"
        />

        <line
          class="table__net"
          x1="68"
          x2="292"
          y1="220"
          y2="220"
        />

        <!-- The far player. -->
        <text
          class="table__name"
          text-anchor="middle"
          x="180"
          y="26"
        >
          {{ far?.name }}
        </text>

        <circle
          class="table__player table__player--far"
          cx="180"
          cy="52"
          r="16"
        />

        <!-- The near player. The ball moves beside whichever player holds service. -->
        <circle
          class="table__player table__player--near"
          cx="180"
          cy="388"
          r="16"
        />

        <circle
          v-if="server"
          :class="['table__ball', near?.isServing ? 'table__ball--near' : 'table__ball--far']"
          cx="212"
          :cy="near?.isServing ? 388 : 52"
          r="7"
        />

        <text
          class="table__name"
          text-anchor="middle"
          x="180"
          y="428"
        >
          {{ near?.name }}
        </text>
      </svg>

      <!-- The scoreboard is real text rather than SVG labels, so it stays legible at a phone's width. -->
      <div>
        <p class="text-ink-subtle text-caption font-mono tracking-widest uppercase">
          Best of 3 · games {{ near?.gamesWon }}–{{ far?.gamesWon }}
        </p>

        <div class="mt-4 flex items-baseline gap-4">
          <span class="font-display text-score font-medium tracking-tight tabular-nums">
            {{ near?.score }}–{{ far?.score }}
          </span>

          <span
            v-if="fixture.isComplete"
            class="bg-positive-soft text-positive-soft-ink text-caption rounded-full px-3 py-1 font-medium"
          >
            Match
          </span>

          <span
            v-else-if="fixture.isDeuce"
            class="bg-caution-soft text-caution-soft-ink text-caption rounded-full px-3 py-1 font-medium"
          >
            Deuce
          </span>
        </div>

        <p class="text-ink-muted text-body mt-4">
          <template v-if="fixture.isComplete">
            <span class="text-ink font-medium">{{ fixture.winner }}</span> wins the match. Reset the demo to play again.
          </template>

          <template v-else>
            Game {{ fixture.gameNumber }}. <span class="text-ink font-medium">{{ server?.name }}</span>

            to serve<span v-if="fixture.isDeuce">, and at deuce the serve changes every point</span>.
          </template>
        </p>

        <div class="mt-6 grid grid-cols-2 gap-3">
          <button
            v-for="(player, index) in fixture.players"
            :key="player.name"
            :aria-label="`Award rally to ${player.name}`"
            :aria-disabled="fixture.isComplete"
            class="border-border text-ink hover:border-accent aria-disabled:text-ink-subtle flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-md border px-4 py-3 font-medium transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            type="button"
            @click="award(player)"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                :class="['size-2.5 shrink-0 rounded-full', index === 0 ? 'bg-player-1' : 'bg-player-2']"
              />

              <span class="truncate">{{ player.name }}</span>
            </span>

            <Icon
              aria-hidden="true"
              class="size-4 shrink-0"
              name="lucide:plus"
            />
          </button>
        </div>

        <div class="mt-3 flex items-center gap-2">
          <button
            aria-label="Undo last rally"
            :aria-disabled="!hasChanges"
            class="border-border text-ink-muted hover:text-ink aria-disabled:text-ink-subtle flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            title="Undo last rally"
            type="button"
            @click="undo"
          >
            <Icon
              aria-hidden="true"
              class="size-4"
              name="lucide:undo-2"
            />

            <span class="text-body-sm">Undo</span>
          </button>

          <button
            aria-label="Reset scoring demo"
            :aria-disabled="!hasChanges"
            class="text-ink-muted hover:text-ink aria-disabled:text-ink-subtle flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            title="Reset scoring demo"
            type="button"
            @click="reset"
          >
            <Icon
              aria-hidden="true"
              class="size-4"
              name="lucide:rotate-ccw"
            />

            <span class="text-body-sm">Reset</span>
          </button>
        </div>
      </div>
    </div>

    <figcaption class="text-ink-subtle text-body-sm mt-4 text-center">
      {{ fixture.settingsCaption }}
    </figcaption>
  </figure>
</template>

<style scoped>
.table {
  display: block;
  width: 100%;
  height: auto;
  max-height: 420px;
  margin-inline: auto;
  font-family: var(--font-body);
}

.table__felt {
  fill: var(--color-brand-soft);
}

.table__edge {
  fill: none;
  stroke: var(--color-brand);
  stroke-width: 2.5;
}

.table__centre {
  stroke: var(--color-brand);
  stroke-width: 1;
  opacity: 0.45;
}

.table__net {
  stroke: var(--color-brand);
  stroke-width: 3;
  stroke-linecap: round;
}

.table__name {
  fill: var(--color-ink);
  font-size: 18px;
  font-weight: 500;
}

.table__player--near {
  fill: var(--color-player-1);
}

.table__player--far {
  fill: var(--color-player-2);
}

/* the ball marks the server; it pulses rather than travels, so it reads as a state and not as a rally */
.table__ball {
  fill: var(--color-accent);
  transform-box: view-box;
  animation: table-pulse 2.4s ease-in-out infinite;
}

.table__ball--near {
  transform-origin: 212px 388px;
}

.table__ball--far {
  transform-origin: 212px 52px;
}

@keyframes table-pulse {
  50% {
    scale: 1.18;
  }
}

@media (prefers-reduced-motion: reduce) {
  .table__ball {
    animation: none;
  }
}
</style>
