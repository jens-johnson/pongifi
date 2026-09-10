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
 * ██████████████████████████████████ #components/widgets/account/name-form/index.vue ██████████████████████████████████
 *
 * The display-name form shared by the profile page and the welcome step.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsAccountNameForm :initial-name="profile.displayName" :submit="save" submit-label="Save" pending-label="Saving"
 * :helper="HELPER" :failure-message="FAILURE" show-cancel confirm />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • autoFocus
 *     - Description: focus and select the field on load
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *   • confirm
 *     - Description: show a transient confirmation after a successful save
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *   • failureMessage
 *     - Description: the message shown when the save itself fails
 *     - Type: string
 *     - Required: true
 *   • helper
 *     - Description: helper text under the field
 *     - Type: string
 *     - Required: true
 *   • initialName
 *     - Description: the saved name the field starts from
 *     - Type: string
 *     - Required: true
 *   • pendingLabel
 *     - Description: the label while a save is in flight
 *     - Type: string
 *     - Required: true
 *   • requireChange
 *     - Description: require a change before the action is available
 *     - Type: boolean
 *     - Required: false
 *     - Default: true
 *   • showCancel
 *     - Description: offer a control restoring the saved value
 *     - Type: boolean
 *     - Required: false
 *     - Default: false
 *   • submit
 *     - Description: performs the save; rejecting shows the failure message
 *     - Type: (displayName: string) => Promise<void>
 *     - Required: true
 *   • submitLabel
 *     - Description: the label on the primary action
 *     - Type: string
 *     - Required: true
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { TPropsWithDefaults } from '@jens-johnson/style-guide/types/vue';
import type { ComputedRef, Ref } from 'vue';

import {
  DISPLAY_NAME_COUNTER_THRESHOLD,
  DISPLAY_NAME_MAX_LENGTH,
  type TDisplayNameValidationResult,
  validateDisplayName,
} from '#shared/profile';

import { CONFIRMATION_VISIBLE_MS } from './constants';
import type { IAccountNameFormProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The copy, the starting value and the save this form performs.
 * @internal
 * @constant
 */
const props: TPropsWithDefaults<IAccountNameFormProps, 'autoFocus' | 'confirm' | 'requireChange' | 'showCancel'> =
  withDefaults(defineProps<IAccountNameFormProps>(), {
    autoFocus: false,
    confirm: false,
    requireChange: true,
    showCancel: false,
  });

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The field's current contents.
 * @internal
 * @constant
 */
const value: Ref<string> = ref(props.initialName);

/**
 * The saved name, which is what Cancel restores and what "changed" is measured against.
 * @internal
 * @constant
 */
const baseline: Ref<string> = ref(props.initialName);

/**
 * The validation or failure message currently shown, or null when there is none.
 * @internal
 * @constant
 */
const message: Ref<string | null> = ref(null);

/**
 * Whether the shown message came from the save failing rather than from the value being invalid.
 * @internal
 * @constant
 */
const failed: Ref<boolean> = ref(false);

/**
 * Whether a save is in flight.
 * @internal
 * @constant
 */
const pending: Ref<boolean> = ref(false);

/**
 * Whether the quiet confirmation is showing.
 * @internal
 * @constant
 */
const confirmed: Ref<boolean> = ref(false);

/**
 * The field itself, focused on load when the caller asks for it.
 * @internal
 * @constant
 */
const field: Ref<HTMLInputElement | null> = ref(null);

/**
 * The timer clearing the confirmation, tracked so a second save cannot leave an orphaned one behind.
 * @internal
 */
let confirmationTimer: ReturnType<typeof setTimeout> | undefined;

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the trimmed value differs from the saved one.
 * @internal
 * @constant
 */
const changed: ComputedRef<boolean> = computed((): boolean => value.value.trim() !== baseline.value.trim());

/**
 * Whether the primary action is available.
 *
 * The welcome step sets requireChange false, because accepting the prefilled name unchanged is the common path
 * @internal
 * @constant
 */
const canSubmit: ComputedRef<boolean> = computed(
  (): boolean => !pending.value && value.value.trim().length > 0 && (!props.requireChange || changed.value),
);

/**
 * Whether the character counter is close enough to the limit to be worth showing.
 * @internal
 * @constant
 */
const showCounter: ComputedRef<boolean> = computed((): boolean => value.value.length > DISPLAY_NAME_COUNTER_THRESHOLD);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Applies the shared rule and shows its message.
 *
 * Run on submit and on blur rather than on every keystroke, so a name is not marked invalid while it is being typed.
 * @internal
 * @function
 * @returns The validated name, or null when the value was refused
 */
function validate(): string | null {
  const result: TDisplayNameValidationResult = validateDisplayName(value.value);

  if (!result.ok) {
    failed.value = false;
    message.value = result.message;

    return null;
  }

  message.value = null;

  return result.value;
}

/**
 * Validates on blur, but only once there is something to complain about.
 *
 * Leaving an untouched field should not scold the player.
 * @internal
 * @function
 */
function onBlur(): void {
  if (changed.value || value.value.trim().length === 0) {
    validate();
  }
}

/**
 * Restores the saved name and clears whatever the field was complaining about.
 * @internal
 * @function
 */
function cancel(): void {
  value.value = baseline.value;
  message.value = null;
  failed.value = false;
}

/**
 * Validates, saves, and reports the outcome without losing what the player typed.
 * @internal
 * @function
 */
async function save(): Promise<void> {
  const name: string | null = validate();

  if (name === null || pending.value) {
    return;
  }

  pending.value = true;
  confirmed.value = false;

  try {
    await props.submit(name);

    // The saved value becomes the new baseline, so the form settles rather than staying dirty
    baseline.value = name;
    value.value = name;
    message.value = null;
    failed.value = false;

    if (props.confirm) {
      confirmed.value = true;
      clearTimeout(confirmationTimer);
      confirmationTimer = setTimeout((): void => {
        confirmed.value = false;
      }, CONFIRMATION_VISIBLE_MS);
    }
  } catch {
    // The typed value stays: retyping a name because the network failed is the wrong thing to ask of anyone
    failed.value = true;
    message.value = props.failureMessage;
  } finally {
    pending.value = false;
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

onMounted((): void => {
  if (props.autoFocus) {
    field.value?.focus();
    field.value?.select();
  }
});

onBeforeUnmount((): void => {
  clearTimeout(confirmationTimer);
});
</script>

<template>
  <form
    novalidate
    @submit.prevent="save"
  >
    <label
      class="text-ink text-body-sm block font-medium"
      for="display-name"
    >
      Display name
    </label>

    <input
      id="display-name"
      ref="field"
      v-model="value"
      :aria-describedby="message ? 'display-name-message' : 'display-name-helper'"
      :aria-invalid="message !== null && !failed"
      autocomplete="nickname"
      class="border-border bg-surface text-ink focus:border-accent mt-2 block w-full rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
      :disabled="pending"
      :maxlength="DISPLAY_NAME_MAX_LENGTH"
      name="displayName"
      type="text"
      @blur="onBlur"
    />

    <div class="mt-2 flex items-start justify-between gap-4">
      <p
        v-if="message"
        id="display-name-message"
        class="text-negative-soft-ink text-body-sm"
        role="alert"
      >
        {{ message }}
      </p>

      <p
        v-else
        id="display-name-helper"
        class="text-ink-subtle text-body-sm"
      >
        {{ props.helper }}
      </p>

      <!-- Only near the limit: a counter that is always on is noise for every name that will never approach it -->
      <span
        v-if="showCounter"
        class="text-ink-subtle text-caption shrink-0 tabular-nums"
      >
        {{ value.length }}/{{ DISPLAY_NAME_MAX_LENGTH }}
      </span>
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <button
        class="bg-accent text-accent-ink hover:bg-accent-hover text-body rounded-md px-6 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canSubmit"
        type="submit"
      >
        {{ pending ? props.pendingLabel : props.submitLabel }}
      </button>

      <button
        v-if="props.showCancel && changed && !pending"
        class="text-ink-muted hover:text-ink text-body rounded-md px-4 py-3 font-medium transition-colors"
        type="button"
        @click="cancel"
      >
        Cancel
      </button>

      <span
        v-if="confirmed"
        aria-live="polite"
        class="text-positive-soft-ink text-body-sm"
      >
        Saved
      </span>
    </div>
  </form>
</template>
