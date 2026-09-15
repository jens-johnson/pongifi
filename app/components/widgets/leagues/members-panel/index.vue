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
 * ████████████████████████████████ #components/widgets/leagues/members-panel/index.vue ████████████████████████████████
 *
 * A league's active members, with role and join date, and no email addresses.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesMembersPanel :members="league.members" />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • members
 *     - Description: the active members, already in display order
 *     - Type: ILeagueMember[]
 *     - Required: true
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import { toMonthYear, toRoleLabel } from '~/utils/account/format';

import type { ILeaguesMembersPanelProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The roster to draw.
 * @internal
 * @constant
 */
const props: Readonly<ILeaguesMembersPanelProps> = defineProps<ILeaguesMembersPanelProps>();
</script>

<template>
  <section class="border-border bg-surface rounded-lg border p-6 md:p-8">
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="font-display text-h3 font-medium tracking-tight">Members</h2>

      <span
        v-if="props.members.length > 1"
        class="text-ink-subtle text-caption"
      >
        {{ props.members.length }} members
      </span>
    </div>

    <!-- Active members only; the count in the header and the page caption both match these rows -->
    <ul class="mt-6 space-y-3">
      <li
        v-for="member in props.members"
        :key="member.id"
        class="flex items-center gap-4"
      >
        <WidgetsAccountAvatar
          :avatar-url="member.avatarUrl"
          :display-name="member.displayName"
        />

        <span class="min-w-0">
          <span class="text-ink text-body block truncate font-medium">{{ member.displayName }}</span>

          <span class="text-ink-subtle text-caption block">
            {{ toRoleLabel(member.role) }} · Joined {{ toMonthYear(member.joinedAt) }}
          </span>
        </span>
      </li>
    </ul>
  </section>
</template>
