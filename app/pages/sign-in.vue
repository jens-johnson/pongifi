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
 * The visitor's session, read only to bounce someone who is already signed in
 * @internal
 * @constant
 */
const { loggedIn }: ReturnType<typeof useUserSession> = useUserSession();

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
        <!-- A document navigation, not a route change: the target is a server handler rather than a page -->
        <a
          class="border-border text-ink hover:border-accent flex min-h-12 items-center justify-center gap-3 rounded-md border px-6 py-3 font-medium transition-colors"
          :href="googleCommand"
        >
          <!-- Inlined rather than an Icon: only the lucide collection is installed locally, and it carries no marks -->
          <svg
            aria-hidden="true"
            class="size-5 shrink-0"
            viewBox="0 0 48 48"
          >
            <path
              d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
              fill="#4285f4"
            />

            <path
              d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z"
              fill="#34a853"
            />

            <path
              d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
              fill="#fbbc05"
            />

            <path
              d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
              fill="#ea4335"
            />
          </svg>

          Continue with Google
        </a>

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
