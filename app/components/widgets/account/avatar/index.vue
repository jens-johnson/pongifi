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
 * ███████████████████████████████████ #components/widgets/account/avatar/index.vue ████████████████████████████████████
 *
 * The player's Google picture, or their initials when there is none.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsAccountAvatar :avatar-url="profile.avatarUrl" :display-name="profile.displayName" size="lg" />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • avatarUrl
 *     - Description: the provider image, or null when initials stand in
 *     - Type: string | null
 *     - Required: true
 *   • displayName
 *     - Description: the name behind the initials fallback
 *     - Type: string
 *     - Required: true
 *   • size
 *     - Description: how large to draw it
 *     - Type: TAvatarSize
 *     - Required: false
 *     - Default: 'md'
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { TPropsWithDefaults } from '@jens-johnson/style-guide/types/vue';
import type { ComputedRef } from 'vue';

import { AVATAR_SIZE_CLASSES } from './constants';
import type { IAccountAvatarProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The identity to draw and the size to draw it at.
 * @internal
 * @constant
 */
const props: TPropsWithDefaults<IAccountAvatarProps, 'size'> = withDefaults(defineProps<IAccountAvatarProps>(), {
  size: 'md',
});

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The dimension and text classes for the requested size.
 * @internal
 * @constant
 */
const sizeClasses: ComputedRef<string> = computed((): string => AVATAR_SIZE_CLASSES[props.size]);

/**
 * The letters shown when there is no picture to show.
 * @internal
 * @constant
 */
const initials: ComputedRef<string> = computed((): string => toInitials(props.displayName));
</script>

<template>
  <!-- Decorative in both branches: the display name it stands for is always rendered beside it -->
  <img
    v-if="props.avatarUrl"
    alt=""
    class="shrink-0 rounded-full object-cover"
    :class="sizeClasses"
    referrerpolicy="no-referrer"
    :src="props.avatarUrl"
  />

  <span
    v-else
    aria-hidden="true"
    class="bg-brand-soft text-brand-soft-ink flex shrink-0 items-center justify-center rounded-full font-medium"
    :class="sizeClasses"
  >
    {{ initials }}
  </span>
</template>
