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
 * ████████████████████████████████████████████ #components/AboutRally.vue █████████████████████████████████████████████
 *
 * The About page hero: a table drawn in perspective, with a ball looping a rally across the net.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
/** Maximum tilt, in degrees, reached at the far edge of the visual. */
const TILT_DEGREES: number = 7;

/** The element the pointer is measured against. */
const surface = ref<HTMLElement | null>(null);

/** Current tilt about the horizontal axis. */
const tiltX = ref<number>(0);

/** Current tilt about the vertical axis. */
const tiltY = ref<number>(0);

/** Whether the tilt responds at all. Pointer-driven parallax is a vestibular trigger, so it is opt-out. */
const tilting = ref<boolean>(false);

/**
 * Leans the table towards the pointer.
 *
 * The offsets are normalised to -0.5..0.5 across the element so the tilt is the same at every viewport width.
 */
const track = (event: PointerEvent): void => {
  const element: HTMLElement | null = surface.value;

  if (element === null || !tilting.value) {
    return;
  }

  const bounds: DOMRect = element.getBoundingClientRect();
  const offsetX: number = (event.clientX - bounds.left) / bounds.width - 0.5;
  const offsetY: number = (event.clientY - bounds.top) / bounds.height - 0.5;

  // a positive horizontal offset should swing the far edge away, which is a positive rotation about Y
  tiltY.value = offsetX * TILT_DEGREES * 2;
  tiltX.value = -offsetY * TILT_DEGREES * 2;
};

/**
 * Returns the table to square when the pointer leaves.
 */
const rest = (): void => {
  tiltX.value = 0;
  tiltY.value = 0;
};

onMounted((): void => {
  tilting.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
});
</script>

<template>
  <div
    ref="surface"
    class="rally"
    @pointerleave="rest"
    @pointermove="track"
  >
    <svg
      aria-hidden="true"
      class="rally__stage"
      :style="{ transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)` }"
      viewBox="0 0 560 380"
    >
      <!-- the table, drawn down its length: the far edge is short, the near edge is wide -->
      <path
        class="rally__felt"
        d="M 170 110 L 390 110 L 520 300 L 40 300 Z"
      />

      <path
        class="rally__line"
        d="M 170 110 L 390 110 L 520 300 L 40 300 Z"
      />

      <line
        class="rally__line rally__line--centre"
        x1="280"
        x2="280"
        y1="110"
        y2="300"
      />

      <!-- the net sits at half the table's depth, where the perspective has widened it to 105..455 -->
      <line
        class="rally__net-cord"
        x1="99"
        x2="461"
        y1="181"
        y2="181"
      />

      <path
        class="rally__net"
        d="M 105 205 L 455 205 L 461 181 L 99 181 Z"
      />

      <!-- bounce marks, timed to the two moments the ball meets the table -->
      <circle
        class="rally__bounce"
        cx="170"
        cy="272"
        r="6"
      />

      <circle
        class="rally__bounce rally__bounce--far"
        cx="382"
        cy="152"
        r="5"
      />

      <!-- the trail is the same animation run fractionally behind the ball -->
      <circle
        class="rally__ball rally__ball--trail rally__ball--trail-3"
        r="5"
      />

      <circle
        class="rally__ball rally__ball--trail rally__ball--trail-2"
        r="6"
      />

      <circle
        class="rally__ball rally__ball--trail rally__ball--trail-1"
        r="6.5"
      />

      <circle
        class="rally__ball"
        r="7"
      />
    </svg>
  </div>
</template>

<style scoped>
.rally {
  perspective: 900px;
}

.rally__stage {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  transition: transform 400ms ease-out;
}

.rally__felt {
  fill: var(--color-brand-soft);
}

.rally__line {
  fill: none;
  stroke: var(--color-brand);
  stroke-width: 2.5;
  stroke-linejoin: round;
}

.rally__line--centre {
  stroke-width: 1;
  opacity: 0.45;
}

.rally__net {
  fill: var(--color-brand);
  opacity: 0.22;
}

.rally__net-cord {
  stroke: var(--color-brand);
  stroke-width: 2.5;
}

.rally__ball {
  fill: var(--color-accent);
  offset-path: path('M 170 272 C 200 150 330 100 382 152 C 400 230 280 300 170 272');
  offset-rotate: 0deg;
  transform-box: view-box;
  transform-origin: 0 0;
  animation: rally-travel 3.6s linear infinite;
}

.rally__ball--trail {
  opacity: 0.4;
}

.rally__ball--trail-1 {
  animation-delay: -3.54s;
}

.rally__ball--trail-2 {
  animation-delay: -3.48s;
  opacity: 0.26;
}

.rally__ball--trail-3 {
  animation-delay: -3.42s;
  opacity: 0.14;
}

.rally__bounce {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2;
  transform-box: view-box;
  transform-origin: 170px 272px;
  animation: rally-bounce 3.6s ease-out infinite;
}

.rally__bounce--far {
  transform-origin: 382px 152px;
  animation-delay: 1.8s;
}

@keyframes rally-travel {
  to {
    offset-distance: 100%;
  }
}

@keyframes rally-bounce {
  0% {
    opacity: 0.9;
    transform: scale(0.4);
  }

  30% {
    opacity: 0;
    transform: scale(2.4);
  }

  100% {
    opacity: 0;
    transform: scale(2.4);
  }
}

/* the rally is decoration; without motion it becomes a still of a ball mid-rally */
@media (prefers-reduced-motion: reduce) {
  .rally__ball,
  .rally__bounce {
    animation: none;
  }

  .rally__ball {
    offset-distance: 32%;
  }

  .rally__bounce {
    opacity: 0.5;
  }

  .rally__stage {
    transition: none;
  }
}
</style>
