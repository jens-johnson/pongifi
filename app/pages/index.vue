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
 * █████████████████████████████████████████████████ #pages/index.vue ██████████████████████████████████████████████████
 *
 * Public Pongifi landing page.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The visitor's session, which decides which of the two pages this route is.
 *
 * Resolved on the server from the session cookie, so the dashboard never flashes the marketing landing first and a
 * signed-in visitor never sees a signed-out call to action
 * @internal
 * @constant
 */
const { loggedIn }: ReturnType<typeof useUserSession> = useUserSession();

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// A response that depends on the session must not be reused for anyone else; the signed-out landing keeps its caching
if (loggedIn.value) {
  useResponseHeader('Cache-Control').value = 'private, no-store';
}
</script>

<template>
  <WidgetsHomeDashboard v-if="loggedIn" />

  <main v-else>
    <section class="relative overflow-hidden px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
      <div class="pointer-events-none absolute inset-y-0 right-16 w-[38%] overflow-hidden">
        <ClientOnly>
          <PrimitivesHeroShader />
        </ClientOnly>
      </div>

      <div class="relative z-10 max-w-[620px]">
        <!-- height is reserved for the longest line so a rotation never shifts the copy below it -->
        <h1 class="font-display text-hero min-h-[140px] font-medium tracking-tight">
          <WidgetsHomeHeroHeadline />
        </h1>

        <p class="text-ink-muted text-body-lg mt-6 max-w-[520px]">
          Start a league. Compete with your family and friends. Climb the leaderboards.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <NuxtLink
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-lg rounded-md px-6 py-3 font-medium transition-colors"
            :to="SIGN_IN_ROUTE"
          >
            Get Started
          </NuxtLink>

          <NuxtLink
            class="text-accent-strong hover:text-accent text-body-lg flex items-center gap-1.5 rounded-md px-4 py-3 font-medium"
            to="/features"
          >
            See how it works
            <Icon
              class="size-4"
              name="lucide:arrow-right"
            />
          </NuxtLink>
        </div>
      </div>
    </section>

    <DataStatsBar />

    <WidgetsHomeHowItWorks />
  </main>
</template>
