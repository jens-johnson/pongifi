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
 * ████████████████████████████████████ #components/widgets/marketing/cta/index.vue ████████████████████████████████████
 *
 * Authentication-aware marketing call to action shared across public pages.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsMarketingCta :show-faq="true" />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • compact
 *     - Description: render only the primary command
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *   • showFaq
 *     - Description: offer the FAQ beside the primary command
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { TPropsWithDefaults } from '@jens-johnson/style-guide/types/vue';
import type { ComputedRef } from 'vue';

import type { IMarketingCtaProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Presentation options for compact and full call-to-action placements.
 * @internal
 * @constant
 */
const props: TPropsWithDefaults<IMarketingCtaProps, 'compact' | 'showFaq'> = withDefaults(
  defineProps<IMarketingCtaProps>(),
  { compact: false, showFaq: false },
);

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The current session state used to choose the destination and label.
 * @internal
 * @constant
 */
const { loggedIn }: ReturnType<typeof useUserSession> = useUserSession();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The destination appropriate to the visitor's authentication state.
 * @internal
 * @constant
 */
const destination: ComputedRef<string> = computed((): string => (loggedIn.value ? LEAGUES_ROUTE : SIGN_IN_ROUTE));

/**
 * The primary command label appropriate to the visitor's authentication state.
 * @internal
 * @constant
 */
const label: ComputedRef<string> = computed((): string => (loggedIn.value ? 'Back to your leagues' : 'Start a league'));
</script>

<template>
  <div :class="props.compact ? 'mt-8' : 'border-border bg-surface rounded-lg border p-6 md:p-10'">
    <template v-if="!props.compact">
      <h2 class="font-display text-h2 font-medium tracking-tight">
        {{ loggedIn ? 'Back to your leagues' : 'Ready for a real leaderboard?' }}
      </h2>

      <p class="text-ink-muted text-body mt-3">
        {{
          loggedIn
            ? 'See the leagues you play in and pick up where you left off.'
            : 'Start a league, invite the people you already play against, and let the table settle it.'
        }}
      </p>
    </template>

    <div
      class="flex flex-wrap items-center gap-x-6 gap-y-4"
      :class="props.compact ? '' : 'mt-6'"
    >
      <NuxtLink
        class="bg-accent text-accent-ink hover:bg-accent-hover text-body-lg inline-flex items-center gap-2 rounded-md px-6 py-3 font-medium transition-colors"
        :to="destination"
      >
        {{ label }}

        <Icon
          aria-hidden="true"
          class="size-4"
          name="lucide:arrow-right"
        />
      </NuxtLink>

      <NuxtLink
        v-if="props.showFaq"
        class="text-accent-strong hover:text-accent text-body font-medium transition-colors"
        :to="FAQ_ROUTE"
      >
        Questions? Read the FAQ
      </NuxtLink>
    </div>
  </div>
</template>
