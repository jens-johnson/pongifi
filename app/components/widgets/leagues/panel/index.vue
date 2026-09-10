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
 * ████████████████████████████████████ #components/widgets/leagues/panel/index.vue ████████████████████████████████████
 *
 * The player's leagues, with loading, zero, populated and error states.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesPanel show-next-steps />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • showHeading
 *     - Description: render the panel's own heading
 *     - Type: boolean
 *     - Required: false
 *     - Default: true
 *   • showNextSteps
 *     - Description: show the what-happens-next strip under the zero state
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { TPropsWithDefaults } from '@jens-johnson/style-guide/types/vue';
import type { ComputedRef } from 'vue';

import type { ILeagueMembership } from '#shared/profile';
import { AccountReadState, type IAccountReadStateInput } from '~/utils/account/read-state';

import { SKELETON_ROWS } from './constants';
import type { ILeaguesPanelProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Which of the panel's optional parts this placement wants.
 * @internal
 * @constant
 */
const props: TPropsWithDefaults<ILeaguesPanelProps, 'showHeading' | 'showNextSteps'> = withDefaults(
  defineProps<ILeaguesPanelProps>(),
  { showHeading: true, showNextSteps: false },
);

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The player's leagues, with the request status the four states are drawn from.
 * @internal
 * @constant
 */
const {
  data: leagues,
  error,
  refresh,
  status,
}: ReturnType<typeof useFetch<ILeagueMembership[]>> = useFetch<ILeagueMembership[]>('/api/me/leagues');

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the panel draws: the list, its zero state, a skeleton, a retryable failure, or nothing while sign-in is being
 * reached.
 *
 * The panel reads the same private data the profile page does, and its endpoint refuses a session whose account has
 * gone. Without the unauthorized state, that refusal would render as a failure the player could only retry forever
 * @internal
 * @constant
 */
const readState: ComputedRef<AccountReadState> = useAccountReadState((): IAccountReadStateInput => ({
  errorStatusCode: error.value?.statusCode ?? null,
  hasData: Boolean(leagues.value),
  status: status.value,
}));

/**
 * Whether the panel has nothing to show because the player has joined nothing.
 *
 * Read only when there is no error, so a failed request can never be mistaken for an empty one
 * @internal
 * @constant
 */
const empty: ComputedRef<boolean> = computed((): boolean => (leagues.value?.length ?? 0) === 0);
</script>

<template>
  <section class="border-border bg-surface rounded-lg border p-6 md:p-8">
    <div
      v-if="props.showHeading"
      class="flex items-baseline justify-between gap-4"
    >
      <h2 class="font-display text-h3 font-medium tracking-tight">Your leagues</h2>

      <span
        v-if="readState === AccountReadState.READY && (leagues?.length ?? 0) > 1"
        class="text-ink-subtle text-caption"
      >
        {{ leagues?.length }} leagues
      </span>
    </div>

    <!-- Error is checked before empty: a request that failed must never render as "you have no leagues" -->
    <div
      v-if="readState === AccountReadState.FAILED"
      class="mt-6"
      role="alert"
    >
      <p class="text-ink text-body">Could not load your leagues.</p>

      <button
        class="border-border text-ink hover:border-accent text-body-sm mt-4 rounded-md border px-4 py-2 font-medium transition-colors"
        type="button"
        @click="refresh()"
      >
        Retry
      </button>
    </div>

    <!-- Skeletons rather than a spinner, so the panel keeps its height and the layout does not jump -->
    <ul
      v-else-if="readState === AccountReadState.PENDING"
      aria-hidden="true"
      class="mt-6 space-y-3"
    >
      <li
        v-for="row in SKELETON_ROWS"
        :key="row"
        class="bg-surface-raised h-16 animate-pulse rounded-md"
      />
    </ul>

    <div
      v-else-if="readState === AccountReadState.READY && empty"
      class="mt-6"
    >
      <p class="text-ink text-body font-medium">No leagues yet.</p>

      <p class="text-ink-muted text-body mt-2 max-w-[46ch]">
        Create one, or join one someone has already started. Either way, the first game you record is the first thing
        that counts.
      </p>

      <!-- No buttons: creating and joining do not exist yet, and a control that goes nowhere is worse than none -->
      <WidgetsHomeNextSteps v-if="props.showNextSteps" />
    </div>

    <ul
      v-else-if="readState === AccountReadState.READY"
      class="mt-6 space-y-3"
    >
      <li
        v-for="league in leagues"
        :key="league.id"
        class="border-border flex items-center gap-4 rounded-md border p-4"
      >
        <span
          aria-hidden="true"
          class="bg-brand-soft text-brand-soft-ink text-body-sm flex size-11 shrink-0 items-center justify-center rounded-md font-medium"
        >
          {{ league.abbreviation }}
        </span>

        <span class="min-w-0">
          <span class="text-ink text-body block truncate font-medium">{{ league.name }}</span>

          <span class="text-ink-subtle text-caption block">
            {{ toRoleLabel(league.role) }} · Joined {{ toMonthYear(league.joinedAt) }}
          </span>
        </span>
      </li>
    </ul>
  </section>
</template>
