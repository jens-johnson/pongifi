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
 * █████████████████████████████████ #components/widgets/leagues/rules-panel/index.vue █████████████████████████████████
 *
 * How a league plays, in four read-only lines.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesRulesPanel :settings="league.settings" />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • settings
 *     - Description: the league's stored settings
 *     - Type: TLeagueSettings
 *     - Required: true
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import { describeLeagueSettings } from '~/utils/leagues/display';

import type { ILeaguesRulesPanelProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The settings to describe.
 * @internal
 * @constant
 */
const props: Readonly<ILeaguesRulesPanelProps> = defineProps<ILeaguesRulesPanelProps>();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The four lines, naming values rather than settings keys.
 * @internal
 * @constant
 */
const lines: ComputedRef<string[]> = computed((): string[] => describeLeagueSettings(props.settings));
</script>

<template>
  <section class="border-border bg-surface rounded-lg border p-6 md:p-8">
    <h2 class="font-display text-h3 font-medium tracking-tight">How this league plays</h2>

    <!-- Read-only: the settings editor is not in this slice, so nothing here offers to change them -->
    <ul class="text-ink-muted text-body mt-4 space-y-2">
      <li
        v-for="line in lines"
        :key="line"
      >
        {{ line }}
      </li>
    </ul>
  </section>
</template>
