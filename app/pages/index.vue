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
 * Unauthenticated landing route: rotating hero headline over the dithered backdrop, with the single sign-in entry
 * point.
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
 * A development affordance only -- real theme resolution (system preference, persistence) is not designed yet, so this
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
      <NuxtLink
        aria-label="Pongifi home"
        class="text-ink hover:text-accent-strong block transition-colors"
        to="/"
      >
        <PongifiWordmark class="h-7 w-auto" />
      </NuxtLink>

      <div class="text-ink-muted text-body hidden items-center gap-8 md:flex">
        <a
          class="hover:text-accent-strong transition-colors"
          href="#about"
          >About</a
        >

        <a
          class="hover:text-accent-strong transition-colors"
          href="#features"
          >Features</a
        >

        <a
          class="hover:text-accent-strong transition-colors"
          href="#faq"
          >FAQ</a
        >
      </div>

      <div class="flex items-center gap-4">
        <button
          :aria-label="theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'"
          class="text-ink-muted hover:text-accent-strong flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors"
          type="button"
          @click="toggleTheme"
        >
          <Icon
            :name="theme === 'light' ? 'lucide:moon' : 'lucide:sun'"
            class="size-4"
          />
        </button>

        <a
          class="text-accent-strong hover:text-accent text-body whitespace-nowrap transition-colors"
          href="#"
        >
          Sign In / Register
        </a>
      </div>
    </nav>

    <section class="relative overflow-hidden px-16 pt-22 pb-26">
      <div class="pointer-events-none absolute inset-y-0 right-16 w-[38%] overflow-hidden">
        <ClientOnly>
          <HeroShader />
        </ClientOnly>
      </div>

      <div class="relative z-10 max-w-[620px]">
        <!-- height is reserved for the longest line so a rotation never shifts the copy below it -->
        <h1 class="font-display text-hero min-h-[140px] font-medium tracking-tight">
          <HeroHeadline />
        </h1>

        <p class="text-ink-muted text-body-lg mt-6 max-w-[520px]">
          Start a league. Compete with your family and friends. Climb the leaderboards.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <a
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-lg rounded-md px-6 py-3 font-medium transition-colors"
            href="#"
          >
            Get Started
          </a>

          <a
            class="text-accent-strong hover:text-accent text-body-lg flex items-center gap-1.5 rounded-md px-4 py-3 font-medium"
            href="#about"
          >
            See how it works
            <Icon
              class="size-4"
              name="lucide:arrow-right"
            />
          </a>
        </div>
      </div>
    </section>
  </main>
</template>
