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
 * Default application shell with navigation, theming, and mobile focus management.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Applied automatically to routed pages without an explicit layout.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import type { INavigationLink, TTheme } from '~/types/layout';
import {
  DESKTOP_QUERY,
  FOCUSABLE,
  NAV_LINKS,
  SIGNED_IN_NAV_LINKS,
  SIGNED_IN_PANEL_LINKS,
} from '~/utils/default-layout';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Active application theme.
 * @internal
 * @constant
 */
const theme: Ref<TTheme> = ref('light');

/**
 * Whether the mobile navigation panel is open.
 * @internal
 * @constant
 */
const open: Ref<boolean> = ref(false);

/**
 * The panel itself, used to find the elements the focus trap cycles between.
 * @internal
 * @constant
 */
const panel: Ref<HTMLElement | null> = ref(null);

/**
 * The list of navigation links, which is where focus lands when the panel opens.
 *
 * Focus goes here rather than to the first focusable element, which is the home link in the panel's own header: the
 * point of opening the menu is to reach the menu.
 * @internal
 * @constant
 */
const links: Ref<HTMLElement | null> = ref(null);

/**
 * The control that opened the panel, so focus can be handed back when it closes.
 * @internal
 * @constant
 */
const trigger: Ref<HTMLButtonElement | null> = ref(null);

/**
 * Active route, observed so navigation dismisses the mobile panel.
 * @internal
 * @constant
 */
const route: ReturnType<typeof useRoute> = useRoute();

/**
 * The visitor's session, which decides whether the bar sells the product or navigates it.
 * @internal
 * @constant
 */
const { loggedIn }: ReturnType<typeof useUserSession> = useUserSession();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The links the desktop bar shows for this session.
 * @internal
 * @constant
 */
const barLinks: ComputedRef<readonly INavigationLink[]> = computed((): readonly INavigationLink[] =>
  loggedIn.value ? SIGNED_IN_NAV_LINKS : NAV_LINKS,
);

/**
 * The links the mobile panel shows for this session.
 * @internal
 * @constant
 */
const panelLinks: ComputedRef<readonly INavigationLink[]> = computed((): readonly INavigationLink[] =>
  loggedIn.value ? SIGNED_IN_PANEL_LINKS : NAV_LINKS,
);

/**
 * Whether the account menu should offer only Sign out.
 *
 * On the welcome page Profile would send the player straight back to the welcome page, because the gate holds them
 * there until they finish
 * @internal
 * @constant
 */
const signOutOnly: ComputedRef<boolean> = computed((): boolean => route.path === WELCOME_ROUTE);

/**
 * Ends the session and returns to the public landing page.
 * @internal
 * @constant
 */
const signOut: ReturnType<typeof useSignOut> = useSignOut();

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Flips the palette.
 *
 * A development affordance only -- real theme resolution (system preference, persistence) is not designed yet, so this
 * writes the attribute directly rather than pretending to be the eventual implementation.
 * @internal
 * @function
 */
function toggleTheme(): void {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme.value;
}

/**
 * Closes the panel and returns focus to the control that opened it.
 *
 * Without the hand-back, dismissing the panel drops a keyboard user at the top of the document.
 * @internal
 * @function
 */
function closeMobileNavigation(): void {
  if (!open.value) {
    return;
  }

  open.value = false;
  trigger.value?.focus();
}

/**
 * Keeps Tab inside the panel while it is open.
 *
 * The panel covers the page but does not remove what is underneath from the tab order, so the wrap has to be applied
 * by hand.
 * @internal
 * @function
 * @param event - Keyboard event produced by the active panel.
 */
function trapFocus(event: KeyboardEvent): void {
  if (panel.value === null) {
    return;
  }

  const targets: HTMLElement[] = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first: HTMLElement | undefined = targets.at(0);
  const last: HTMLElement | undefined = targets.at(-1);

  if (first === undefined || last === undefined) {
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Handles the keys the panel owns while it is open.
 * @internal
 * @function
 * @param event - Keyboard event dispatched by the window.
 */
function onKeydown(event: KeyboardEvent): void {
  if (!open.value) {
    return;
  }

  if (event.key === 'Escape') {
    closeMobileNavigation();
  } else if (event.key === 'Tab') {
    trapFocus(event);
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// navigating is a dismissal: the panel covers the page the link just loaded
watch((): string => route.fullPath, closeMobileNavigation);

watch(open, (isOpen: boolean): void => {
  // the page behind the panel must not scroll under it
  document.body.style.overflow = isOpen ? 'hidden' : '';

  if (isOpen) {
    void nextTick((): void => {
      links.value?.querySelector<HTMLElement>('a[href]')?.focus();
    });
  }
});

onMounted((): void => {
  window.addEventListener('keydown', onKeydown);

  // crossing into the desktop layout hides the panel by CSS, which would otherwise strand the scroll lock
  window.matchMedia(DESKTOP_QUERY).addEventListener('change', closeMobileNavigation);
});

onBeforeUnmount((): void => {
  window.removeEventListener('keydown', onKeydown);
  window.matchMedia(DESKTOP_QUERY).removeEventListener('change', closeMobileNavigation);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="bg-bg text-ink min-h-dvh">
    <nav class="flex items-center justify-between px-6 py-4 md:px-16 md:py-6">
      <NuxtLink
        aria-label="Pongifi home"
        class="text-ink hover:text-accent-strong block transition-colors"
        to="/"
      >
        <BrandPongifiWordmark class="h-7 w-auto" />
      </NuxtLink>

      <div class="text-ink-muted text-body hidden items-center gap-8 md:flex">
        <NuxtLink
          v-for="link in barLinks"
          :key="link.to"
          :to="link.to"
          active-class="text-accent-strong"
          class="hover:text-accent-strong transition-colors"
        >
          {{ link.label }}
        </NuxtLink>
      </div>

      <div class="flex items-center gap-2 md:gap-4">
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

        <WidgetsAccountMenu
          v-if="loggedIn"
          :sign-out-only="signOutOnly"
        />

        <NuxtLink
          v-else
          class="text-accent-strong hover:text-accent text-body hidden whitespace-nowrap transition-colors md:inline"
          :to="SIGN_IN_ROUTE"
        >
          Sign In / Register
        </NuxtLink>

        <button
          ref="trigger"
          aria-controls="mobile-nav"
          :aria-expanded="open"
          aria-label="Open menu"
          class="text-ink-muted hover:text-accent-strong flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors md:hidden"
          type="button"
          @click="open = true"
        >
          <Icon
            class="size-5"
            name="lucide:menu"
          />
        </button>
      </div>
    </nav>

    <!--
      A full screen panel rather than a sheet under the navigation: it carries its own header, so it never has to
      guess at the height of the bar above it.
    -->
    <Transition name="menu">
      <div
        v-if="open"
        id="mobile-nav"
        ref="panel"
        class="bg-bg fixed inset-0 z-50 flex flex-col md:hidden"
      >
        <div class="flex items-center justify-between px-6 py-4">
          <NuxtLink
            aria-label="Pongifi home"
            class="text-ink block"
            to="/"
            @click="closeMobileNavigation"
          >
            <BrandPongifiWordmark class="h-7 w-auto" />
          </NuxtLink>

          <button
            aria-label="Close menu"
            class="text-ink-muted hover:text-accent-strong flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors"
            type="button"
            @click="closeMobileNavigation"
          >
            <Icon
              class="size-5"
              name="lucide:x"
            />
          </button>
        </div>

        <div class="flex flex-1 flex-col justify-between px-6 pt-6 pb-10">
          <div
            ref="links"
            class="flex flex-col"
          >
            <NuxtLink
              v-for="link in panelLinks"
              :key="link.to"
              :to="link.to"
              active-class="text-accent-strong"
              class="font-display text-h1 hover:text-accent-strong border-border border-b py-5 font-medium tracking-tight transition-colors"
              @click="closeMobileNavigation"
            >
              {{ link.label }}
            </NuxtLink>
          </div>

          <div class="mt-10">
            <!-- the bar's own theme control sits behind this panel, so it is repeated rather than left unreachable -->
            <button
              class="border-border text-body-lg flex w-full cursor-pointer items-center justify-between border-b py-5"
              type="button"
              @click="toggleTheme"
            >
              <span>Appearance</span>

              <!-- unlike the bar's icon-only toggle, this pairs with a label, so both report state rather than action -->
              <span class="text-ink-muted text-body flex items-center gap-2">
                <Icon
                  :name="theme === 'light' ? 'lucide:sun' : 'lucide:moon'"
                  class="size-4"
                />
                {{ theme === 'light' ? 'Light' : 'Dark' }}
              </span>
            </button>

            <template v-if="loggedIn">
              <NuxtLink
                v-if="!signOutOnly"
                class="border-border text-body-lg block border-b py-5"
                :to="PROFILE_ROUTE"
                @click="closeMobileNavigation"
              >
                Profile
              </NuxtLink>

              <button
                class="text-accent-strong text-body-lg mt-8 block w-full cursor-pointer text-left font-medium"
                type="button"
                @click="signOut()"
              >
                Sign out
              </button>
            </template>

            <NuxtLink
              v-else
              class="bg-accent text-accent-ink hover:bg-accent-hover text-body-lg mt-8 block rounded-md px-6 py-4 text-center font-medium transition-colors"
              :to="SIGN_IN_ROUTE"
            >
              Sign In / Register
            </NuxtLink>
          </div>
        </div>
      </div>
    </Transition>

    <slot />
  </div>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 200ms ease,
    translate 200ms ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  translate: 0 -8px;
}

@media (prefers-reduced-motion: reduce) {
  .menu-enter-active,
  .menu-leave-active {
    transition: none;
  }
}
</style>
