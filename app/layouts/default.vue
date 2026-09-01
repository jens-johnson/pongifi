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
 * ███████████████████████████████████████████████ #layouts/default.vue ████████████████████████████████████████████████
 *
 * Default layout: the marketing navigation shared by the landing page and the standalone About, Features and FAQ
 * routes.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
type TTheme = 'light' | 'dark';

/**
 *
 */
const NAV_LINKS: readonly { label: string; to: string }[] = [
  { label: 'About', to: '/about' },
  { label: 'Features', to: '/features' },
  { label: 'FAQ', to: '/faq' },
];

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
  <div class="bg-bg text-ink min-h-dvh">
    <nav class="flex items-center justify-between px-16 py-6">
      <NuxtLink
        aria-label="Pongifi home"
        class="text-ink hover:text-accent-strong block transition-colors"
        to="/"
      >
        <PongifiWordmark class="h-7 w-auto" />
      </NuxtLink>

      <div class="text-ink-muted text-body hidden items-center gap-8 md:flex">
        <NuxtLink
          v-for="link in NAV_LINKS"
          :key="link.to"
          :to="link.to"
          active-class="text-accent-strong"
          class="hover:text-accent-strong transition-colors"
        >
          {{ link.label }}
        </NuxtLink>
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

    <slot />
  </div>
</template>
