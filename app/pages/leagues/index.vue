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
 * The leagues the signed-in player belongs to, with the create and join actions.
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
    <div class="max-w-[720px]">
      <h1 class="font-display text-display font-medium tracking-tight">Your leagues</h1>

      <!-- The page grows exactly the actions row; the panel below it is the dashboard's, without its own copy of them -->
      <WidgetsLeaguesEntryActions class="mt-8" />

      <div class="mt-10">
        <WidgetsLeaguesPanel
          :show-entry-actions="false"
          :show-heading="false"
        />
      </div>
    </div>
  </main>
</template>
