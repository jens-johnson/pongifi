<script setup lang="ts">
/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import type { IMatchView, IMatchViewSide } from '#shared/results';
import { ResultState, SideSatisfaction } from '#shared/results';
import { Side } from '#shared/rules-engine';
import { AccountReadState, type IAccountReadStateInput } from '~/utils/account/read-state';
import { HOME_ROUTE, LEAGUES_ROUTE } from '~/utils/marketing/routes';
import {
  namesOf,
  seatsOf,
  toAcceptedLine,
  toAwaitingLine,
  toDisputeLine,
  toHeading,
  toLocalDateTime,
  toRatingCell,
  toRatingLine,
  toResolutionLine,
  toSummary,
} from '~/utils/results/format';
import type { IMatchPageResponse } from '~/utils/results/types';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The current route, read for the league and the game it names
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/**
 * The match, read through the viewer's own membership and with anything due settled first; awaited so the server
 * knows whether to answer 404 before it renders anything
 * @internal
 * @constant
 */
const {
  data: page,
  error,
  refresh,
  status,
}: Awaited<ReturnType<typeof useFetch<IMatchPageResponse>>> = await useFetch<IMatchPageResponse>(
  (): string => `/api/leagues/${String(route.params.leagueId)}/games/${String(route.params.gameId)}`,
  { key: `match-${String(route.params.gameId)}` },
);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the match cannot be shown to this viewer: unknown, malformed, or not theirs. One state for all three
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
  hasData: Boolean(page.value),
  status: status.value,
}));

/**
 * The match itself
 * @internal
 * @constant
 */
const match: ComputedRef<IMatchView | null> = computed((): IMatchView | null => page.value?.match ?? null);

/**
 * The heading, which does not announce a winner while the result can still be contested
 * @internal
 * @constant
 */
const heading: ComputedRef<string> = computed((): string => (match.value ? toHeading(match.value) : ''));

/**
 * The line under the heading
 * @internal
 * @constant
 */
const summary: ComputedRef<string> = computed((): string => (match.value ? toSummary(match.value) : ''));

/**
 * The sides still owed an answer, each of which gets its own line
 * @internal
 * @constant
 */
const awaiting: ComputedRef<IMatchViewSide[]> = computed((): IMatchViewSide[] =>
  (match.value?.sides ?? []).filter((side): boolean => side.satisfiedBy === SideSatisfaction.PENDING),
);

/**
 * Where the league page is, for the breadcrumb and the way back
 * @internal
 * @constant
 */
const leagueRoute: ComputedRef<string> = computed((): string => `${LEAGUES_ROUTE}/${String(route.params.leagueId)}`);

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// Every game of a match, and every game a superseded revision left behind, is read at the match's own page
if (page.value && page.value.canonicalMatchId !== String(route.params.gameId)) {
  await navigateTo(`${leagueRoute.value}/games/${page.value.canonicalMatchId}`, { redirectCode: 302, replace: true });
}

if (notFound.value) {
  setResponseStatus(404);
}

useHead({
  meta: [{ content: 'noindex', name: 'robots' }],
  title: (): string => (match.value ? `${heading.value} · Pongifi` : 'Page not found · Pongifi'),
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
      <p class="text-ink text-body">Could not load this result.</p>

      <button
        class="text-accent-strong hover:text-accent text-body mt-4 font-medium"
        type="button"
        @click="refresh()"
      >
        Retry
      </button>
    </div>

    <article
      v-else-if="match"
      class="max-w-[720px]"
    >
      <NuxtLink
        class="text-ink-subtle hover:text-ink text-body-sm"
        :to="leagueRoute"
      >
        Games
      </NuxtLink>

      <h1 class="font-display text-display mt-2 font-medium tracking-tight">{{ heading }}</h1>

      <p class="text-ink-subtle text-body mt-1">{{ summary }}</p>

      <!--
        A result past its own deadline says so rather than asking for an answer nobody owes. The flag is the
        result's own overdue state, not whether the sweep reported success: settlement is bounded, so a league with
        more overdue results than one batch holds leaves this one due after a sweep that worked. A failed sweep only
        changes the wording, and never makes a result whose deadline has not arrived sound due
      -->
      <p
        v-if="page?.settlementOutstanding"
        class="text-body mt-6"
        role="alert"
      >
        {{
          page?.settlementFailed
            ? 'This result is due to be accepted, but Pongifi could not process it.'
            : 'This result is due to be accepted and is still being processed.'
        }}
        <button
          class="text-accent-strong hover:text-accent font-medium"
          type="button"
          @click="refresh()"
        >
          Retry
        </button>
      </p>

      <template v-else>
        <div
          v-if="match.state === ResultState.UNCONFIRMED"
          class="text-body mt-6 space-y-1"
        >
          <p
            v-for="side in awaiting"
            :key="side.side"
          >
            {{ toAwaitingLine(side) }} · Accepted automatically if nobody disputes by
            {{ toLocalDateTime(match.confirmationDeadline) }}
          </p>
        </div>

        <p
          v-else-if="match.state === ResultState.CONFIRMED"
          class="text-body mt-6"
        >
          {{ toAcceptedLine(match) }} · {{ toRatingLine(match) }}
        </p>

        <div
          v-else-if="match.state === ResultState.DISPUTED"
          class="text-body mt-6"
        >
          <p>{{ toDisputeLine(match) }}</p>

          <p class="mt-1">{{ toResolutionLine(match) }}</p>
        </div>

        <p
          v-else
          class="text-body mt-6"
        >
          Voided by {{ match.voided?.by.displayName }} {{ toLocalDateTime(match.voided?.at ?? null) }}. This result does
          not count.
        </p>
      </template>

      <table class="mt-8 w-full text-left">
        <caption class="text-ink-subtle text-body-sm mb-2 text-left">
          Played to
          {{
            match.rules.targetScore
          }}, win by
          {{
            match.rules.winningMargin
          }}, best of
          {{
            match.rules.matchFormat
          }}
        </caption>

        <thead>
          <tr class="text-ink-subtle text-body-sm">
            <th scope="col">Side</th>

            <th
              v-for="game in match.games"
              :key="game.gameNumber"
              scope="col"
            >
              Game {{ game.gameNumber }}
            </th>
          </tr>
        </thead>

        <tbody class="text-body">
          <tr
            v-for="side in [Side.A, Side.B]"
            :key="side"
          >
            <th
              class="font-medium"
              scope="row"
            >
              {{ namesOf(seatsOf(match, side)) }}
            </th>

            <td
              v-for="game in match.games"
              :key="game.gameNumber"
              :class="game.winner === side ? 'font-semibold' : ''"
            >
              {{ side === Side.A ? game.a : game.b
              }}<span
                v-if="game.retired"
                class="text-ink-subtle"
              >
                (retired)</span
              >
            </td>
          </tr>
        </tbody>
      </table>

      <ul class="mt-8 space-y-2">
        <li
          v-for="participant in match.participants"
          :key="participant.seat"
          class="text-body flex flex-wrap items-baseline gap-x-2"
        >
          <span>{{ participant.identity.displayName }}</span>

          <span
            v-if="participant.identity.guest"
            class="text-ink-subtle text-body-sm"
            >Guest</span
          >

          <span
            v-if="participant.confirmed"
            aria-label="Confirmed this result"
            class="text-accent-strong"
            >✓</span
          >

          <span class="text-ink-subtle text-body-sm">{{ toRatingCell(match, participant) }}</span>
        </li>
      </ul>

      <p class="text-ink-subtle text-body-sm mt-8">
        Recorded by {{ match.recordedBy.displayName }} {{ toLocalDateTime(match.submittedAt) }} · Played
        {{ toLocalDateTime(match.playedAt) }}
      </p>

      <ol
        v-if="match.history.length > 1"
        class="text-ink-subtle text-body-sm mt-4 space-y-1"
      >
        <li
          v-for="entry in match.history"
          :key="entry.revision"
        >
          Revision {{ entry.revision }} {{ entry.kind === 'RECORDED' ? 'recorded' : 'amended' }} by
          {{ entry.by.displayName }} {{ toLocalDateTime(entry.at) }}: {{ entry.scores
          }}<span v-if="entry.disputedBy">
            · disputed by {{ entry.disputedBy.displayName }} {{ toLocalDateTime(entry.disputedAt) }}</span
          >
        </li>
      </ol>
    </article>
  </main>
</template>
