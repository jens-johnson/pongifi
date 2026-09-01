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
 * ████████████████████████████████████████████ #components/HowItWorks.vue █████████████████████████████████████████████
 *
 * The four step explainer, as a tablist that advances on its own until someone picks a step.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
interface IStep {
  body: string;
  icon: string;
  label: string;
  title: string;
}

/**
 *
 */
const STEPS: readonly IStep[] = [
  {
    body: 'Name it, set the rules once, and decide who can record results. Everything after this inherits those settings.',
    icon: 'lucide:trophy',
    label: 'Create a league',
    title: 'Create a league',
  },
  {
    body: 'Share a link or a QR code. They sign in with Google and they are in — no accounts to set up, no passwords to forget.',
    icon: 'lucide:user-plus',
    label: 'Invite your friends',
    title: 'Invite your friends',
  },
  {
    body: 'Score live at the table, or enter a result afterwards. Every game is confirmed by the person you played, so the numbers hold up.',
    icon: 'lucide:clipboard-check',
    label: 'Record games',
    title: 'Record games',
  },
  {
    body: 'Ratings update after every confirmed result. Beat someone better than you and it shows — the ladder settles who is actually best.',
    icon: 'lucide:trending-up',
    label: 'Climb the leaderboard',
    title: 'Climb the leaderboard',
  },
];

/** How long each step holds before advancing. */
const DWELL_MS: number = 6000;

/**
 *
 */
const active = ref<number>(0);
/**
 *
 */
const paused = ref<boolean>(false);

/**
 *
 */
let timer: ReturnType<typeof setInterval> | null = null;

/** The step currently expanded. Indexing is always in range; the fallback satisfies the type checker. */
const current = computed<IStep | undefined>((): IStep | undefined => STEPS[active.value]);

/**
 * Moves to a specific step and stops the automatic advance.
 *
 * Once someone has chosen a step, continuing to rotate underneath them would be taking the control back.
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
      active.value = (active.value + 1) % STEPS.length;
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
  <section
    id="how-it-works"
    class="px-16 py-24"
  >
    <div class="mx-auto max-w-[1120px]">
      <h2 class="font-display text-h1 font-medium tracking-tight">How it works</h2>

      <div class="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          class="flex flex-col gap-2"
          role="tablist"
        >
          <button
            v-for="(step, index) in STEPS"
            :id="`how-tab-${index}`"
            :key="step.label"
            :aria-controls="`how-panel-${index}`"
            :aria-selected="active === index"
            :class="
              active === index
                ? 'border-accent bg-surface-raised text-ink'
                : 'text-ink-muted hover:text-ink hover:border-border border-transparent'
            "
            class="flex cursor-pointer items-center gap-4 rounded-lg border-l-2 px-5 py-4 text-left transition-colors"
            role="tab"
            type="button"
            @click="select(index)"
          >
            <span
              :class="active === index ? 'bg-accent text-accent-ink' : 'bg-surface-raised text-ink-subtle'"
              class="text-body-sm flex size-8 shrink-0 items-center justify-center rounded-full font-medium transition-colors"
            >
              {{ index + 1 }}
            </span>

            <span class="text-body-lg font-medium">{{ step.label }}</span>
          </button>
        </div>

        <div
          v-if="current"
          :id="`how-panel-${active}`"
          :aria-labelledby="`how-tab-${active}`"
          class="border-border bg-surface flex flex-col justify-center rounded-xl border p-10"
          role="tabpanel"
        >
          <Icon
            :name="current.icon"
            class="text-accent size-8"
          />

          <h3 class="font-display text-h2 mt-6 font-medium tracking-tight">{{ current.title }}</h3>

          <p class="text-ink-muted text-body-lg mt-4">{{ current.body }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
