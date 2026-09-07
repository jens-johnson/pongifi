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
 * ██████████████████████████████ #components/widgets/features/formats-diagram/index.vue ███████████████████████████████
 *
 * Table formation illustrations for singles, doubles and cutthroat.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import { FEATURES_FORMAT_DESCRIPTIONS } from './constants';
import type { IFeaturesFormatsDiagramProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Component props; the format the diagram illustrates
 * @internal
 * @constant
 */
const props: Readonly<IFeaturesFormatsDiagramProps> = defineProps<IFeaturesFormatsDiagramProps>();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Accessible name for whichever diagram is on show
 * @internal
 * @constant
 */
const label: ComputedRef<string> = computed<string>(
  (): string => `${props.format.charAt(0).toUpperCase()}${props.format.slice(1)} table diagram`,
);
</script>

<template>
  <figure class="w-full">
    <svg
      aria-describedby="format-diagram-description"
      aria-labelledby="format-diagram-title"
      class="diagram"
      role="img"
      viewBox="0 0 560 420"
    >
      <title id="format-diagram-title">{{ label }}</title>

      <desc id="format-diagram-description">{{ FEATURES_FORMAT_DESCRIPTIONS[format] }}</desc>

      <defs>
        <marker
          id="formats-arrow"
          markerHeight="7"
          markerWidth="7"
          orient="auto"
          refX="6"
          refY="3.5"
        >
          <path
            class="diagram__arrowhead"
            d="M 0 0 L 7 3.5 L 0 7 Z"
          />
        </marker>

        <filter
          id="formats-ball-shadow"
          height="180%"
          width="180%"
          x="-40%"
          y="-40%"
        >
          <feDropShadow
            dx="0"
            dy="2"
            flood-opacity="0.3"
            stdDeviation="2"
          />
        </filter>
      </defs>

      <text
        class="diagram__kicker"
        x="24"
        y="28"
      >
        {{ format }} formation
      </text>

      <rect
        class="diagram__felt"
        height="260"
        rx="8"
        width="360"
        x="100"
        y="80"
      />

      <rect
        class="diagram__table"
        height="260"
        rx="8"
        width="360"
        x="100"
        y="80"
      />

      <line
        class="diagram__centre"
        x1="280"
        x2="280"
        y1="80"
        y2="340"
      />

      <line
        class="diagram__net"
        x1="84"
        x2="476"
        y1="210"
        y2="210"
      />

      <template v-if="format === 'singles'">
        <path
          class="diagram__route"
          d="M 280 72 C 230 120 340 160 298 210 C 256 260 340 304 280 348"
        />

        <circle
          class="diagram__ball"
          cx="0"
          cy="0"
          r="8"
          style="offset-path: path('M 280 72 C 230 120 340 160 298 210 C 256 260 340 304 280 348')"
        />

        <g class="diagram__player-group">
          <circle
            class="diagram__player diagram__player--one"
            cx="280"
            cy="55"
            r="24"
          />

          <text
            class="diagram__name"
            text-anchor="middle"
            x="280"
            y="61"
          >
            M
          </text>
        </g>

        <g class="diagram__player-group diagram__player-group--late">
          <circle
            class="diagram__player diagram__player--two"
            cx="280"
            cy="365"
            r="24"
          />

          <text
            class="diagram__name"
            text-anchor="middle"
            x="280"
            y="371"
          >
            S
          </text>
        </g>

        <text
          class="diagram__role"
          text-anchor="end"
          x="244"
          y="60"
        >
          server
        </text>

        <text
          class="diagram__role"
          text-anchor="start"
          x="316"
          y="370"
        >
          receiver
        </text>
      </template>

      <template v-else-if="format === 'doubles'">
        <path
          class="diagram__route"
          d="M 190 72 Q 238 135 370 348"
          marker-end="url(#formats-arrow)"
        />

        <path
          class="diagram__route diagram__route--two"
          d="M 370 348 Q 418 225 370 72"
          marker-end="url(#formats-arrow)"
        />

        <path
          class="diagram__route diagram__route--three"
          d="M 370 72 Q 322 135 190 348"
          marker-end="url(#formats-arrow)"
        />

        <path
          class="diagram__route diagram__route--four"
          d="M 190 348 Q 142 225 190 72"
          marker-end="url(#formats-arrow)"
        />

        <circle
          class="diagram__ball"
          cx="0"
          cy="0"
          r="8"
          style="offset-path: path('M 190 72 Q 238 135 370 348')"
        />

        <g class="diagram__player-group">
          <circle
            class="diagram__player diagram__player--one"
            cx="190"
            cy="55"
            r="24"
          />

          <text
            class="diagram__name"
            text-anchor="middle"
            x="190"
            y="61"
          >
            A1
          </text>
        </g>

        <g class="diagram__player-group diagram__player-group--late">
          <circle
            class="diagram__player diagram__player--one"
            cx="370"
            cy="55"
            r="24"
          />

          <text
            class="diagram__name"
            text-anchor="middle"
            x="370"
            y="61"
          >
            A2
          </text>
        </g>

        <g class="diagram__player-group diagram__player-group--later">
          <circle
            class="diagram__player diagram__player--two"
            cx="190"
            cy="365"
            r="24"
          />

          <text
            class="diagram__name"
            text-anchor="middle"
            x="190"
            y="371"
          >
            B2
          </text>
        </g>

        <g class="diagram__player-group diagram__player-group--latest">
          <circle
            class="diagram__player diagram__player--two"
            cx="370"
            cy="365"
            r="24"
          />

          <text
            class="diagram__name"
            text-anchor="middle"
            x="370"
            y="371"
          >
            B1
          </text>
        </g>

        <g class="diagram__numbers">
          <circle
            cx="233"
            cy="128"
            r="14"
          />

          <text
            x="233"
            y="133"
          >
            1
          </text>

          <circle
            cx="398"
            cy="222"
            r="14"
          />

          <text
            x="398"
            y="227"
          >
            2
          </text>

          <circle
            cx="326"
            cy="128"
            r="14"
          />

          <text
            x="326"
            y="133"
          >
            3
          </text>

          <circle
            cx="162"
            cy="222"
            r="14"
          />

          <text
            x="162"
            y="227"
          >
            4
          </text>
        </g>
      </template>

      <template v-else>
        <path
          class="diagram__route"
          d="M 302 72 Q 438 142 378 340"
          marker-end="url(#formats-arrow)"
        />

        <path
          class="diagram__route diagram__route--two"
          d="M 350 372 Q 280 410 210 372"
          marker-end="url(#formats-arrow)"
        />

        <path
          class="diagram__route diagram__route--three"
          d="M 182 340 Q 122 142 258 72"
          marker-end="url(#formats-arrow)"
        />

        <circle
          class="diagram__ball"
          cx="0"
          cy="0"
          r="8"
          style="offset-path: path('M 280 78 C 258 145 190 174 216 236 C 242 298 338 298 354 342')"
        />

        <g class="diagram__player-group">
          <circle
            class="diagram__server-ring"
            cx="280"
            cy="55"
            r="31"
          />

          <circle
            class="diagram__player diagram__player--one"
            cx="280"
            cy="55"
            r="24"
          />

          <text
            class="diagram__name"
            text-anchor="middle"
            x="280"
            y="61"
          >
            M
          </text>
        </g>

        <g class="diagram__player-group diagram__player-group--late">
          <circle
            class="diagram__player diagram__player--two"
            cx="200"
            cy="365"
            r="24"
          />

          <text
            class="diagram__name"
            text-anchor="middle"
            x="200"
            y="371"
          >
            S
          </text>
        </g>

        <g class="diagram__player-group diagram__player-group--later">
          <circle
            class="diagram__player diagram__player--three"
            cx="360"
            cy="365"
            r="24"
          />

          <text
            class="diagram__name diagram__name--dark"
            text-anchor="middle"
            x="360"
            y="371"
          >
            L
          </text>
        </g>

        <text
          class="diagram__role"
          text-anchor="end"
          x="238"
          y="60"
        >
          server +1
        </text>

        <text
          class="diagram__role"
          text-anchor="middle"
          x="280"
          y="405"
        >
          receiving pair
        </text>
      </template>
    </svg>
  </figure>
</template>

<style scoped>
.diagram {
  display: block;
  width: 100%;
  height: auto;
  max-height: 420px;
  font-family: var(--font-body);
}

.diagram__kicker,
.diagram__role {
  fill: var(--color-brand-soft-ink);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
}

.diagram__felt {
  fill: var(--color-table-felt);
}

.diagram__table,
.diagram__centre,
.diagram__net {
  fill: none;
  stroke: var(--color-table-line);
}

.diagram__table {
  stroke-width: 3;
}

.diagram__centre {
  stroke-width: 1.5;
  opacity: 0.55;
}

.diagram__net {
  stroke-width: 5;
  stroke-linecap: round;
}

.diagram__route {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 3;
  stroke-dasharray: 7 8;
  stroke-linecap: round;
  animation: formats-route 650ms ease-out backwards;
}

.diagram__route--two {
  animation-delay: 100ms;
}

.diagram__route--three {
  animation-delay: 200ms;
}

.diagram__route--four {
  animation-delay: 300ms;
}

.diagram__arrowhead,
.diagram__ball {
  fill: var(--color-accent);
}

.diagram__ball {
  filter: url('#formats-ball-shadow');
  offset-distance: 0%;
  offset-rotate: 0deg;
  transform-box: view-box;
  transform-origin: 0 0;
  animation: formats-ball 3.2s ease-in-out infinite alternate;
}

.diagram__player-group {
  transform-box: fill-box;
  transform-origin: center;
  animation: formats-player 420ms ease-out backwards;
}

.diagram__player-group--late {
  animation-delay: 80ms;
}

.diagram__player-group--later {
  animation-delay: 160ms;
}

.diagram__player-group--latest {
  animation-delay: 240ms;
}

.diagram__player {
  stroke: var(--color-surface);
  stroke-width: 3;
}

.diagram__player--one {
  fill: var(--color-player-1);
}

.diagram__player--two {
  fill: var(--color-player-2);
}

.diagram__player--three {
  fill: var(--color-player-3);
}

.diagram__server-ring {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 3;
  animation: formats-server 1.8s ease-in-out infinite;
}

.diagram__name {
  fill: var(--color-ink-inverse);
  font-size: 14px;
  font-weight: 700;
}

.diagram__name--dark {
  fill: var(--color-accent-ink);
}

.diagram__numbers circle {
  fill: var(--color-surface);
  stroke: var(--color-border-strong);
}

.diagram__numbers text {
  fill: var(--color-ink);
  font-size: 13px;
  font-weight: 700;
  text-anchor: middle;
}

@keyframes formats-route {
  from {
    opacity: 0;
    stroke-dashoffset: 48;
  }
}

@keyframes formats-ball {
  to {
    offset-distance: 100%;
  }
}

@keyframes formats-player {
  from {
    opacity: 0;
    transform: scale(0.65);
  }
}

@keyframes formats-server {
  50% {
    opacity: 0.45;
    transform: scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .diagram__route,
  .diagram__ball,
  .diagram__player-group,
  .diagram__server-ring {
    animation: none;
  }

  .diagram__ball {
    offset-distance: 52%;
  }
}
</style>
