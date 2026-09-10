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
 * ████████████████████████████████████████████████ #pages/profile.vue █████████████████████████████████████████████████
 *
 * The signed-in player's private account page.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /profile
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
 * The signed-in player's account, read from the database rather than the session so the page shows stored truth, with
 * the request status the page's states are drawn from.
 * @internal
 * @constant
 */
const { data: profile, error, refresh, status }: ReturnType<typeof useFetch<IProfile>> = useFetch<IProfile>('/api/me');

/**
 * The client's copy of the session, refreshed by hand after a rename replaces the sealed cookie.
 * @internal
 * @constant
 */
const { fetch: refreshSession, user }: ReturnType<typeof useUserSession> = useUserSession();

/**
 * Ends the session and returns to the public landing page.
 * @internal
 * @constant
 */
const signOut: ReturnType<typeof useSignOut> = useSignOut();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * When the account was created, as the month and year shown beneath the email.
 * @internal
 * @constant
 */
const memberSince: ComputedRef<string> = computed((): string =>
  profile.value ? toMonthYear(profile.value.createdAt) : '',
);

/**
 * What the page draws: the account card, a skeleton, a retryable failure, or nothing while sign-in is being reached.
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
 * Saves a new display name and brings both copies of the account back in line.
 *
 * The endpoint replaces the sealed cookie, but the account menu renders from the client's copy of the session, which
 * is a cache the server cannot write to. Both are refreshed here, so the menu and the greeting change with the page
 * rather than at the next reload. Neither refresh is allowed to fail the save that already happened: a refresh that
 * produced no session leaves the client believing nobody is signed in, and the page is rendered from the cookie
 * instead.
 * @internal
 * @function
 * @param displayName - The validated name to save
 */
async function save(displayName: string): Promise<void> {
  await $fetch<IProfile>('/api/me', { body: { displayName }, method: 'PATCH' });

  await Promise.all([refresh(), refreshSession()]);

  const handoff: SessionHandoff = resolveSessionHandoff({
    needsWelcome: user.value?.needsWelcome ?? true,
    refreshed: user.value !== null,
  });

  if (handoff === SessionHandoff.RELOAD) {
    reloadNuxtApp({ persistState: false });
  }
}

useHead({ title: 'Your profile · Pongifi' });
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <div class="max-w-[560px]">
      <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">Profile</span>

      <h1 class="font-display text-display mt-4 font-medium tracking-tight">Your profile</h1>

      <p class="text-ink-muted text-body-lg mt-6">How you appear in standings, and what Pongifi knows about you.</p>

      <!-- Failure is drawn before the card: a heading with nothing under it reads as an account that has vanished -->
      <div
        v-if="readState === AccountReadState.FAILED"
        class="border-border bg-surface mt-10 rounded-lg border p-6 md:p-8"
        role="alert"
      >
        <p class="text-ink text-body">Could not load your profile.</p>

        <p class="text-ink-muted text-body mt-2">You are still signed in, and nothing has changed.</p>

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
        class="border-border bg-surface mt-10 rounded-lg border p-6 md:p-8"
      >
        <div class="bg-surface-raised h-14 animate-pulse rounded-md" />

        <div class="bg-surface-raised mt-8 h-28 animate-pulse rounded-md" />

        <div class="bg-surface-raised mt-8 h-24 animate-pulse rounded-md" />
      </div>

      <div
        v-else-if="readState === AccountReadState.READY && profile"
        class="border-border bg-surface mt-10 rounded-lg border p-6 md:p-8"
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
          <WidgetsAccountNameForm
            confirm
            failure-message="That did not save. Your name is unchanged; try again."
            helper="This is how you appear in standings, so make it recognisable to the people you play against."
            :initial-name="profile.displayName"
            pending-label="Saving"
            show-cancel
            :submit="save"
            submit-label="Save"
          />
        </div>

        <dl class="border-border mt-8 space-y-4 border-t pt-8">
          <div>
            <dt class="text-ink-subtle text-caption">Email</dt>

            <dd class="text-ink text-body mt-1 break-all">{{ profile.email }}</dd>

            <dd class="text-ink-subtle text-caption mt-1">Verified with Google</dd>
          </div>

          <div>
            <dt class="text-ink-subtle text-caption">Member since</dt>

            <dd class="text-ink text-body mt-1">{{ memberSince }}</dd>
          </div>
        </dl>
      </div>

      <!-- Also in the account menu; a profile page is where people look for it, and a failed read does not hide it -->
      <button
        class="border-border text-ink hover:border-accent text-body mt-8 rounded-md border px-6 py-3 font-medium transition-colors"
        type="button"
        @click="signOut()"
      >
        Sign out
      </button>
    </div>
  </main>
</template>
