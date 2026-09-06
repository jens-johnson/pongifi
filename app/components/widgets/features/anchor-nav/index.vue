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
 * █████████████████████████████████████████ #components/FeaturesAnchorNav.vue █████████████████████████████████████████
 *
 * Sticky, accessible navigation between the five Features page sections.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
/* ─── Types ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** One entry in the navigation: the section it points at and the label it shows. */
interface ISectionLink {
  /* The section's `id`, which is also the fragment the link carries */
  id: string;

  /* The label on the chip */
  label: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The five sections, in page order. Each `id` is matched by a section on the page and a heading `${id}-heading`. */
const SECTIONS: readonly ISectionLink[] = [
  { id: 'scoring', label: 'Scoring' },
  { id: 'formats', label: 'Formats' },
  { id: 'league', label: 'Your league' },
  { id: 'trust', label: 'Trust' },
  { id: 'ratings', label: 'Ratings' },
];

/**
 * The observation band, expressed as a root margin: a zero-height line across the viewport's top third. A section
 * intersects it exactly while it is the one crossing that line, which is the active-state rule in the specification.
 */
const TOP_THIRD_BAND: string = '-32% 0px -66% 0px';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The section currently crossing the top third, or null while the reader is still above the first one. */
const active = ref<string | null>(null);

/** The scrolling row the chips sit in; the active chip is centered inside it rather than in the viewport. */
const scroller = ref<HTMLElement | null>(null);

/** Whether motion is welcome. Set on mount, because the query needs a window. */
const animating = ref<boolean>(false);

/** Watches the sections; held so it can be disconnected. */
let observer: IntersectionObserver | null = null;

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** How a scroll should behave, given the reader's motion preference. */
const behavior = computed<ScrollBehavior>((): ScrollBehavior => (animating.value ? 'smooth' : 'auto'));

/* ─── Functions ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Brings the active chip into view inside its own row.
 *
 * `scrollIntoView` would satisfy the horizontal scroll but is also entitled to scroll the page to do it, which would
 * fight the reader. Setting `scrollLeft` on the row cannot move anything else.
 */
const centerActiveChip = (): void => {
  const row: HTMLElement | null = scroller.value;

  if (row === null || active.value === null) {
    return;
  }

  const chip: HTMLElement | null = row.querySelector<HTMLElement>(`[data-section='${active.value}']`);

  if (chip === null) {
    return;
  }

  row.scrollTo({ behavior: behavior.value, left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2 });
};

/**
 * Sends the reader to a section and puts their focus on its heading.
 *
 * The links are real fragment links, so they survive without JavaScript and can be copied. Handling the click is what
 * adds the two things the browser does not do: focus lands on the destination heading rather than staying on the chip,
 * and the fragment is recorded without the instant jump that assigning to `location.hash` causes.
 */
const onSelect = (id: string, event: MouseEvent): void => {
  // a modified click is a request to open the link some other way, and belongs to the browser
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const section: HTMLElement | null = document.getElementById(id);

  if (section === null) {
    return;
  }

  event.preventDefault();

  window.history.replaceState(null, '', `#${id}`);
  section.scrollIntoView({ behavior: behavior.value, block: 'start' });

  // the heading carries tabindex="-1" for exactly this; preventScroll leaves the smooth scroll above in charge
  document.getElementById(`${id}-heading`)?.focus({ preventScroll: true });
};

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

watch(active, centerActiveChip);

onMounted((): void => {
  animating.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  observer = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]): void => {
      const crossing: IntersectionObserverEntry | undefined = entries.find(
        (entry: IntersectionObserverEntry): boolean => entry.isIntersecting,
      );

      if (crossing !== undefined) {
        active.value = crossing.target.id;
      }
    },
    { rootMargin: TOP_THIRD_BAND },
  );

  /**
   * The sections are rendered by siblings that mount after this one, so they are not in the document yet. Waiting a
   * tick is what makes them findable.
   */
  void nextTick((): void => {
    SECTIONS.forEach((section: ISectionLink): void => {
      const element: HTMLElement | null = document.getElementById(section.id);

      if (element !== null) {
        observer?.observe(element);
      }
    });
  });
});

onBeforeUnmount((): void => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <!--
    Sticky against the top of the viewport rather than under the site header, which does not stick. Sections carry a
    matching scroll-margin-top so an anchored heading clears this bar.
  -->
  <nav
    aria-label="Sections of this page"
    class="border-border bg-bg/85 sticky top-0 z-40 border-y backdrop-blur"
  >
    <div
      ref="scroller"
      class="nav__row mx-auto flex max-w-[1120px] gap-2 overflow-x-auto px-6 py-2 md:justify-center md:gap-1 md:overflow-visible md:px-16 md:py-0"
    >
      <a
        v-for="section in SECTIONS"
        :key="section.id"
        :aria-current="active === section.id ? 'true' : undefined"
        :class="
          active === section.id
            ? 'border-accent bg-accent/10 text-accent-strong md:bg-transparent'
            : 'text-ink-muted hover:text-ink border-transparent'
        "
        class="text-body-sm shrink-0 rounded-full border px-4 py-1.5 whitespace-nowrap transition-colors md:rounded-none md:border-0 md:border-b-2 md:px-4 md:py-4"
        :data-section="section.id"
        :href="`#${section.id}`"
        @click="onSelect(section.id, $event)"
      >
        {{ section.label }}
      </a>
    </div>
  </nav>
</template>

<style scoped>
/*
 * The row scrolls on small screens, so its ends are faded to show there is more to reach. Above md the row fits and
 * the mask is removed, or it would clip the first and last labels.
 */
.nav__row {
  scrollbar-width: none;
  mask-image: linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent);
}

.nav__row::-webkit-scrollbar {
  display: none;
}

@media (width >= 48rem) {
  .nav__row {
    mask-image: none;
  }
}
</style>
