<script setup lang="ts">
/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import type { IResultFormContext } from '#shared/results';
import { AccountReadState, type IAccountReadStateInput } from '~/utils/account/read-state';
import { HOME_ROUTE, LEAGUES_ROUTE } from '~/utils/marketing/routes';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The current route, read for the league it names
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/**
 * The signed-in account, which is pre-seated in what it records
 * @internal
 * @constant
 */
const { user }: ReturnType<typeof useUserSession> = useUserSession();

/**
 * Everything the league says about how this entry will be judged, including the database's clock
 * @internal
 * @constant
 */
const {
  data: context,
  error,
  refresh,
  status,
}: Awaited<ReturnType<typeof useFetch<IResultFormContext>>> = await useFetch<IResultFormContext>(
  (): string => `/api/leagues/${String(route.params.leagueId)}/games/context`,
  { key: `record-${String(route.params.leagueId)}` },
);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the league cannot be shown to this viewer: unknown, malformed, or not theirs
 * @internal
 * @constant
 */
const notFound: ComputedRef<boolean> = computed((): boolean => error.value?.statusCode === 404);

/**
 * What the page draws for any answer other than not-found
 * @internal
 * @constant
 */
const readState: ComputedRef<AccountReadState> = useAccountReadState((): IAccountReadStateInput => ({
  errorStatusCode: error.value?.statusCode ?? null,
  hasData: Boolean(context.value),
  status: status.value,
}));

/**
 * Where the league page is, for the way back
 * @internal
 * @constant
 */
const leagueRoute: ComputedRef<string> = computed((): string => `${LEAGUES_ROUTE}/${String(route.params.leagueId)}`);

/**
 * Whether this league records nothing this form can take.
 *
 * A cutthroat-only league has no recordable format here: its results are scored live, and there is no final-score
 * form that could reconstruct one
 * @internal
 * @constant
 */
const cutthroatOnly: ComputedRef<boolean> = computed((): boolean => (context.value?.formats.length ?? 0) === 0);

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

if (notFound.value) {
  setResponseStatus(404);
}

useHead({
  meta: [{ content: 'noindex', name: 'robots' }],
  title: (): string =>
    context.value ? `Record a result · ${context.value.leagueName} · Pongifi` : 'Page not found · Pongifi',
});
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
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
        class="text-accent-strong hover:text-accent text-body mt-4 font-medium"
        type="button"
        @click="refresh()"
      >
        Retry
      </button>
    </div>

    <div
      v-else-if="context"
      class="max-w-[560px]"
    >
      <h1 class="font-display text-display font-medium tracking-tight">Record a result</h1>

      <!-- Not a 404: they are a member of this league, and the page says whose job this is -->
      <template v-if="!context.authority.may">
        <p class="text-body mt-4">Only {{ context.authority.who }} can record results in this league.</p>

        <NuxtLink
          class="text-accent-strong hover:text-accent text-body mt-6 inline-block font-medium"
          :to="leagueRoute"
        >
          Back to {{ context.leagueName }}
        </NuxtLink>
      </template>

      <p
        v-else-if="cutthroatOnly"
        class="text-body mt-4"
      >
        This league plays cutthroat, and cutthroat results are recorded live.
      </p>

      <WidgetsResultsRecordForm
        v-else
        class="mt-6"
        :context="context"
        :league-id="String(route.params.leagueId)"
        :recorder-id="String(user?.id ?? '')"
        @recorded="
          (canonicalMatchId, recordedLeagueId) =>
            navigateTo(`${LEAGUES_ROUTE}/${recordedLeagueId}/games/${canonicalMatchId}`)
        "
      />
    </div>
  </main>
</template>
