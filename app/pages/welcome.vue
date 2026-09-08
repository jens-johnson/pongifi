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
 * ████████████████████████████████████████████████ #pages/welcome.vue █████████████████████████████████████████████████
 *
 * The one-time step between a first sign-in and the rest of the product.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /welcome
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { IProfile } from '#shared/profile';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The account created moments ago by the first Google sign-in.
 * @internal
 * @constant
 */
const { data: profile }: ReturnType<typeof useFetch<IProfile>> = useFetch<IProfile>('/api/me');

/**
 * The current route, read for the destination the player was heading to before this step.
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Saves the name, marks onboarding finished, and continues to wherever the player was going.
 *
 * The destination is narrowed rather than trusted, and a destination pointing back at this page is treated as absent,
 * so completing the step can never return the player to it.
 * @internal
 * @function
 * @param displayName - The validated name to save
 */
async function complete(displayName: string): Promise<void> {
  await $fetch<IProfile>('/api/me/complete', { body: { displayName }, method: 'POST' });

  await navigateTo(resolveWelcomeRedirect(route.query.redirect));
}

// Nothing here belongs in search results, and the page exists once per account
useHead({ meta: [{ content: 'noindex', name: 'robots' }], title: 'Welcome · Pongifi' });
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <div class="mx-auto max-w-[420px]">
      <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">Welcome</span>

      <h1 class="font-display text-display mt-4 font-medium tracking-tight">What should we call you?</h1>

      <p class="text-ink-muted text-body-lg mt-6">
        This is the name that shows up in standings, so pick one the people you play against will recognise.
      </p>

      <div
        v-if="profile"
        class="border-border bg-surface mt-8 rounded-lg border p-6"
      >
        <div class="flex items-center gap-4">
          <WidgetsAccountAvatar
            :avatar-url="profile.avatarUrl"
            :display-name="profile.displayName"
            size="lg"
          />

          <p class="text-ink-subtle text-caption">Photo from your Google account.</p>
        </div>

        <div class="mt-8">
          <!-- No Skip: continuing with the prefilled name is the skip, and it is one keypress -->
          <WidgetsAccountNameForm
            auto-focus
            failure-message="That did not save. You are still signed in; try again."
            helper="You can change it later from your profile."
            :initial-name="profile.displayName"
            pending-label="Saving"
            :require-change="false"
            :submit="complete"
            submit-label="Continue"
          />
        </div>
      </div>
    </div>
  </main>
</template>
