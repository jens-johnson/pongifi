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
 * █████████████████████████████████████████████ #pages/invite/[token].vue █████████████████████████████████████████████
 *
 * The invite landing, signed out, unfinished or complete; joining is an explicit POST from here.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /invite/:token
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import type { IAcceptInviteResponse, IInviteSummary, TInviteLookup } from '#shared/leagues';
import { InviteLookupKind } from '#shared/leagues';
import { describeMemberCount } from '~/utils/leagues/display';
import { classifyWriteFailure, WriteFailure } from '~/utils/leagues/write-failure';
import { HOME_ROUTE, LEAGUES_ROUTE, WELCOME_ROUTE } from '~/utils/marketing/routes';
import { buildGatedReturnPath } from '~/utils/session/gate';
import { buildGoogleSignInCommand } from '~/utils/sign-in/redirect';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The current route, read for the token the visitor opened and the full path the sign-in continuation carries.
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/**
 * The visitor's session; this page is not gated, so it handles signed out, unfinished and complete itself.
 * @internal
 * @constant
 */
const { loggedIn, user }: ReturnType<typeof useUserSession> = useUserSession();

/**
 * The lookup: the league a member belongs to, or the summary of a usable invite. Awaited so the server can redirect a
 * member or an unfinished account before anything renders.
 * @internal
 * @constant
 */
const {
  data: lookup,
  error,
  refresh,
}: Awaited<ReturnType<typeof useFetch<TInviteLookup>>> = await useFetch<TInviteLookup>(
  (): string => `/api/invitations/${String(route.params.token)}`,
  { key: `invite-${String(route.params.token)}` },
);

/**
 * Whether the acceptance is in flight.
 * @internal
 * @constant
 */
const joining: Ref<boolean> = ref(false);

/**
 * Whether the last acceptance failed without the invite dying, which keeps the summary and shows one alert.
 * @internal
 * @constant
 */
const joinFailed: Ref<boolean> = ref(false);

/**
 * The exits a 401 or a welcome-owing 403 takes.
 * @internal
 * @constant
 */
const exit: ReturnType<typeof useSessionExit> = useSessionExit();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The invite summary when the lookup found a usable invite, or null.
 * @internal
 * @constant
 */
const summary: ComputedRef<IInviteSummary | null> = computed((): IInviteSummary | null =>
  lookup.value?.kind === InviteLookupKind.INVITE ? lookup.value : null,
);

/**
 * Whether the lookup was refused for the connection rather than the invite.
 * @internal
 * @constant
 */
const rateLimited: ComputedRef<boolean> = computed((): boolean => error.value?.statusCode === 429);

/**
 * Whether the invite is unavailable: unknown, expired, revoked, exhausted or refused, all one state.
 * @internal
 * @constant
 */
const unavailable: ComputedRef<boolean> = computed((): boolean => error.value?.statusCode === 404);

/**
 * Where this invite sends the visitor without rendering anything, or null when it renders.
 *
 * A member goes to their league whether or not the link still works. An account that still owes /welcome goes there
 * first, carrying this page back, but only for a usable invite: a dead link is not a reason to begin onboarding
 * @internal
 * @constant
 */
const destination: ComputedRef<string | null> = computed((): string | null => {
  if (lookup.value?.kind === InviteLookupKind.MEMBER) {
    return `${LEAGUES_ROUTE}/${lookup.value.leagueId}`;
  }

  if (summary.value && loggedIn.value && user.value?.needsWelcome) {
    return buildGatedReturnPath(WELCOME_ROUTE, route.fullPath);
  }

  return null;
});

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Joins the league, and on any failure other than a definite refusal re-runs the lookup before showing anything.
 *
 * After a lost answer the lookup is what says whether the membership committed: if it did, the lookup now answers
 * with the league and the page goes there, so the player never sees Join for a league they are already in
 * @internal
 * @function
 */
async function onJoin(): Promise<void> {
  joining.value = true;
  joinFailed.value = false;

  try {
    const { leagueId }: IAcceptInviteResponse = await $fetch<IAcceptInviteResponse>(
      `/api/invitations/${String(route.params.token)}/accept`,
      { method: 'POST' },
    );

    await navigateTo(`${LEAGUES_ROUTE}/${leagueId}`, { replace: true });
  } catch (caught: unknown) {
    const failure: WriteFailure = classifyWriteFailure(caught);

    if (failure === WriteFailure.UNAUTHORIZED) {
      await exit.toSignIn();

      return;
    }

    // A refused unfinished account is the signal to take the welcome detour; nothing was accepted
    if (failure === WriteFailure.FORBIDDEN && (await exit.toWelcomeIfOwed())) {
      return;
    }

    // The invite died between load and click, or the outcome is unknown: the lookup decides what renders next
    if (failure === WriteFailure.NOT_FOUND || failure === WriteFailure.UNCERTAIN) {
      await refresh();
    }

    joinFailed.value = failure !== WriteFailure.NOT_FOUND;
  } finally {
    joining.value = false;
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// Awaited here so the server answers with the redirect before rendering anything
if (destination.value) {
  await navigateTo(destination.value, { replace: true });
}

// A later lookup can change the answer too: after a lost acceptance, or a refresh that finds the invite taken
watch(destination, async (target: string | null): Promise<void> => {
  if (target) {
    await navigateTo(target, { replace: true });
  }
});

useHead({
  meta: [{ content: 'noindex', name: 'robots' }],
  title: (): string => (summary.value ? "You're invited · Pongifi" : 'Invite · Pongifi'),
});
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <div class="mx-auto max-w-[480px]">
      <!-- Unavailable and rate-limited share one layout: no league name, no inviter, no sign-in button (flow 10.2) -->
      <template v-if="unavailable || rateLimited">
        <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">Invite</span>

        <h1 class="font-display text-display mt-4 font-medium tracking-tight">This invite isn't available.</h1>

        <p class="text-ink-muted text-body-lg mt-6">
          {{
            rateLimited
              ? 'Too many attempts from this connection. Wait a minute and open the link again.'
              : 'It may have expired, been replaced, or reached its limit. Ask the person who sent it for a new one.'
          }}
        </p>

        <NuxtLink
          class="text-accent-strong hover:text-accent text-body-lg mt-6 inline-block font-medium"
          :to="HOME_ROUTE"
        >
          {{ loggedIn ? 'Back to your dashboard' : 'Pongifi home' }}
        </NuxtLink>
      </template>

      <div
        v-else-if="error"
        class="border-border bg-surface rounded-lg border p-6"
        role="alert"
      >
        <p class="text-ink text-body">Could not load this invite.</p>

        <button
          class="border-border text-ink hover:border-accent text-body-sm mt-4 rounded-md border px-4 py-2 font-medium transition-colors"
          type="button"
          @click="refresh()"
        >
          Retry
        </button>
      </div>

      <!-- A usable invite, drawn only when it is not about to redirect -->
      <template v-else-if="summary && !destination">
        <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">You're invited</span>

        <h1 class="font-display text-display mt-4 font-medium tracking-tight break-words">{{ summary.leagueName }}</h1>

        <p class="text-ink-muted text-body-lg mt-6">
          {{ summary.inviterName }} invited you to join. {{ describeMemberCount(summary.memberCount) }}
        </p>

        <div
          v-if="!loggedIn"
          class="border-border bg-surface mt-8 rounded-lg border p-6"
        >
          <WidgetsAccountGoogleCommand :href="buildGoogleSignInCommand(route.fullPath)" />

          <p class="text-ink-subtle text-body-sm mt-4">Pongifi uses your Google account to sign in.</p>
        </div>

        <div
          v-else
          class="mt-8"
        >
          <p
            v-if="joinFailed"
            class="bg-negative-soft text-negative-soft-ink text-body-sm mb-6 rounded-lg p-4"
            role="alert"
          >
            Pongifi could not add you to the league. Try again.
          </p>

          <div class="flex flex-wrap items-center gap-3">
            <button
              class="bg-accent text-accent-ink hover:bg-accent-hover text-body rounded-md px-6 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="joining"
              type="button"
              @click="onJoin"
            >
              {{ joining ? 'Joining…' : `Join ${summary.leagueName}` }}
            </button>

            <!-- Local navigation only: declining a shared link changes nothing on the server -->
            <NuxtLink
              class="text-ink-muted hover:text-ink text-body rounded-md px-4 py-3 font-medium transition-colors"
              :to="HOME_ROUTE"
            >
              Not now
            </NuxtLink>
          </div>
        </div>
      </template>
    </div>
  </main>
</template>
