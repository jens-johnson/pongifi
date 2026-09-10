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

import type { ComputedRef } from 'vue';

import type { IProfile } from '#shared/profile';
import { AccountReadState, type IAccountReadStateInput } from '~/utils/account/read-state';
import { SessionHandoff } from '~/utils/session/handoff';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The account created moments ago by the first Google sign-in, with the request status the page's states are drawn
 * from.
 * @internal
 * @constant
 */
const { data: profile, error, refresh, status }: ReturnType<typeof useFetch<IProfile>> = useFetch<IProfile>('/api/me');

/**
 * The client's copy of the session, refreshed by hand after the completion write replaces the sealed cookie.
 * @internal
 * @constant
 */
const { fetch: refreshSession, user }: ReturnType<typeof useUserSession> = useUserSession();

/**
 * The current route, read for the destination the player was heading to before this step.
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the page draws: the form, a skeleton, a retryable failure, or nothing while sign-in is being reached.
 *
 * The composable also leaves for sign-in when the read comes back unauthorized, which is the one state a retry
 * cannot recover
 * @internal
 * @constant
 */
const readState: ComputedRef<AccountReadState> = useAccountReadState((): IAccountReadStateInput => ({
  errorStatusCode: error.value?.statusCode ?? null,
  hasData: Boolean(profile.value),
  status: status.value,
}));

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Saves the name, marks onboarding finished, and continues to wherever the player was going.
 *
 * The destination is narrowed rather than trusted, and a destination pointing back at this page is treated as absent,
 * so completing the step can never return the player to it. Once the write returns, the client's session is refreshed
 * before anything navigates: the endpoint replaces the sealed cookie, but the route gate reads the client's copy, and
 * an unrefreshed copy still says the welcome step is outstanding and sends the player straight back here. Nothing
 * after the write is allowed to throw, because the form would report a save that already happened as a failure.
 * @internal
 * @function
 * @param displayName - The validated name to save
 */
async function complete(displayName: string): Promise<void> {
  await $fetch<IProfile>('/api/me/complete', { body: { displayName }, method: 'POST' });

  const destination: string = resolveWelcomeRedirect(route.query.redirect);

  await refreshSession();

  const handoff: SessionHandoff = resolveSessionHandoff({
    needsWelcome: user.value?.needsWelcome ?? true,
    refreshed: user.value !== null,
  });

  if (handoff === SessionHandoff.CLIENT) {
    await navigateTo(destination);

    return;
  }

  // The cookie the server just replaced is the authoritative one, so the destination is rendered from it instead
  reloadNuxtApp({ path: destination, persistState: false });
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

      <!-- Failure is drawn before the form: a heading with nothing under it leaves the step impossible to finish -->
      <div
        v-if="readState === AccountReadState.FAILED"
        class="border-border bg-surface mt-8 rounded-lg border p-6"
        role="alert"
      >
        <p class="text-ink text-body">Could not load your account.</p>

        <p class="text-ink-muted text-body mt-2">You are still signed in. This step is waiting whenever you are.</p>

        <button
          class="border-border text-ink hover:border-accent text-body-sm mt-4 rounded-md border px-4 py-2 font-medium transition-colors"
          type="button"
          @click="refresh()"
        >
          Retry
        </button>
      </div>

      <!-- A skeleton at the card's height rather than a spinner, so the page does not resize when the answer arrives -->
      <div
        v-else-if="readState === AccountReadState.PENDING"
        aria-hidden="true"
        class="border-border bg-surface mt-8 rounded-lg border p-6"
      >
        <div class="bg-surface-raised h-14 animate-pulse rounded-md" />

        <div class="bg-surface-raised mt-8 h-28 animate-pulse rounded-md" />
      </div>

      <div
        v-else-if="readState === AccountReadState.READY && profile"
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
