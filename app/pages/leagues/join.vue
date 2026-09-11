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
 * ██████████████████████████████████████████████ #pages/leagues/join.vue ██████████████████████████████████████████████
 *
 * Join a league by pasting an invite link.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /leagues/join
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

// Private and unindexed like every page that exists for one signed-in player
useHead({ meta: [{ content: 'noindex', name: 'robots' }], title: 'Join a league · Pongifi' });
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <div class="max-w-[560px]">
      <h1 class="font-display text-display font-medium tracking-tight">Join a league</h1>

      <p class="text-ink-muted text-body-lg mt-4">Paste the invite link someone sent you.</p>

      <div class="mt-10">
        <WidgetsLeaguesJoinForm />
      </div>
    </div>
  </main>
</template>
