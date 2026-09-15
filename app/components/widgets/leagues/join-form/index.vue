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
 * ██████████████████████████████████ #components/widgets/leagues/join-form/index.vue ██████████████████████████████████
 *
 * The join form: one field that reads a pasted invite and goes to its invite page.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesJoinForm />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { Ref } from 'vue';

import { INVITE_PATH_PREFIX, parseInviteInput } from '~/utils/leagues/entry';

import { INVITE_INPUT_REFUSED_MESSAGE } from './constants';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the player pasted.
 * @internal
 * @constant
 */
const value: Ref<string> = ref('');

/**
 * The refusal message, or null while the paste is acceptable or untried.
 * @internal
 * @constant
 */
const message: Ref<string | null> = ref(null);

/**
 * This deployment's origin, which a pasted link must match exactly.
 * @internal
 * @constant
 */
const origin: string = useRequestURL().origin;

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Reads the paste and goes to its invite page. No request is made from here; the invite page does all of that.
 * @internal
 * @function
 */
async function onSubmit(): Promise<void> {
  const token: string | null = parseInviteInput(value.value, origin);

  if (!token) {
    message.value = INVITE_INPUT_REFUSED_MESSAGE;

    return;
  }

  message.value = null;

  await navigateTo(`${INVITE_PATH_PREFIX}${token}`);
}
</script>

<template>
  <form
    class="border-border bg-surface rounded-lg border p-6 md:p-8"
    novalidate
    @submit.prevent="onSubmit"
  >
    <label
      class="text-ink text-body-sm block font-medium"
      for="invite-link"
    >
      Invite link
    </label>

    <input
      id="invite-link"
      v-model="value"
      aria-describedby="invite-link-message"
      :aria-invalid="message !== null"
      autocapitalize="off"
      autocomplete="off"
      class="border-border bg-surface text-ink focus:border-accent mt-2 block w-full rounded-md border px-4 py-3 font-mono transition-colors outline-none"
      name="invite"
      spellcheck="false"
      type="text"
    />

    <p
      id="invite-link-message"
      class="text-body-sm mt-2"
      :class="message ? 'text-negative-soft-ink' : 'text-ink-subtle'"
      :role="message ? 'alert' : undefined"
    >
      {{ message ?? 'You can paste the whole link or just the part after invite/.' }}
    </p>

    <button
      class="bg-accent text-accent-ink hover:bg-accent-hover text-body mt-6 rounded-md px-6 py-3 font-medium transition-colors"
      type="submit"
    >
      Continue
    </button>
  </form>
</template>
