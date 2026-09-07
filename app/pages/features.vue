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
 * ████████████████████████████████████████████████ #pages/features.vue ████████████████████████████████████████████████
 *
 * The Features page. Reachable from the marketing navigation and from inside the app.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

useHead({
  meta: [
    {
      content:
        'What Pongifi does: live rally-by-rally scoring for singles, doubles, and cutthroat, league rules set once, results checked the way your league decides, and ratings that move for the right reasons.',
      name: 'description',
    },
  ],
  title: 'Features · Pongifi',
});
</script>

<template>
  <main>
    <section class="relative overflow-hidden px-6 pt-12 pb-14 md:px-16 md:pt-16 md:pb-18">
      <div class="pointer-events-none absolute inset-y-0 right-16 hidden w-[38%] overflow-hidden xl:block">
        <ClientOnly>
          <PrimitivesHeroShader />
        </ClientOnly>
      </div>

      <div class="relative z-10 mx-auto max-w-[1120px]">
        <div class="max-w-[640px]">
          <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">Features</span>

          <h1 class="font-display text-display mt-4 font-medium tracking-tight">
            Everything between the first serve and the leaderboard.
          </h1>

          <p class="text-ink-muted text-body-lg mt-6">
            Pongifi scores the game the way it is actually played, checks results the way your league decides, and turns
            them into standings you can argue about less.
          </p>

          <WidgetsMarketingCta compact />
        </div>
      </div>
    </section>

    <WidgetsFeaturesAnchorNav />

    <WidgetsFeaturesScoring />

    <WidgetsFeaturesFormats />

    <WidgetsFeaturesLeague />

    <WidgetsFeaturesTrust />

    <WidgetsFeaturesRatings />

    <WidgetsFeaturesLimits />

    <section class="border-border border-t px-6 py-16 md:px-16 md:py-24">
      <div class="mx-auto max-w-[820px]">
        <WidgetsMarketingCta show-faq />
      </div>
    </section>
  </main>
</template>
