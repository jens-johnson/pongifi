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
 * ███████████████████████████████████████████ #pages/leagues/[leagueId].vue ███████████████████████████████████████████
 *
 * A league as its members see it; one not-found page for anyone else.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /leagues/:leagueId
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import { LeagueRole } from '#shared/domain';
import type { ILeagueDetail } from '#shared/leagues';
import { toRoleLabel } from '~/utils/account/format';
import { AccountReadState, type IAccountReadStateInput } from '~/utils/account/read-state';
import { HOME_ROUTE } from '~/utils/marketing/routes';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The current route, read for the league it names.
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/**
 * The league named by the path, read through the viewer's own membership; awaited so the server knows whether to answer
 * 404 before it renders anything.
 * @internal
 * @constant
 */
const {
  data: league,
  error,
  refresh,
  status,
}: Awaited<ReturnType<typeof useFetch<ILeagueDetail>>> = await useFetch<ILeagueDetail>(
  (): string => `/api/leagues/${String(route.params.leagueId)}`,
  { key: `league-${String(route.params.leagueId)}` },
);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the league cannot be shown to this viewer: unknown, malformed, or not theirs. One state for all three.
 * @internal
 * @constant
 */
const notFound: ComputedRef<boolean> = computed((): boolean => error.value?.statusCode === 404);

/**
 * What the page draws for any answer other than not-found; the composable leaves for sign-in on a 401.
 * @internal
 * @constant
 */
const readState: ComputedRef<AccountReadState> = useAccountReadState((): IAccountReadStateInput => ({
  errorStatusCode: error.value?.statusCode ?? null,
  hasData: Boolean(league.value),
  status: status.value,
}));

/**
 * Whether the viewer may see the invite panel (V.I: commissioners and managers).
 * @internal
 * @constant
 */
const managesInvites: ComputedRef<boolean> = computed(
  (): boolean =>
    league.value?.viewerRole === LeagueRole.COMMISSIONER || league.value?.viewerRole === LeagueRole.MANAGER,
);

/**
 * The caption under the league name.
 * @internal
 * @constant
 */
const caption: ComputedRef<string> = computed((): string =>
  league.value
    ? `${league.value.members.length} ${league.value.members.length === 1 ? 'member' : 'members'} · You're a ${toRoleLabel(league.value.viewerRole)}`
    : '',
);

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// The not-found page is a real 404, identical for an unknown league, a malformed id and a league that is not theirs
if (notFound.value) {
  setResponseStatus(404);
}

useHead({
  meta: [{ content: 'noindex', name: 'robots' }],
  title: (): string => (league.value ? `${league.value.name} · Pongifi` : 'Page not found · Pongifi'),
});
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <!-- Checked first and drawn the same whatever was missing: no forbidden state, nothing that differs -->
    <div
      v-if="notFound"
      class="max-w-[560px]"
    >
      <h1 class="font-display text-display font-medium tracking-tight">This page doesn't exist.</h1>

      <NuxtLink
        class="text-accent-strong hover:text-accent text-body-lg mt-6 inline-block font-medium"
        :to="HOME_ROUTE"
      >
        Back to your dashboard
      </NuxtLink>
    </div>

    <div
      v-else-if="readState === AccountReadState.FAILED"
      class="border-border bg-surface max-w-[560px] rounded-lg border p-6"
      role="alert"
    >
      <p class="text-ink text-body">Could not load this league.</p>

      <button
        class="border-border text-ink hover:border-accent text-body-sm mt-4 rounded-md border px-4 py-2 font-medium transition-colors"
        type="button"
        @click="refresh()"
      >
        Retry
      </button>
    </div>

    <div
      v-else-if="readState === AccountReadState.PENDING"
      aria-hidden="true"
      class="bg-surface-raised h-40 max-w-[720px] animate-pulse rounded-lg"
    />

    <template v-else-if="readState === AccountReadState.READY && league">
      <!-- Header -->
      <div class="flex items-start gap-4">
        <span
          aria-hidden="true"
          class="bg-brand-soft text-brand-soft-ink text-body flex size-14 shrink-0 items-center justify-center rounded-md font-medium"
        >
          {{ league.abbreviation }}
        </span>

        <div class="min-w-0">
          <h1 class="font-display text-display font-medium tracking-tight break-words">{{ league.name }}</h1>

          <p
            v-if="league.description"
            class="text-ink-muted text-body-lg mt-2"
          >
            {{ league.description }}
          </p>

          <p class="text-ink-subtle text-caption mt-2">{{ caption }}</p>
        </div>
      </div>

      <!-- Members and games on the left two thirds; invite and rules stacked on the right third -->
      <div class="mt-10 grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <WidgetsLeaguesMembersPanel :members="league.members" />

          <!-- A stated empty region, not a skeleton and not a disabled button; recording takes this space when it ships -->
          <section class="border-border bg-surface rounded-lg border p-6 md:p-8">
            <h2 class="font-display text-h3 font-medium tracking-tight">Games</h2>

            <p class="text-ink-muted text-body mt-4">
              No games yet. Standings appear once results are recorded and confirmed.
            </p>
          </section>
        </div>

        <div class="space-y-6">
          <!-- Rendered only for the roles that may invite; a player's page never asks for invitation data at all -->
          <WidgetsLeaguesInvitePanel
            v-if="managesInvites"
            :league-id="league.id"
          />

          <WidgetsLeaguesRulesPanel :settings="league.settings" />
        </div>
      </div>
    </template>
  </main>
</template>
