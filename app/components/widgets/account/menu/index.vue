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
 * ████████████████████████████████████ #components/widgets/account/menu/index.vue █████████████████████████████████████
 *
 * The signed-in account menu in the top bar: profile and sign out.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsAccountMenu :sign-out-only="isWelcome" />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • signOutOnly
 *     - Description: offer only sign out, as the welcome page does
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */
/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { TPropsWithDefaults } from '@jens-johnson/style-guide/types/vue';
import type { Ref } from 'vue';

import type { IAccountMenuProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Which items this placement offers.
 * @internal
 * @constant
 */
const props: TPropsWithDefaults<IAccountMenuProps, 'signOutOnly'> = withDefaults(defineProps<IAccountMenuProps>(), {
  signOutOnly: false,
});

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The signed-in player, read for the trigger's avatar and name.
 * @internal
 * @constant
 */
const { user }: ReturnType<typeof useUserSession> = useUserSession();

/**
 * Whether the menu is open.
 * @internal
 * @constant
 */
const open: Ref<boolean> = ref(false);

/**
 * The whole menu, used to tell a click inside it from one that should dismiss it.
 * @internal
 * @constant
 */
const container: Ref<HTMLElement | null> = ref(null);

/**
 * The control that opened the menu, so focus can be handed back when it closes.
 * @internal
 * @constant
 */
const trigger: Ref<HTMLButtonElement | null> = ref(null);

/**
 * Ends the session and returns to the public landing page.
 * @internal
 * @constant
 */
const signOut: ReturnType<typeof useSignOut> = useSignOut();

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Closes the menu and returns focus to its trigger.
 *
 * Without the hand-back, dismissing the menu drops a keyboard user at the top of the document, which is the same
 * behaviour the mobile panel already avoids.
 * @internal
 * @function
 */
function close(): void {
  if (!open.value) {
    return;
  }

  open.value = false;
  trigger.value?.focus();
}

/**
 * Dismisses the menu when the pointer goes down anywhere outside it.
 * @internal
 * @function
 * @param event - The pointer event to test against the menu's bounds
 */
function onPointerDown(event: PointerEvent): void {
  if (open.value && !container.value?.contains(event.target as Node)) {
    open.value = false;
  }
}

/**
 * Closes the menu on Escape.
 * @internal
 * @function
 * @param event - Keyboard event produced while the menu is open
 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

onMounted((): void => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('pointerdown', onPointerDown);
});

onBeforeUnmount((): void => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('pointerdown', onPointerDown);
});
</script>

<template>
  <div
    v-if="user"
    ref="container"
    class="relative"
  >
    <button
      ref="trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="`Account menu for ${user.displayName}`"
      class="text-ink-muted hover:text-ink flex max-w-[12rem] cursor-pointer items-center gap-2 rounded-md py-1 transition-colors"
      type="button"
      @click="open = !open"
    >
      <WidgetsAccountAvatar
        :avatar-url="user.avatarUrl"
        :display-name="user.displayName"
        size="sm"
      />

      <span class="text-body-sm hidden truncate md:inline">{{ user.displayName }}</span>
    </button>

    <div
      v-if="open"
      class="border-border bg-surface-raised absolute right-0 z-20 mt-2 w-48 rounded-md border py-1 shadow-lg"
      role="menu"
    >
      <NuxtLink
        v-if="!props.signOutOnly"
        class="text-ink hover:bg-surface text-body-sm block px-4 py-2 transition-colors"
        role="menuitem"
        :to="PROFILE_ROUTE"
        @click="open = false"
      >
        Profile
      </NuxtLink>

      <button
        class="text-ink hover:bg-surface text-body-sm block w-full cursor-pointer px-4 py-2 text-left transition-colors"
        role="menuitem"
        type="button"
        @click="signOut()"
      >
        Sign out
      </button>
    </div>
  </div>
</template>
