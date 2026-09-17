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
 * ███████████████████████████████ #components/widgets/leagues/settings-field/index.vue ████████████████████████████████
 *
 * One labelled settings control, with its caption or its message beneath it.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesSettingsField field="winningMargin" label="Win by" v-slot="{ id }">…</WidgetsLeaguesSettingsField>
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import type { ILeaguesSettingsFieldProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The control to label, and what to say beneath it.
 * @internal
 * @constant
 */
const props: ILeaguesSettingsFieldProps = withDefaults(defineProps<ILeaguesSettingsFieldProps>(), {
  caption: null,
  message: null,
});

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The control's element id, taken from the field key so a target score keeps its format.
 * @internal
 * @constant
 */
const controlId: ComputedRef<string> = computed((): string => `setting-${props.field.replace('.', '-')}`);

/**
 * What the control is described by: its message when it has one, otherwise its caption.
 * @internal
 * @constant
 */
const describedBy: ComputedRef<string | undefined> = computed((): string | undefined => {
  if (props.message) {
    return `${controlId.value}-message`;
  }

  return props.caption ? `${controlId.value}-caption` : undefined;
});
</script>

<template>
  <div>
    <label
      class="text-ink text-body-sm block font-medium"
      :for="controlId"
    >
      {{ label }}
    </label>

    <slot
      :id="controlId"
      :described-by="describedBy"
      :invalid="message !== null"
    />

    <p
      v-if="message"
      :id="`${controlId}-message`"
      class="text-negative-soft-ink text-body-sm mt-2"
    >
      {{ message }}
    </p>

    <p
      v-else-if="caption"
      :id="`${controlId}-caption`"
      class="text-ink-subtle text-caption mt-2"
    >
      {{ caption }}
    </p>
  </div>
</template>
