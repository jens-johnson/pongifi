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
 * █████████████████████████████████████ #components/widgets/faq/content/index.vue █████████████████████████████████████
 *
 * Accessible FAQ content with group navigation and stable question links.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsFaqContent />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref, ShallowRef } from 'vue';
import type { Router } from 'vue-router';

import { FAQ_CONTACT_URL, FAQ_GROUPS, TOP_THIRD_BAND } from './constants';
import type { IFaqGroup } from './types';
import { replaceFaqFragment } from './utils';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The group currently crossing the viewport's top third.
 * @internal
 * @constant
 */
const activeGroupId: Ref<string | null> = ref(null);

/**
 * Whether scrolling motion is welcome.
 * @internal
 * @constant
 */
const isMotionEnabled: Ref<boolean> = ref(false);

/**
 * The observer tracking FAQ groups against the viewport.
 * @internal
 * @constant
 */
const observer: ShallowRef<IntersectionObserver | null> = shallowRef(null);

/**
 * The application router used for fragment navigation.
 * @internal
 * @constant
 */
const router: Router = useRouter();

/**
 * The horizontal navigation row.
 * @internal
 * @constant
 */
const scroller: Ref<HTMLElement | null> = ref(null);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The scroll behavior allowed by the reader's motion preference.
 * @internal
 * @constant
 */
const scrollBehavior: ComputedRef<ScrollBehavior> = computed<ScrollBehavior>((): ScrollBehavior =>
  isMotionEnabled.value ? 'smooth' : 'auto',
);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Centers the active group link within the horizontal navigation row.
 * @internal
 * @function
 */
function centerActiveNavigationItem(): void {
  const row: HTMLElement | null = scroller.value;

  if (row === null || activeGroupId.value === null) {
    return;
  }

  const item: HTMLElement | null = row.querySelector<HTMLElement>(`[data-group='${activeGroupId.value}']`);

  if (item === null) {
    return;
  }

  row.scrollTo({
    behavior: scrollBehavior.value,
    left: item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2,
  });
}

/**
 * Moves focus to the heading associated with the current fragment.
 * @internal
 * @function
 */
function focusCurrentFragment(): void {
  const fragment: string = window.location.hash.slice(1);

  if (fragment === '') {
    return;
  }

  document.getElementById(`${fragment}-heading`)?.focus({ preventScroll: true });
}

/**
 * Navigates to a group while preserving native behavior for modified clicks.
 * @internal
 * @function
 * @param groupId - Stable fragment identifier of the selected FAQ group
 * @param event - Pointer event raised by the group link
 */
async function onSelectGroup(groupId: string, event: MouseEvent): Promise<void> {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const group: HTMLElement | null = document.getElementById(groupId);

  if (group === null) {
    return;
  }

  event.preventDefault();
  await replaceFaqFragment(router, groupId);
  group.scrollIntoView({ behavior: scrollBehavior.value, block: 'start' });
  focusCurrentFragment();
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

watch(activeGroupId, centerActiveNavigationItem);

onMounted((): void => {
  isMotionEnabled.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  observer.value = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]): void => {
      const crossing: IntersectionObserverEntry | undefined = entries.find(
        (entry: IntersectionObserverEntry): boolean => entry.isIntersecting,
      );

      if (crossing !== undefined) {
        activeGroupId.value = crossing.target.id;
      }
    },
    { rootMargin: TOP_THIRD_BAND },
  );

  FAQ_GROUPS.forEach((group: IFaqGroup): void => {
    const element: HTMLElement | null = document.getElementById(group.id);

    if (element !== null) {
      observer.value?.observe(element);
    }
  });

  window.addEventListener('hashchange', focusCurrentFragment);
  focusCurrentFragment();
});

onBeforeUnmount((): void => {
  observer.value?.disconnect();
  observer.value = null;
  window.removeEventListener('hashchange', focusCurrentFragment);
});
</script>

<template>
  <main>
    <!-- Page introduction -->
    <section class="px-6 pt-12 pb-12 md:px-16 md:pt-22 md:pb-16">
      <div class="mx-auto max-w-[680px]">
        <p class="text-accent-strong text-body-sm font-medium">FAQ</p>

        <h1 class="font-display text-display mt-3 font-medium">The Questions We Expect First</h1>

        <p class="text-ink-muted text-body-lg mt-6">
          Short answers to the things people ask most. If yours is not here,
          <a
            class="text-accent-strong hover:text-accent focus-visible:outline-accent rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
            :href="FAQ_CONTACT_URL"
          >
            we would like to hear it.
          </a>
        </p>
      </div>
    </section>

    <!-- Group navigation -->
    <nav
      aria-label="FAQ groups"
      class="border-border bg-bg/90 sticky top-0 z-40 border-y backdrop-blur"
    >
      <div
        ref="scroller"
        class="faq-navigation mx-auto flex max-w-[880px] gap-2 overflow-x-auto px-6 py-2 md:justify-center md:gap-1 md:overflow-visible md:px-16 md:py-0"
      >
        <a
          v-for="group in FAQ_GROUPS"
          :key="group.id"
          :aria-current="activeGroupId === group.id ? 'location' : undefined"
          :class="
            activeGroupId === group.id
              ? 'border-accent bg-accent/10 text-accent-strong md:bg-transparent'
              : 'text-ink-muted hover:text-ink border-transparent'
          "
          class="focus-visible:outline-accent text-body-sm shrink-0 rounded-full border px-4 py-1.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 md:rounded-none md:border-0 md:border-b-2 md:px-4 md:py-4"
          :data-group="group.id"
          :href="`#${group.id}`"
          @click="onSelectGroup(group.id, $event)"
        >
          {{ group.navigationLabel }}
        </a>
      </div>
    </nav>

    <!-- Question groups -->
    <div class="px-6 pt-4 pb-18 md:px-16 md:pt-8 md:pb-28">
      <div class="mx-auto max-w-[680px]">
        <section
          v-for="group in FAQ_GROUPS"
          :id="group.id"
          :key="group.id"
          :aria-labelledby="`${group.id}-heading`"
          class="border-border scroll-mt-20 border-b py-12 first:pt-8 last:border-b-0 md:scroll-mt-24 md:py-16"
        >
          <h2
            :id="`${group.id}-heading`"
            class="font-display text-h2 focus-visible:outline-accent rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4"
            tabindex="-1"
          >
            {{ group.label }}
          </h2>

          <div class="mt-8 space-y-10 md:mt-10 md:space-y-12">
            <article
              v-for="question in group.questions"
              :id="question.id"
              :key="question.id"
              :aria-labelledby="`${question.id}-heading`"
              class="scroll-mt-20 md:scroll-mt-24"
            >
              <h3
                :id="`${question.id}-heading`"
                class="font-display text-h3 focus-visible:outline-accent rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4"
                tabindex="-1"
              >
                {{ question.question }}
              </h3>

              <p class="text-ink-muted text-body mt-3">{{ question.answer }}</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.faq-navigation {
  scrollbar-width: none;
  mask-image: linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent);
}

.faq-navigation::-webkit-scrollbar {
  display: none;
}

@media (width >= 48rem) {
  .faq-navigation {
    mask-image: none;
  }
}
</style>
