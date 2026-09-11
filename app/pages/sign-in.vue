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
 * ████████████████████████████████████████████████ #pages/sign-in.vue █████████████████████████████████████████████████
 *
 * The public sign-in page: provider commands, and the failure state the OAuth callback redirects to.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /sign-in
 * GET /sign-in?redirect=<path>  the return path, narrowed to a same-origin path
 * GET /sign-in?error=oauth      the callback could not complete the sign-in
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The visitor's session, read only to bounce someone who is already signed in, and refreshed before that is trusted
 * @internal
 * @constant
 */
const { fetch: refreshSession, loggedIn }: ReturnType<typeof useUserSession> = useUserSession();

/**
 * The current route, read for the return path and the callback's failure flag
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Where to send the visitor once they are signed in.
 *
 * Narrowed rather than trusted: the value is attacker-controlled, so anything that is not a same-origin path resolves
 * to the default destination
 * @internal
 * @constant
 */
const destination: ComputedRef<string> = computed((): string => resolveSignInRedirect(route.query.redirect));

/**
 * The Google handler URL, carrying the validated return path when it differs from the default destination
 * @internal
 * @constant
 */
const googleCommand: ComputedRef<string> = computed((): string => buildGoogleSignInCommand(route.query.redirect));

/**
 * Whether the callback sent the visitor back here because the sign-in did not complete.
 *
 * Compared strictly, so a repeated query key arriving as an array cannot switch the state on
 * @internal
 * @constant
 */
const failed: ComputedRef<boolean> = computed((): boolean => route.query.error === 'oauth');

// Keep the public authentication route out of search results while giving it a useful browser title
useHead({
  meta: [{ content: 'noindex', name: 'robots' }],
  title: 'Sign in · Pongifi',
});

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

onMounted(async (): Promise<void> => {
  // Someone with no session at all is exactly who this page is for
  if (!loggedIn.value) {
    return;
  }

  /* Confirmed against the cookie before it is acted on. The client's copy is a cache, and this bounce is the one place
     where trusting a stale one costs more than a wrong hop: the destination is a private page, and a private page
     whose session has ended sends the visitor back here, which would bounce them again. Whatever leaves the copy
     stale, the sealed cookie settles it, and a refresh that finds no session leaves the visitor on this page */
  await refreshSession();

  // Someone who is already signed in has nothing to do here; send them where they were going
  if (loggedIn.value) {
    await navigateTo(destination.value);
  }
});
</script>

<template>
  <main class="px-6 pt-12 pb-16 md:px-16 md:pt-22 md:pb-26">
    <div class="mx-auto max-w-[420px]">
      <!-- Heading -->
      <span class="text-accent-strong text-caption font-mono tracking-widest uppercase">Sign in</span>

      <h1 class="font-display text-display mt-4 font-medium tracking-tight">Start a league.</h1>

      <p class="text-ink-muted text-body-lg mt-6">
        One account, then invite the people you already play against and let the table settle it.
      </p>

      <!-- Failure state; the command below stays available so the visitor can simply try again -->
      <div
        v-if="failed"
        class="bg-negative-soft text-negative-soft-ink mt-8 flex gap-3 rounded-lg p-4"
        role="alert"
      >
        <Icon
          aria-hidden="true"
          class="mt-0.5 size-4 shrink-0"
          name="lucide:circle-alert"
        />

        <p class="text-body-sm">That sign-in did not go through. Nothing was created, so you can try again.</p>
      </div>

      <!-- Provider commands -->
      <div class="border-border bg-surface mt-8 rounded-lg border p-6">
        <WidgetsAccountGoogleCommand :href="googleCommand" />

        <p class="text-ink-subtle text-body-sm mt-4">
          Pongifi reads your name, email address and profile picture, and nothing else.
        </p>
      </div>

      <p class="text-ink-subtle text-body-sm mt-6">
        Signing in creates your account if you do not have one yet. Questions first?
        <NuxtLink
          class="text-accent-strong hover:text-accent underline underline-offset-4 transition-colors"
          :to="FAQ_ROUTE"
          >Read the FAQ</NuxtLink
        >.
      </p>
    </div>
  </main>
</template>
