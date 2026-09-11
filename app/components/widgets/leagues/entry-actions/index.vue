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
 * ████████████████████████████████ #components/widgets/leagues/entry-actions/index.vue ████████████████████████████████
 *
 * The Create a league and Join with an invite actions.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesEntryActions stacked />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • stacked
 *     - Description: stack the two actions full width instead of setting them in a row
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { TPropsWithDefaults } from '@jens-johnson/style-guide/types/vue';

import { LEAGUES_JOIN_ROUTE, LEAGUES_NEW_ROUTE } from '~/utils/marketing/routes';

import type { ILeaguesEntryActionsProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * How the pair is laid out.
 * @internal
 * @constant
 */
const props: TPropsWithDefaults<ILeaguesEntryActionsProps, 'stacked'> = withDefaults(
  defineProps<ILeaguesEntryActionsProps>(),
  { stacked: false },
);
</script>

<template>
  <div
    class="flex gap-3"
    :class="props.stacked ? 'flex-col' : 'flex-wrap items-center'"
  >
    <NuxtLink
      class="bg-accent text-accent-ink hover:bg-accent-hover text-body rounded-md px-6 py-3 text-center font-medium transition-colors"
      :to="LEAGUES_NEW_ROUTE"
    >
      Create a league
    </NuxtLink>

    <NuxtLink
      class="border-border text-ink hover:border-accent text-body rounded-md border px-6 py-3 text-center font-medium transition-colors"
      :to="LEAGUES_JOIN_ROUTE"
    >
      Join with an invite
    </NuxtLink>
  </div>
</template>
