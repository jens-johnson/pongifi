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
 * █████████████████████████████████████████████████ #pages/about.vue ██████████████████████████████████████████████████
 *
 * The About page. Reachable from the marketing navigation and from inside the app.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
useHead({
  meta: [
    {
      content:
        'Pongifi is the league and game management platform for table tennis: confirmed scores, the real rules of the game, and ratings that move for the right reasons.',
      name: 'description',
    },
  ],
  title: 'About · Pongifi',
});
</script>

<template>
  <main>
    <section class="px-6 pt-12 pb-16 md:px-16 md:pt-16 md:pb-20">
      <div class="mx-auto grid max-w-[1120px] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div>
          <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">About</span>

          <h1 class="font-display text-display mt-4 font-medium tracking-tight">
            Pongifi: the social table tennis platform
          </h1>

          <p class="text-ink-muted text-body-lg mt-6">
            Pongifi was a vision born out of a group of coworkers in San Diego, California. The need was simple: our
            office ping pong league was getting too serious to keep managing on a whiteboard. We needed something
            functional, informational, and useful for scheduling, scoring, and keeping track of our games. Being
            software engineers, the solution was simple: we decided to digitize and revolutionize the table tennis
            experience, complete with league management, game tracking, and more, and thus, Pongifi was born.
          </p>
        </div>

        <AboutRally />
      </div>
    </section>

    <section class="bg-surface-raised px-6 py-16 md:px-16 md:py-20">
      <div class="mx-auto max-w-[820px] text-center">
        <h2 class="font-display text-h2 font-medium tracking-tight">What Pongifi is</h2>

        <p class="text-ink-muted text-body-lg mt-6">
          Pongifi is the all-in-one league and game management platform for table tennis. Create a league, invite the
          people you already play against, and record games live as you play them or capture them as follow-up events.
          Every result is confirmed by your opponent, ratings update on their own, and the standings end up reflecting
          what actually happened at the table.
        </p>
      </div>
    </section>

    <DifferenceCarousel />

    <PlayContexts />

    <section class="border-border border-t px-6 py-16 md:px-16 md:py-24">
      <div class="mx-auto max-w-[1120px]">
        <div class="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 class="font-display text-h1 font-medium tracking-tight">Get in touch</h2>

            <p class="text-ink-muted text-body-lg mt-4">
              Found a bug, want a feature, or think we got a rule wrong? We would genuinely like to hear it.
            </p>

            <a
              class="text-accent-strong hover:text-accent text-body-lg mt-6 inline-flex items-center gap-2 font-medium transition-colors"
              href="mailto:jens@jens-johnson.com"
            >
              <Icon
                class="size-4"
                name="lucide:mail"
              />
              jens@jens-johnson.com
            </a>
          </div>

          <!--
            The closing call to action is specified to branch on auth state -- a signed-in reader being told to start
            over reads as the product not knowing who they are. There is no session to read yet, so this is the
            signed-out branch; the signed-in variant ("Back to your leagues" pointing at /leagues) goes in once
            authentication lands.
          -->
          <div class="border-border bg-surface rounded-2xl border p-6 md:p-10">
            <h2 class="font-display text-h2 font-medium tracking-tight">Ready for a real leaderboard?</h2>

            <p class="text-ink-muted text-body mt-3">
              Start a league, invite the people you already play against, and let the table settle it.
            </p>

            <a
              class="bg-accent text-accent-ink hover:bg-accent-hover text-body-lg mt-6 inline-block rounded-md px-6 py-3 font-medium transition-colors"
              href="#"
            >
              Start a league
            </a>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
