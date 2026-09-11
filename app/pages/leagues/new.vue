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
 * ██████████████████████████████████████████████ #pages/leagues/new.vue ███████████████████████████████████████████████
 *
 * Create a league.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /leagues/new
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

// Private and unindexed like every page that exists for one signed-in player
useHead({ meta: [{ content: 'noindex', name: 'robots' }], title: 'Create a league · Pongifi' });
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <div class="max-w-[560px]">
      <h1 class="font-display text-display font-medium tracking-tight">Create a league</h1>

      <p class="text-ink-muted text-body-lg mt-4">
        It starts private. Invite the people you already play against once it exists.
      </p>

      <div class="mt-10">
        <WidgetsLeaguesCreateForm />
      </div>
    </div>
  </main>
</template>
