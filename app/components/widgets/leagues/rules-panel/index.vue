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
 * How a league plays: one summary line, and four groups of labelled rows behind a disclosure.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesRulesPanel :settings="league.settings" :settings-route="settingsRoute"
 * :viewer-role="league.viewerRole" />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • settings
 *     - Description: the league's stored settings
 *     - Type: TLeagueSettings
 *     - Required: true
 *   • settingsRoute
 *     - Description: where the commissioner's Edit settings link goes
 *     - Type: string
 *     - Required: true
 *   • viewerRole
 *     - Description: the signed-in viewer's own role
 *     - Type: LeagueRole
 *     - Required: true
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import { LeagueRole } from '#shared/domain';

import { RULES_DISCLOSURE_REGION_ID } from './constants';
import type { ILeagueRuleGroup, ILeaguesRulesPanelProps } from './types';
import { summarizeLeagueSettings, toLeagueRuleGroups } from './utils';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The settings to describe, where a commissioner changes them, and who is reading.
 * @internal
 * @constant
 */
const props: Readonly<ILeaguesRulesPanelProps> = defineProps<ILeaguesRulesPanelProps>();

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the card is open. Local to the page and deliberately not persisted: it is a glance, not a preference.
 * @internal
 * @constant
 */
const expanded: Ref<boolean> = ref(false);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The one line the card always shows, collapsed or open.
 * @internal
 * @constant
 */
const summary: ComputedRef<string> = computed((): string => summarizeLeagueSettings(props.settings));

/**
 * The four groups the open card lays out.
 * @internal
 * @constant
 */
const groups: ComputedRef<ILeagueRuleGroup[]> = computed((): ILeagueRuleGroup[] => toLeagueRuleGroups(props.settings));

/**
 * Whether the viewer may change these settings (IV.IV). A manager reaches Identity through the header's Edit league
 * and has nothing to change here, so only a commissioner is offered the action.
 * @internal
 * @constant
 */
const commissions: ComputedRef<boolean> = computed((): boolean => props.viewerRole === LeagueRole.COMMISSIONER);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Opens or closes the card.
 * @internal
 * @function
 */
function onToggle(): void {
  expanded.value = !expanded.value;
}
</script>

<template>
  <section class="border-border bg-surface rounded-lg border p-6 md:p-8">
    <!-- The heading row is the disclosure control; the commissioner's action sits beside it and never toggles it -->
    <div class="flex items-start justify-between gap-4">
      <h2 class="font-display text-h3 min-w-0 flex-1 font-medium tracking-tight">
        <button
          :aria-controls="RULES_DISCLOSURE_REGION_ID"
          :aria-expanded="expanded"
          class="text-ink hover:text-accent flex w-full items-center gap-2 text-left transition-colors"
          type="button"
          @click="onToggle"
        >
          How this league plays

          <Icon
            aria-hidden="true"
            class="size-4 shrink-0"
            :name="expanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          />
        </button>
      </h2>

      <NuxtLink
        v-if="commissions"
        class="text-ink-muted hover:text-ink text-body-sm shrink-0 font-medium transition-colors"
        :to="settingsRoute"
      >
        Edit settings
      </NuxtLink>
    </div>

    <!-- Always visible, collapsed or open; it wraps rather than being cut to one line -->
    <p class="text-ink-muted text-body mt-4 break-words">{{ summary }}</p>

    <!-- Kept in the document while closed so the control's `aria-controls` always names something -->
    <div
      v-show="expanded"
      :id="RULES_DISCLOSURE_REGION_ID"
      class="mt-6 space-y-6"
    >
      <div
        v-for="group in groups"
        :key="group.heading"
      >
        <h3 class="text-ink text-body-sm font-medium">{{ group.heading }}</h3>

        <div
          v-for="block in group.blocks"
          :key="block.id"
          class="mt-3"
        >
          <!-- Cutthroat never consults these rules, so a mixed league names whose they are -->
          <p
            v-if="block.label"
            class="text-ink text-caption font-medium"
          >
            {{ block.label }}
          </p>

          <dl class="mt-2 space-y-2">
            <div
              v-for="row in block.rows"
              :key="row.label"
              class="flex flex-wrap justify-between gap-x-4 gap-y-1"
            >
              <dt class="text-ink-subtle text-caption">{{ row.label }}</dt>

              <dd class="text-ink text-body-sm grow text-right">{{ row.value }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>
