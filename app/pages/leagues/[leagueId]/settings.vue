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
 * ██████████████████████████████████████ #pages/leagues/[leagueId]/settings.vue ███████████████████████████████████████
 *
 * A league's settings, editable by the roles the pitch gives each section.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /leagues/:leagueId/settings
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import type { ILeagueConfiguration, ILeagueDetail } from '#shared/leagues';
import { AccountReadState, type IAccountReadStateInput } from '~/utils/account/read-state';
import { SETTINGS_FREEZE_NOTE } from '~/utils/leagues/settings';
import { HOME_ROUTE, LEAGUES_ROUTE } from '~/utils/marketing/routes';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The current route, read for the league it names.
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/**
 * The league named by the path, read through the viewer's own membership; the same read the league page makes, which
 * already carries the viewer's role and the configuration revision every save from here submits.
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
 * Whether the league cannot be shown to this viewer: unknown, malformed, or not theirs. One state for all three, the
 * same one the league page draws, so this page reveals nothing that one does not.
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
 * Where the back link goes, and what it is called.
 * @internal
 * @constant
 */
const backTo: ComputedRef<string> = computed((): string => `${LEAGUES_ROUTE}/${String(route.params.leagueId)}`);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Takes what a save stored, so the name beside this page's heading reads the saved one without a second read.
 * @internal
 * @function
 * @param configuration - The configuration as it is now stored
 */
function onSaved(configuration: ILeagueConfiguration): void {
  if (league.value) {
    league.value = { ...league.value, ...configuration };
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// The not-found page is a real 404, identical for an unknown league, a malformed id and a league that is not theirs
if (notFound.value) {
  setResponseStatus(404);
}

useHead({
  meta: [{ content: 'noindex', name: 'robots' }],
  title: (): string => (league.value ? `Settings · ${league.value.name} · Pongifi` : 'Page not found · Pongifi'),
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
      <p class="text-ink text-body">Could not load these settings.</p>

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
      <div class="max-w-[720px]">
        <NuxtLink
          class="text-accent-strong hover:text-accent text-body-sm font-medium"
          :to="backTo"
        >
          Back to {{ league.name }}
        </NuxtLink>

        <h1 class="font-display text-display mt-4 font-medium tracking-tight">League settings</h1>

        <p class="text-ink text-body-lg mt-3 flex items-center gap-3">
          <span
            aria-hidden="true"
            class="bg-brand-soft text-brand-soft-ink text-body-sm flex size-9 shrink-0 items-center justify-center rounded-md font-medium"
          >
            {{ league.abbreviation }}
          </span>

          <span class="min-w-0 break-words">{{ league.name }}</span>
        </p>

        <!-- The freeze rule, said once on this page and nowhere else -->
        <p class="text-ink-muted text-body-sm mt-4">{{ SETTINGS_FREEZE_NOTE }}</p>

        <div class="mt-10">
          <WidgetsLeaguesSettingsForm
            :league="league"
            @saved="onSaved"
          />
        </div>
      </div>
    </template>
  </main>
</template>
