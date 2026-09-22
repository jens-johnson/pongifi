<script setup lang="ts">
/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import type { IResultAmendment, IResultFormContext } from '#shared/results';
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
 * The result this page was opened to correct, when it was opened to correct one.
 *
 * A query rather than a route of its own: correcting is the same form under the same rules, opened on a result
 * instead of on an empty draft (page spec, Record, Amend mode)
 * @internal
 * @constant
 */
const amendId: string = typeof route.query.amend === 'string' ? route.query.amend : '';

/**
 * Everything the league says about how this entry will be judged, including the database's clock; or, for a
 * correction, everything the match froze when it was recorded
 * @internal
 * @constant
 */
const {
  data: context,
  error,
  refresh,
  status,
}: Awaited<ReturnType<typeof useFetch<IResultFormContext>>> = await useFetch<IResultFormContext>(
  (): string =>
    amendId
      ? `/api/leagues/${String(route.params.leagueId)}/games/context?amend=${encodeURIComponent(amendId)}`
      : `/api/leagues/${String(route.params.leagueId)}/games/context`,
  // Keyed by mode as well as by league: an entry and a correction are two different contexts for one league, and a
  // shared key would open one of them on the other's rules
  { key: `record-${String(route.params.leagueId)}-${amendId}` },
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

/**
 * The result being corrected, when this is a correction
 * @internal
 * @constant
 */
const amendment: ComputedRef<IResultAmendment | null> = computed(
  (): IResultAmendment | null => context.value?.amendment ?? null,
);

/**
 * Where the result being corrected is read
 * @internal
 * @constant
 */
const gameRoute: ComputedRef<string> = computed(
  (): string => `${leagueRoute.value}/games/${amendment.value?.canonicalMatchId ?? ''}`,
);

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

if (notFound.value) {
  setResponseStatus(404);
}

// A correction nobody may make is not a page with a sentence on it: the result itself already says what state it
// is in and which resolution is still open, and that is where the answer is (page spec, Record, Amend mode)
if (amendment.value && !context.value?.authority.may) {
  await navigateTo(gameRoute.value, { replace: true });
}

useHead({
  meta: [{ content: 'noindex', name: 'robots' }],
  title: (): string => {
    if (!context.value) {
      return 'Page not found · Pongifi';
    }

    const what: string = context.value.amendment ? 'Amend a result' : 'Record a result';

    return `${what} · ${context.value.leagueName} · Pongifi`;
  },
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
      <h1 class="font-display text-display font-medium tracking-tight">
        {{ amendment ? 'Amend a result' : 'Record a result' }}
      </h1>

      <!-- A correction nobody may make has already been sent to the result, which says why; this is what stands
           if that navigation itself could not be made, and it names no reason the result does not state better -->
      <template v-if="amendment && !context.authority.may">
        <p class="text-body mt-4">This result cannot be corrected here.</p>

        <NuxtLink
          class="text-accent-strong hover:text-accent text-body mt-6 inline-block font-medium"
          :to="gameRoute"
        >
          Back to the result
        </NuxtLink>
      </template>

      <!-- Not a 404: they are a member of this league, and the page says whose job this is -->
      <template v-else-if="!context.authority.may">
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
