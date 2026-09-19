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
 * ███████████████████████████████████ #components/widgets/leagues/browser/index.vue ███████████████████████████████████
 *
 * Searchable, filterable and paginated league membership browser.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesBrowser />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';
import type { Router } from 'vue-router';

import { LeagueRole } from '#shared/domain';
import type { ILeagueMembershipPage } from '#shared/profile';
import { LeagueListPresentation, LeagueMembershipSort, LEAGUES_LIST_PAGE_SIZE } from '#shared/profile';
import { GameType } from '#shared/rules-engine';
import type { IAccountReadStateInput } from '~/utils/account/read-state';
import { AccountReadState } from '~/utils/account/read-state';
import type { ILeagueListRouteState } from '~/utils/leagues/browse';
import {
  LEAGUE_LIST_SEARCH_DELAY_MS,
  LEAGUE_LIST_SKELETON_ROWS,
  normalizeLeagueListRouteState,
  toGameTypeListLabel,
  toLeagueListRouteQuery,
} from '~/utils/leagues/browse';
import { GAME_TYPE_LABELS } from '~/utils/leagues/display';
import { LEAGUES_ROUTE } from '~/utils/marketing/routes';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The router used for restorable filter and page changes.
 * @internal
 * @constant
 */
const router: Router = useRouter();

/**
 * The bounded list state restored from the current URL.
 * @internal
 * @constant
 */
const listState: ComputedRef<ILeagueListRouteState> = computed((): ILeagueListRouteState =>
  normalizeLeagueListRouteState(router.currentRoute.value.query),
);

/**
 * The input's immediate value, written to the route after a short quiet period.
 * @internal
 * @constant
 */
const searchInput: Ref<string> = ref(listState.value.search);

/**
 * The pending search route update.
 * @internal
 */
let searchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The server query derived from the URL state.
 * @internal
 * @constant
 */
const requestQuery: ComputedRef<Record<string, string | number | undefined>> = computed(
  (): Record<string, string | number | undefined> => ({
    format: listState.value.format ?? undefined,
    page: listState.value.page,
    pageSize: LEAGUES_LIST_PAGE_SIZE,
    role: listState.value.role ?? undefined,
    search: listState.value.search || undefined,
    sort: listState.value.sort,
  }),
);

/**
 * The current server page and its request state.
 * @internal
 * @constant
 */
const {
  data: page,
  error,
  refresh,
  status,
}: ReturnType<typeof useFetch<ILeagueMembershipPage>> = useFetch<ILeagueMembershipPage>('/api/me/leagues', {
  dedupe: 'cancel',
  key: 'leagues-browser',
  query: requestQuery,
});

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The exclusive pending, ready, failed or unauthorized state.
 * @internal
 * @constant
 */
const readState: ComputedRef<AccountReadState> = useAccountReadState((): IAccountReadStateInput => ({
  errorStatusCode: error.value?.statusCode ?? null,
  hasData: Boolean(page.value),
  status: status.value,
}));

/**
 * The number of filtered pages, with zero matches still represented as page one.
 * @internal
 * @constant
 */
const pageCount: ComputedRef<number> = computed((): number =>
  Math.max(1, Math.ceil((page.value?.filteredTotal ?? 0) / LEAGUES_LIST_PAGE_SIZE)),
);

/**
 * Whether search or either filter is narrowing the membership list.
 * @internal
 * @constant
 */
const hasFilters: ComputedRef<boolean> = computed((): boolean =>
  Boolean(listState.value.search || listState.value.role || listState.value.format),
);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Reads a select control's string value.
 * @internal
 * @function
 * @param event - The select change event
 * @returns The selected string
 */
function readSelectValue(event: Event): string {
  return (event.target as HTMLSelectElement).value;
}

/**
 * Pushes a list-state change into browser history.
 * @internal
 * @function
 * @param state - The next normalized state
 * @returns The completed navigation
 */
async function pushState(state: ILeagueListRouteState): Promise<void> {
  await router.push({ query: toLeagueListRouteQuery(state) });
}

/**
 * Replaces the current bookmark without adding a history entry.
 * @internal
 * @function
 * @param state - The next normalized state
 * @returns The completed navigation
 */
async function replaceState(state: ILeagueListRouteState): Promise<void> {
  await router.replace({ query: toLeagueListRouteQuery(state) });
}

/**
 * Debounces search into the URL and resets pagination.
 * @internal
 * @function
 * @param event - The search input event
 */
function onSearchInput(event: Event): void {
  searchInput.value = (event.target as HTMLInputElement).value;

  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  searchTimer = setTimeout((): void => {
    // Search typing replaces one bookmark rather than adding a history entry per character
    void replaceState({
      ...listState.value,
      page: 1,
      search: searchInput.value.trim(),
    });
  }, LEAGUE_LIST_SEARCH_DELAY_MS);
}

/**
 * Applies the role filter and resets pagination.
 * @internal
 * @function
 * @param event - The role select event
 * @returns The completed navigation
 */
async function onRoleChange(event: Event): Promise<void> {
  const value: string = readSelectValue(event);

  await pushState({
    ...listState.value,
    page: 1,
    role: value ? (value as LeagueRole) : null,
  });
}

/**
 * Applies the format filter and resets pagination.
 * @internal
 * @function
 * @param event - The format select event
 * @returns The completed navigation
 */
async function onFormatChange(event: Event): Promise<void> {
  const value: string = readSelectValue(event);

  await pushState({
    ...listState.value,
    format: value ? (value as GameType) : null,
    page: 1,
  });
}

/**
 * Applies the stable ordering and resets pagination.
 * @internal
 * @function
 * @param event - The sort select event
 * @returns The completed navigation
 */
async function onSortChange(event: Event): Promise<void> {
  await pushState({
    ...listState.value,
    page: 1,
    sort: readSelectValue(event) as LeagueMembershipSort,
  });
}

/**
 * Chooses the desktop list presentation.
 * @internal
 * @function
 * @param presentation - The cards or table presentation
 * @returns The completed navigation
 */
async function onPresentationChange(presentation: LeagueListPresentation): Promise<void> {
  await pushState({ ...listState.value, presentation });
}

/**
 * Moves to a bounded page.
 * @internal
 * @function
 * @param pageNumber - The requested one-based page
 * @returns The completed navigation
 */
async function onPageChange(pageNumber: number): Promise<void> {
  await pushState({ ...listState.value, page: pageNumber });
}

/**
 * Removes search and filters while preserving sort and presentation.
 * @internal
 * @function
 * @returns The completed navigation
 */
async function onClearFilters(): Promise<void> {
  searchInput.value = '';
  await pushState({
    ...listState.value,
    format: null,
    page: 1,
    role: null,
    search: '',
  });
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

watch(
  (): string => listState.value.search,
  (search: string): void => {
    searchInput.value = search;
  },
);

watch(page, async (current: ILeagueMembershipPage | null | undefined): Promise<void> => {
  if (current && current.page !== listState.value.page) {
    await replaceState({ ...listState.value, page: current.page });
  }
});

onScopeDispose((): void => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});
</script>

<template>
  <section aria-label="League memberships">
    <!-- The toolbar remains visible but inert on failure; no-league accounts have nothing to search -->
    <div
      v-if="readState === AccountReadState.FAILED || (page?.unfilteredTotal ?? 0) > 0"
      class="border-border bg-surface grid gap-4 rounded-md border p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.7fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(170px,1fr)_auto]"
    >
      <label class="text-ink text-body-sm block font-medium">
        Search
        <span class="relative mt-1.5 block">
          <Icon
            aria-hidden="true"
            class="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            name="lucide:search"
          />

          <input
            class="border-border bg-bg text-ink placeholder:text-ink-subtle focus:border-brand focus:ring-brand/20 w-full rounded-md border py-2.5 pr-3 pl-9 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="readState === AccountReadState.FAILED"
            :value="searchInput"
            placeholder="Search by name or short mark"
            type="search"
            @input="onSearchInput"
          />
        </span>
      </label>

      <label class="text-ink text-body-sm block font-medium">
        Role
        <select
          class="border-border bg-bg text-ink focus:border-brand focus:ring-brand/20 mt-1.5 w-full rounded-md border px-3 py-2.5 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="readState === AccountReadState.FAILED"
          :value="listState.role ?? ''"
          @change="onRoleChange"
        >
          <option value="">Any role</option>

          <option :value="LeagueRole.COMMISSIONER">Commissioner</option>

          <option :value="LeagueRole.MANAGER">Manager</option>

          <option :value="LeagueRole.PLAYER">Player</option>
        </select>
      </label>

      <label class="text-ink text-body-sm block font-medium">
        Format
        <select
          class="border-border bg-bg text-ink focus:border-brand focus:ring-brand/20 mt-1.5 w-full rounded-md border px-3 py-2.5 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="readState === AccountReadState.FAILED"
          :value="listState.format ?? ''"
          @change="onFormatChange"
        >
          <option value="">Any format</option>

          <option :value="GameType.SINGLES">Singles</option>

          <option :value="GameType.DOUBLES">Doubles</option>

          <option :value="GameType.CUTTHROAT">Cutthroat</option>
        </select>
      </label>

      <label class="text-ink text-body-sm block font-medium">
        Sort
        <select
          class="border-border bg-bg text-ink focus:border-brand focus:ring-brand/20 mt-1.5 w-full rounded-md border px-3 py-2.5 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="readState === AccountReadState.FAILED"
          :value="listState.sort"
          @change="onSortChange"
        >
          <option :value="LeagueMembershipSort.JOINED">Recently joined</option>

          <option :value="LeagueMembershipSort.NAME">Name A to Z</option>

          <option :value="LeagueMembershipSort.MEMBERS">Most members</option>
        </select>
      </label>

      <fieldset
        class="hidden self-end md:block"
        :disabled="readState === AccountReadState.FAILED"
      >
        <legend class="sr-only">Presentation</legend>

        <div class="border-border flex rounded-md border p-1">
          <button
            :aria-pressed="listState.presentation === LeagueListPresentation.CARDS"
            class="text-body-sm text-ink hover:bg-surface-raised flex h-9 items-center gap-2 rounded-sm px-3 disabled:cursor-not-allowed disabled:opacity-60"
            :class="listState.presentation === LeagueListPresentation.CARDS ? 'bg-surface-raised' : ''"
            title="Cards"
            type="button"
            @click="onPresentationChange(LeagueListPresentation.CARDS)"
          >
            <Icon
              aria-hidden="true"
              class="size-4"
              name="lucide:layout-grid"
            />
            Cards
          </button>

          <button
            :aria-pressed="listState.presentation === LeagueListPresentation.TABLE"
            class="text-body-sm text-ink hover:bg-surface-raised flex h-9 items-center gap-2 rounded-sm px-3 disabled:cursor-not-allowed disabled:opacity-60"
            :class="listState.presentation === LeagueListPresentation.TABLE ? 'bg-surface-raised' : ''"
            title="Table"
            type="button"
            @click="onPresentationChange(LeagueListPresentation.TABLE)"
          >
            <Icon
              aria-hidden="true"
              class="size-4"
              name="lucide:list"
            />
            Table
          </button>
        </div>
      </fieldset>
    </div>

    <div
      v-if="readState === AccountReadState.FAILED"
      class="border-border mt-6 border-y py-10"
      role="alert"
    >
      <p class="text-ink text-body font-medium">Could not load your leagues.</p>

      <button
        class="border-border text-ink hover:border-accent text-body-sm mt-4 rounded-md border px-4 py-2 font-medium transition-colors"
        type="button"
        @click="refresh()"
      >
        Retry
      </button>
    </div>

    <ul
      v-else-if="readState === AccountReadState.PENDING"
      aria-hidden="true"
      class="mt-6 space-y-3"
    >
      <li
        v-for="row in LEAGUE_LIST_SKELETON_ROWS"
        :key="row"
        class="bg-surface h-24 animate-pulse rounded-md"
      />
    </ul>

    <div
      v-else-if="readState === AccountReadState.READY && page?.unfilteredTotal === 0"
      class="border-border mt-6 border-y py-10"
    >
      <p class="text-ink text-body font-medium">No leagues yet.</p>

      <p class="text-ink-muted text-body mt-2 max-w-[46ch]">
        Create one, or join one someone has already started. Either way, the first game you record is the first thing
        that counts.
      </p>
    </div>

    <div
      v-else-if="readState === AccountReadState.READY && page?.filteredTotal === 0"
      class="border-border mt-6 border-y py-10"
    >
      <p class="text-ink text-body font-medium">No leagues match.</p>

      <button
        v-if="hasFilters"
        class="text-accent-strong hover:text-accent text-body-sm mt-3 font-medium"
        type="button"
        @click="onClearFilters"
      >
        Clear filters
      </button>
    </div>

    <template v-else-if="readState === AccountReadState.READY">
      <!-- Cards are always the narrow-screen presentation and remain the desktop preference when selected -->
      <ul
        class="mt-6 grid gap-4 md:grid-cols-2"
        :class="listState.presentation === LeagueListPresentation.TABLE ? 'md:hidden' : ''"
      >
        <li
          v-for="league in page?.rows"
          :key="league.id"
        >
          <NuxtLink
            class="border-border bg-surface hover:border-accent flex h-full flex-col rounded-md border p-5 transition-colors"
            :to="`${LEAGUES_ROUTE}/${league.id}`"
          >
            <span class="flex min-w-0 items-start gap-4">
              <span
                aria-hidden="true"
                class="bg-brand-soft text-brand-soft-ink text-body-sm flex size-11 shrink-0 items-center justify-center rounded-md font-medium"
              >
                {{ league.abbreviation }}
              </span>

              <span class="min-w-0">
                <span class="text-ink text-body block font-medium break-words">{{ league.name }}</span>

                <span
                  v-if="league.description"
                  class="text-ink-muted text-body-sm mt-1 line-clamp-2 block break-words"
                >
                  {{ league.description }}
                </span>
              </span>
            </span>

            <span class="text-ink-subtle text-caption mt-5 block">
              {{ toRoleLabel(league.role) }} · {{ league.memberCount }} members ·
              {{ toGameTypeListLabel(league.allowedGameTypes) }} · {{ league.gameCount }} games · Joined
              {{ toMonthYear(league.joinedAt) }}
            </span>
          </NuxtLink>
        </li>
      </ul>

      <div
        v-if="listState.presentation === LeagueListPresentation.TABLE"
        class="border-border bg-surface mt-6 hidden overflow-x-auto rounded-md border md:block"
      >
        <table class="w-full min-w-[880px] border-collapse text-left">
          <thead class="bg-surface-raised text-ink-muted text-caption">
            <tr>
              <th class="px-4 py-3 font-medium">League</th>

              <th class="px-4 py-3 font-medium">Your role</th>

              <th class="px-4 py-3 font-medium">Members</th>

              <th class="px-4 py-3 font-medium">Formats</th>

              <th class="px-4 py-3 font-medium">Games</th>

              <th class="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>

          <tbody class="divide-border divide-y">
            <tr
              v-for="league in page?.rows"
              :key="league.id"
              class="hover:bg-brand-soft/40"
            >
              <td class="max-w-[360px] px-4 py-4">
                <span class="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    class="bg-brand-soft text-brand-soft-ink text-caption flex size-10 shrink-0 items-center justify-center rounded-md font-medium"
                  >
                    {{ league.abbreviation }}
                  </span>

                  <span class="min-w-0">
                    <NuxtLink
                      class="text-ink hover:text-accent block truncate font-medium"
                      :to="`${LEAGUES_ROUTE}/${league.id}`"
                    >
                      {{ league.name }}
                    </NuxtLink>

                    <span
                      v-if="league.description"
                      class="text-ink-muted text-body-sm block truncate"
                    >
                      {{ league.description }}
                    </span>
                  </span>
                </span>
              </td>

              <td class="text-ink-muted text-body-sm px-4 py-4">{{ toRoleLabel(league.role) }}</td>

              <td class="text-ink-muted text-body-sm px-4 py-4">{{ league.memberCount }}</td>

              <td class="px-4 py-4">
                <span class="flex flex-wrap gap-1.5">
                  <span
                    v-for="gameType in league.allowedGameTypes"
                    :key="gameType"
                    class="bg-surface-raised text-ink-muted text-caption rounded-sm px-2 py-1"
                  >
                    {{ GAME_TYPE_LABELS[gameType] }}
                  </span>
                </span>
              </td>

              <td class="text-ink-muted text-body-sm px-4 py-4">{{ league.gameCount }}</td>

              <td class="text-ink-muted text-body-sm px-4 py-4 whitespace-nowrap">
                {{ toMonthYear(league.joinedAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav
        v-if="pageCount > 1"
        aria-label="League list pages"
        class="mt-6 flex items-center justify-between gap-4"
      >
        <button
          class="border-border text-ink hover:border-accent text-body-sm rounded-md border px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="(page?.page ?? 1) <= 1"
          type="button"
          @click="onPageChange((page?.page ?? 1) - 1)"
        >
          Previous
        </button>

        <span class="text-ink-muted text-body-sm">Page {{ page?.page }} of {{ pageCount }}</span>

        <button
          class="border-border text-ink hover:border-accent text-body-sm rounded-md border px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="(page?.page ?? 1) >= pageCount"
          type="button"
          @click="onPageChange((page?.page ?? 1) + 1)"
        >
          Next
        </button>
      </nav>
    </template>
  </section>
</template>
