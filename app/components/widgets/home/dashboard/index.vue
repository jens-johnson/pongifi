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
 * ███████████████████████████████████ #components/widgets/home/dashboard/index.vue ████████████████████████████████████
 *
 * The signed-in home: who you are, the leagues you are in, and what happens next.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsHomeDashboard />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import type { ILeagueMembership } from '#shared/profile';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The signed-in player, read for the greeting.
 * @internal
 * @constant
 */
const { user }: ReturnType<typeof useUserSession> = useUserSession();

/**
 * The player's leagues, read here as well as in the panel so the line under the greeting matches what the panel shows.
 *
 * The same request key, so this shares the panel's single fetch rather than issuing a second one
 * @internal
 * @constant
 */
const { data: leagues, error }: ReturnType<typeof useFetch<ILeagueMembership[]>> =
  useFetch<ILeagueMembership[]>('/api/me/leagues');

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The line under the greeting, which differs between a player with leagues and one without.
 *
 * A failed request keeps the populated line: this should not announce an empty account on the strength of a request
 * that never answered.
 * @internal
 * @constant
 */
const lede: ComputedRef<string> = computed((): string =>
  !error.value && (leagues.value?.length ?? 0) === 0
    ? 'A league is the container. Games happen inside it, and ratings come from those games.'
    : 'Your leagues, and everything that happens inside them.',
);
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <!-- Hello rather than Welcome back: someone arriving from /welcome has never been here -->
    <h1 class="font-display text-display font-medium tracking-tight">Hello, {{ user?.displayName }}.</h1>

    <p class="text-ink-muted text-body-lg mt-4 max-w-[560px]">{{ lede }}</p>

    <!-- Two thirds on desktop; the last third stays empty until league entry ships rather than holding a placeholder -->
    <div class="mt-10 grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <WidgetsLeaguesPanel show-next-steps />
      </div>
    </div>
  </main>
</template>
