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

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The signed-in player's account, read from the database rather than the session so the page shows stored truth.
 * @internal
 * @constant
 */
const { data: profile, refresh }: ReturnType<typeof useFetch<IProfile>> = useFetch<IProfile>('/api/me');

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

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Saves a new display name and refreshes the page's copy of the account.
 *
 * The endpoint refreshes the session itself, so the account menu updates without a reload; this only has to bring the
 * page's own data back in line.
 * @internal
 * @function
 * @param displayName - The validated name to save
 */
async function save(displayName: string): Promise<void> {
  await $fetch<IProfile>('/api/me', { body: { displayName }, method: 'PATCH' });

  await refresh();
}

useHead({ title: 'Your profile · Pongifi' });
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <div class="max-w-[560px]">
      <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">Profile</span>

      <h1 class="font-display text-display mt-4 font-medium tracking-tight">Your profile</h1>

      <p class="text-ink-muted text-body-lg mt-6">How you appear in standings, and what Pongifi knows about you.</p>

      <div
        v-if="profile"
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

      <!-- Also in the account menu; a profile page is where people look for it -->
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
