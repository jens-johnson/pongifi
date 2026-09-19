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
 * █████████████████████████████████████████████ #pages/leagues/index.vue ██████████████████████████████████████████████
 *
 * The signed-in player's searchable, filterable and paginated league memberships.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /leagues
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

useHead({ title: 'Your leagues · Pongifi' });
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <div class="max-w-[1180px]">
      <h1 class="font-display text-display font-medium tracking-tight">Your leagues</h1>

      <!-- Entry stays above browsing so the actions remain available in every list state -->
      <WidgetsLeaguesEntryActions class="mt-8" />

      <div class="mt-10">
        <WidgetsLeaguesBrowser />
      </div>
    </div>
  </main>
</template>
