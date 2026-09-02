<script lang="ts">
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
 * █████████████████████████████████████████ #components/DifferenceDiagram.vue █████████████████████████████████████████
 *
 * The three illustrations behind the What Makes It Different carousel, drawn as animated SVG.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
/** Which of the three claims the diagram illustrates. */
export type TDifferenceDiagram = 'agreed' | 'ratings' | 'rules';
</script>

<script setup lang="ts">
/**
 *
 */
interface IProps {
  /** Which of the three claims the diagram illustrates. */
  variant: TDifferenceDiagram;
}

defineProps<IProps>();
</script>

<template>
  <!-- the diagram is remounted on each slide change, which is what replays the draw-in animations -->
  <svg
    aria-hidden="true"
    class="diagram"
    viewBox="0 0 400 200"
  >
    <!-- ── Scores are agreed upon ─────────────────────────────────────────────────────────────────────────────── -->
    <template v-if="variant === 'agreed'">
      <circle
        class="diagram__player diagram__player--one"
        cx="52"
        cy="100"
        r="24"
      />

      <circle
        class="diagram__player diagram__player--two"
        cx="348"
        cy="100"
        r="24"
      />

      <line
        class="diagram__thread"
        x1="80"
        x2="140"
        y1="100"
        y2="100"
      />

      <line
        class="diagram__thread diagram__thread--late"
        x1="260"
        x2="320"
        y1="100"
        y2="100"
      />

      <rect
        class="diagram__card"
        height="78"
        rx="12"
        width="112"
        x="144"
        y="61"
      />

      <text
        class="diagram__score"
        text-anchor="middle"
        x="200"
        y="103"
      >
        11–9
      </text>

      <g class="diagram__seal">
        <circle
          class="diagram__seal-disc"
          cx="252"
          cy="69"
          r="15"
        />

        <path
          class="diagram__seal-tick"
          d="M 245 69 L 250 74 L 260 64"
        />
      </g>

      <text
        class="diagram__caption"
        text-anchor="middle"
        x="200"
        y="166"
      >
        confirmed by both players
      </text>
    </template>

    <!-- ── True to the rules ──────────────────────────────────────────────────────────────────────────────────── -->
    <template v-else-if="variant === 'rules'">
      <rect
        class="diagram__felt"
        height="112"
        rx="3"
        width="320"
        x="40"
        y="40"
      />

      <rect
        class="diagram__table"
        height="112"
        rx="3"
        width="320"
        x="40"
        y="40"
      />

      <line
        class="diagram__centre"
        x1="40"
        x2="360"
        y1="96"
        y2="96"
      />

      <line
        class="diagram__net"
        x1="200"
        x2="200"
        y1="30"
        y2="162"
      />

      <!-- doubles service: right half-court to the diagonally opposite right half-court -->
      <path
        class="diagram__serve"
        d="M 296 128 Q 200 78 116 66"
        marker-end="url(#diagram-arrow)"
      />

      <circle
        class="diagram__mark"
        cx="296"
        cy="128"
        r="5"
      />

      <circle
        class="diagram__mark diagram__mark--late"
        cx="116"
        cy="66"
        r="5"
      />

      <defs>
        <marker
          id="diagram-arrow"
          markerHeight="6"
          markerWidth="6"
          orient="auto"
          refX="5"
          refY="3"
        >
          <path
            class="diagram__arrowhead"
            d="M 0 0 L 6 3 L 0 6 Z"
          />
        </marker>
      </defs>

      <text
        class="diagram__caption"
        text-anchor="middle"
        x="200"
        y="186"
      >
        diagonal service, doubles
      </text>
    </template>

    <!-- ── Ratings that move for the right reasons ────────────────────────────────────────────────────────────── -->
    <template v-else>
      <line
        class="diagram__axis"
        x1="40"
        x2="360"
        y1="170"
        y2="170"
      />

      <polyline
        class="diagram__trace diagram__trace--fading"
        points="40,84 95,88 150,92 205,96 260,138 315,143 360,146"
      />

      <polyline
        class="diagram__trace diagram__trace--rising"
        points="40,148 95,142 150,136 205,130 260,70 315,64 360,58"
      />

      <circle
        class="diagram__pivot"
        cx="260"
        cy="70"
        r="6"
      />

      <text
        class="diagram__delta"
        text-anchor="middle"
        x="260"
        y="46"
      >
        +24
      </text>

      <text
        class="diagram__caption"
        text-anchor="middle"
        x="200"
        y="190"
      >
        one win over a stronger opponent
      </text>
    </template>
  </svg>
</template>

<style scoped>
.diagram {
  display: block;
  width: 100%;
  height: auto;
  font-family: var(--font-body);
}

.diagram__caption {
  fill: var(--color-ink-subtle);
  font-size: 12px;
}

/* ── Scores are agreed upon ──────────────────────────────────────────────────────────────────────────────────── */

.diagram__player {
  animation: diagram-rise 500ms ease-out backwards;
}

.diagram__player--one {
  fill: var(--color-player-1);
}

.diagram__player--two {
  fill: var(--color-player-2);
  animation-delay: 120ms;
}

.diagram__thread {
  stroke: var(--color-border-strong);
  stroke-width: 2;
  stroke-dasharray: 4 5;
  animation: diagram-draw 500ms ease-out 300ms backwards;
}

.diagram__thread--late {
  animation-delay: 700ms;
}

.diagram__card {
  fill: var(--color-surface);
  stroke: var(--color-border);
  stroke-width: 2;
  animation: diagram-rise 500ms ease-out 200ms backwards;
}

.diagram__score {
  fill: var(--color-ink);
  font-size: 26px;
  font-weight: 500;
  animation: diagram-fade 400ms ease-out 400ms backwards;
}

.diagram__seal {
  transform-box: view-box;
  transform-origin: 252px 69px;
  animation: diagram-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 1100ms backwards;
}

.diagram__seal-disc {
  fill: var(--color-positive);
}

.diagram__seal-tick {
  fill: none;
  stroke: var(--color-surface);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ── True to the rules ───────────────────────────────────────────────────────────────────────────────────────── */

.diagram__felt {
  fill: var(--color-brand-soft);
}

.diagram__table {
  fill: none;
  stroke: var(--color-brand);
  stroke-width: 2;
}

.diagram__centre {
  stroke: var(--color-brand);
  stroke-width: 1;
  opacity: 0.4;
}

.diagram__net {
  stroke: var(--color-brand);
  stroke-width: 3;
  stroke-linecap: round;
}

.diagram__serve {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 6 6;
  animation: diagram-draw 900ms ease-out 200ms backwards;
}

.diagram__arrowhead {
  fill: var(--color-accent);
}

.diagram__mark {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2;
  animation: diagram-fade 400ms ease-out 200ms backwards;
}

.diagram__mark--late {
  animation-delay: 1000ms;
}

/* ── Ratings that move for the right reasons ─────────────────────────────────────────────────────────────────── */

.diagram__axis {
  stroke: var(--color-border);
  stroke-width: 1.5;
}

.diagram__trace {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;

  /* the dash array is the trace's own length, so the offset animation reads as the line being drawn */
  stroke-dasharray: 420;
  animation: diagram-trace 1100ms ease-out backwards;
}

.diagram__trace--rising {
  stroke: var(--color-accent);
}

.diagram__trace--fading {
  stroke: var(--color-ink-subtle);
  stroke-width: 2;
  opacity: 0.55;
  animation-delay: 150ms;
}

.diagram__pivot {
  fill: var(--color-accent);
  animation: diagram-fade 400ms ease-out 900ms backwards;
}

.diagram__delta {
  fill: var(--color-accent-strong);
  font-size: 15px;
  font-weight: 500;
  animation: diagram-rise 400ms ease-out 1000ms backwards;
}

/* ── Shared keyframes ────────────────────────────────────────────────────────────────────────────────────────── */

@keyframes diagram-fade {
  from {
    opacity: 0;
  }
}

@keyframes diagram-rise {
  from {
    opacity: 0;
    translate: 0 10px;
  }
}

@keyframes diagram-pop {
  from {
    opacity: 0;
    scale: 0.3;
  }
}

@keyframes diagram-draw {
  from {
    stroke-dashoffset: 70;
    opacity: 0;
  }
}

@keyframes diagram-trace {
  from {
    stroke-dashoffset: 420;
  }
}

@media (prefers-reduced-motion: reduce) {
  .diagram *,
  .diagram {
    animation: none !important;
  }
}
</style>
