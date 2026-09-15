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
 * ██████████████████████████████ #components/widgets/leagues/settings-section/index.vue ███████████████████████████████
 *
 * One section of the league settings page: its controls or its values, its alerts and its own Save.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesSettingsSection :section="section" :state="state" ... />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import type { ISettingsRow } from '~/utils/leagues/settings';
import {
  SETTINGS_ALERT_MESSAGES,
  SETTINGS_CHECKING_LABEL,
  SETTINGS_SAVED_MESSAGE,
  SettingsSectionPhase,
} from '~/utils/leagues/settings';

import type { ILeaguesSettingsSectionEmits, ILeaguesSettingsSectionProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The section to draw and the state it is in.
 * @internal
 * @constant
 */
const props: ILeaguesSettingsSectionProps = defineProps<ILeaguesSettingsSectionProps>();

/* ─── Emits ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the section's footer asks the page to do; the page owns every write and every revision.
 * @internal
 * @constant
 */
const emit: ((event: 'cancel') => void) &
  ((event: 'retry') => void) &
  ((event: 'retryCheck') => void) &
  ((event: 'reviewDraft') => void) &
  ((event: 'save') => void) &
  ((event: 'useCurrent') => void) = defineEmits<ILeaguesSettingsSectionEmits>();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the controls are locked: while a save is in flight or queued behind one, while the re-read that follows a
 * lost answer is in flight, and while its outcome is unknown, so a retry sends exactly what the first attempt did.
 * @internal
 * @constant
 */
const locked: ComputedRef<boolean> = computed(
  (): boolean =>
    props.state.phase === SettingsSectionPhase.SAVING ||
    props.state.phase === SettingsSectionPhase.RECONCILING ||
    props.state.phase === SettingsSectionPhase.UNCERTAIN ||
    props.state.phase === SettingsSectionPhase.RECONCILE_FAILED,
);

/**
 * Whether Save is offered at all. A section whose outcome is unknown reconciles by reading, and one whose read failed
 * offers nothing but another read, so neither shows a Save that could commit a second write.
 * @internal
 * @constant
 */
const savable: ComputedRef<boolean> = computed(
  (): boolean =>
    props.editable &&
    props.state.phase !== SettingsSectionPhase.RECONCILING &&
    props.state.phase !== SettingsSectionPhase.UNCERTAIN &&
    props.state.phase !== SettingsSectionPhase.RECONCILE_FAILED &&
    props.state.phase !== SettingsSectionPhase.STALE,
);

/**
 * The rows of the draft as it stands, lined up against the current values while the section is stale.
 * @internal
 * @constant
 */
const comparison: ComputedRef<ISettingsRow[]> = computed((): ISettingsRow[] =>
  props.state.phase === SettingsSectionPhase.STALE ? props.rows : [],
);
</script>

<template>
  <section class="border-border bg-surface rounded-lg border p-6 md:p-8">
    <h2 class="font-display text-h3 font-medium tracking-tight">{{ heading }}</h2>

    <!-- The one line a viewer with no controls here is given, naming the role that has them -->
    <p
      v-if="!editable"
      class="text-ink-subtle text-caption mt-2"
    >
      {{ readOnlyCaption }}
    </p>

    <p
      v-if="state.confirmed"
      class="text-positive-soft-ink text-caption mt-2"
      role="status"
    >
      {{ SETTINGS_SAVED_MESSAGE }}
    </p>

    <p
      v-if="state.alert"
      class="bg-negative-soft text-negative-soft-ink text-body-sm mt-4 rounded-lg p-4"
      role="alert"
    >
      {{ state.message ?? SETTINGS_ALERT_MESSAGES[state.alert] }}
    </p>

    <!-- Stale: the values as they now stand, beside the draft, and nothing writes until the person chooses -->
    <div
      v-if="state.phase === SettingsSectionPhase.STALE"
      class="border-border mt-4 grid gap-6 rounded-md border p-4 sm:grid-cols-2"
    >
      <div>
        <h3 class="text-ink text-body-sm font-medium">Current values</h3>

        <dl class="mt-3 space-y-2">
          <div
            v-for="row in currentRows"
            :key="`current-${row.field}`"
          >
            <dt class="text-ink-subtle text-caption">{{ row.label }}</dt>

            <dd class="text-ink text-body-sm">{{ row.value }}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h3 class="text-ink text-body-sm font-medium">Your changes</h3>

        <dl class="mt-3 space-y-2">
          <div
            v-for="row in comparison"
            :key="`draft-${row.field}`"
          >
            <dt class="text-ink-subtle text-caption">{{ row.label }}</dt>

            <dd class="text-ink text-body-sm">{{ row.value }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Controls for a role that has them; the same values as rows for one that does not -->
    <fieldset
      v-if="editable"
      class="mt-6"
      :disabled="locked"
    >
      <slot />
    </fieldset>

    <dl
      v-else
      class="mt-6 space-y-4"
    >
      <div
        v-for="row in rows"
        :key="row.field"
      >
        <dt class="text-ink-subtle text-caption">{{ row.label }}</dt>

        <dd class="text-ink text-body">{{ row.value }}</dd>

        <!-- The same message the control would carry, so a revealed fault reads as one without granting editing -->
        <p
          v-if="row.message"
          class="text-negative-soft-ink text-body-sm mt-1"
        >
          {{ row.message }}
        </p>
      </div>
    </dl>

    <div
      v-if="editable"
      class="mt-6 flex flex-wrap items-center gap-3"
    >
      <template v-if="state.phase === SettingsSectionPhase.STALE">
        <button
          class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-5 py-2.5 font-medium transition-colors"
          type="button"
          @click="emit('useCurrent')"
        >
          Use current values
        </button>

        <button
          class="border-border text-ink hover:border-accent text-body-sm rounded-md border px-5 py-2.5 font-medium transition-colors"
          type="button"
          @click="emit('reviewDraft')"
        >
          Review draft
        </button>
      </template>

      <!-- The only action a failed reconciliation offers: another read, never a second write -->
      <button
        v-else-if="state.phase === SettingsSectionPhase.RECONCILE_FAILED"
        class="border-border text-ink hover:border-accent text-body-sm rounded-md border px-5 py-2.5 font-medium transition-colors"
        type="button"
        @click="emit('retryCheck')"
      >
        Retry check
      </button>

      <!-- Nothing may be sent until the re-read says whether the write committed, so Retry is shown but never armed -->
      <button
        v-else-if="state.phase === SettingsSectionPhase.RECONCILING"
        class="bg-accent text-accent-ink text-body-sm rounded-md px-5 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50"
        disabled
        type="button"
      >
        {{ SETTINGS_CHECKING_LABEL }}
      </button>

      <!-- The same request, at the same revision, so a delayed first write and its retry cannot both commit -->
      <button
        v-else-if="state.phase === SettingsSectionPhase.UNCERTAIN"
        class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-5 py-2.5 font-medium transition-colors"
        type="button"
        @click="emit('retry')"
      >
        Retry
      </button>

      <template v-else>
        <button
          class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-5 py-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!savable || !dirty || state.phase === SettingsSectionPhase.SAVING"
          type="button"
          @click="emit('save')"
        >
          {{ state.phase === SettingsSectionPhase.SAVING ? 'Saving…' : 'Save' }}
        </button>

        <button
          class="text-ink-muted hover:text-ink text-body-sm rounded-md px-4 py-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!dirty || state.phase === SettingsSectionPhase.SAVING"
          type="button"
          @click="emit('cancel')"
        >
          Cancel
        </button>
      </template>
    </div>
  </section>
</template>
