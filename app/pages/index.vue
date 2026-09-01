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
 * Unauthenticated landing route: hero with the dithered backdrop, product framing, and the single sign-in CTA.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
type TTheme = 'light' | 'dark';

/**
 *
 */
const theme = ref<TTheme>('light');

/**
 * Flips the palette.
 *
 * A development affordance only — real theme resolution (system preference, persistence) is not designed yet, so this
 * writes the attribute directly rather than pretending to be the eventual implementation.
 */
const toggleTheme = (): void => {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme.value;
};
</script>

<template>
  <main class="bg-bg text-ink min-h-dvh">
    <nav class="flex items-center justify-between px-16 py-6">
      <span class="font-display text-h2 font-medium tracking-tight">Pongifi</span>

      <div class="text-ink-muted text-body hidden items-center gap-8 md:flex">
        <a
          class="hover:text-ink transition-colors"
          href="#how"
          >How it works</a
        >

        <a
          class="hover:text-ink transition-colors"
          href="#why"
          >Why Pongifi</a
        >

        <a
          class="hover:text-ink transition-colors"
          href="#faq"
          >FAQ</a
        >
      </div>

      <div class="flex items-center gap-4">
        <button
          class="border-border text-ink-muted hover:text-ink text-body-sm rounded-md border px-3 py-1.5 transition-colors"
          type="button"
          @click="toggleTheme"
        >
          {{ theme === 'light' ? 'Dark' : 'Light' }}
        </button>

        <a
          class="text-brand hover:text-brand-hover text-body transition-colors"
          href="#"
          >Sign in</a
        >
      </div>
    </nav>

    <section class="relative overflow-hidden px-16 pt-22 pb-26">
      <div class="pointer-events-none absolute inset-y-0 right-16 w-[38%] overflow-hidden">
        <ClientOnly>
          <HeroShader />
        </ClientOnly>
      </div>

      <div class="relative z-10 max-w-[560px]">
        <span class="bg-brand-soft text-brand-soft-ink text-body-sm inline-block rounded-full px-3 py-1.5 font-medium">
          For offices, clubs and garages
        </span>

        <h1 class="font-display text-hero mt-6 font-medium tracking-tight text-balance">
          Ping pong,<br />properly scored.
        </h1>

        <p class="text-ink-muted text-body-lg mt-6">
          Start a league with the people you already play against. Record every game, and let the ratings settle who is
          actually best — with every result confirmed by the person across the table.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <a
            class="bg-brand text-brand-ink hover:bg-brand-hover text-body-lg rounded-md px-6 py-3 font-medium transition-colors"
            href="#"
          >
            Continue with Google
          </a>

          <a
            class="text-brand hover:text-brand-hover text-body-lg rounded-md px-4 py-3 font-medium"
            href="#how"
          >
            See how it works →
          </a>
        </div>

        <p class="text-ink-subtle text-body-sm mt-6">Free to use · No app to install</p>
      </div>
    </section>
  </main>
</template>
