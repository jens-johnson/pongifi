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
 * █████████████████████████████████ #components/widgets/leagues/create-form/index.vue █████████████████████████████████
 *
 * The create-league form: name, short mark, description and formats, with retry-safe submission.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesCreateForm />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import type { ICreateLeagueRequest, ICreateLeagueResponse, TFieldValidationResult } from '#shared/leagues';
import {
  LEAGUE_GAME_TYPE_ORDER,
  LEAGUE_GAME_TYPES_EMPTY_MESSAGE,
  validateLeagueAbbreviation,
  validateLeagueDescription,
  validateLeagueGameTypes,
  validateLeagueName,
} from '#shared/leagues';
import type { GameType } from '#shared/rules-engine';
import { GAME_TYPE_LABELS } from '~/utils/leagues/display';
import { deriveAbbreviation } from '~/utils/leagues/entry';
import { classifyWriteFailure, WriteFailure } from '~/utils/leagues/write-failure';
import { HOME_ROUTE, LEAGUES_ROUTE } from '~/utils/marketing/routes';

import { CANCEL_DESTINATIONS, CREATE_LEAGUE_ALERT_MESSAGES } from './constants';
import { CreateLeagueAlert, CreateLeaguePhase } from './enums';
import type { ICreateLeagueFormErrors } from './types';

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The league name as typed.
 * @internal
 * @constant
 */
const name: Ref<string> = ref('');

/**
 * The short mark as typed, or as derived from the name until the player edits it.
 * @internal
 * @constant
 */
const abbreviation: Ref<string> = ref('');

/**
 * Whether the player has typed in the short mark, after which it stops following the name.
 * @internal
 * @constant
 */
const abbreviationEdited: Ref<boolean> = ref(false);

/**
 * The description as typed.
 * @internal
 * @constant
 */
const description: Ref<string> = ref('');

/**
 * The formats selected; all three to start with (IV.II).
 * @internal
 * @constant
 */
const gameTypes: Ref<GameType[]> = ref([...LEAGUE_GAME_TYPE_ORDER]);

/**
 * One message per field, shown on blur and on submit.
 * @internal
 * @constant
 */
const errors: Ref<ICreateLeagueFormErrors> = ref({
  abbreviation: null,
  allowedGameTypes: null,
  description: null,
  name: null,
});

/**
 * The identifier this mounted form sends on every submit and retry; generated on mount so it never differs between
 * the server render and the browser.
 * @internal
 * @constant
 */
const submissionId: Ref<string | null> = ref(null);

/**
 * Where the submission stands.
 * @internal
 * @constant
 */
const phase: Ref<CreateLeaguePhase> = ref(CreateLeaguePhase.IDLE);

/**
 * The alert a failed submission shows, or null.
 * @internal
 * @constant
 */
const alert: Ref<CreateLeagueAlert | null> = ref(null);

/**
 * The exits a 401 or a welcome-owing 403 takes.
 * @internal
 * @constant
 */
const exit: ReturnType<typeof useSessionExit> = useSessionExit();

/**
 * The router, read for the page the player came from.
 * @internal
 * @constant
 */
const router: ReturnType<typeof useRouter> = useRouter();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the fields are read-only: while a submission is in flight, and while its outcome is unknown, so the retry
 * sends exactly what the first attempt did.
 * @internal
 * @constant
 */
const locked: ComputedRef<boolean> = computed((): boolean => phase.value !== CreateLeaguePhase.IDLE);

/**
 * Where Cancel returns to: the dashboard or the leagues page when the player came from one, otherwise home.
 * @internal
 * @constant
 */
const cancelTarget: ComputedRef<string> = computed((): string => {
  const back: unknown = router.options.history.state.back;

  return typeof back === 'string' && CANCEL_DESTINATIONS.includes(back) ? back : HOME_ROUTE;
});

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Records one field's message from its validation result.
 * @internal
 * @function
 * @param field - The field
 * @param result - The field's validation result
 * @returns The validated value, or null when the field was refused
 */
function record<TValue>(field: keyof ICreateLeagueFormErrors, result: TFieldValidationResult<TValue>): TValue | null {
  errors.value[field] = result.ok ? null : result.message;

  return result.ok ? result.value : null;
}

/**
 * Validates the name on blur.
 * @internal
 * @function
 */
function onNameBlur(): void {
  record('name', validateLeagueName(name.value));
}

/**
 * Validates the short mark on blur.
 * @internal
 * @function
 */
function onAbbreviationBlur(): void {
  record('abbreviation', validateLeagueAbbreviation(abbreviation.value));
}

/**
 * Validates the description on blur.
 * @internal
 * @function
 */
function onDescriptionBlur(): void {
  record('description', validateLeagueDescription(description.value));
}

/**
 * Stops the short mark following the name once the player types in it.
 * @internal
 * @function
 */
function onAbbreviationInput(): void {
  abbreviationEdited.value = true;
}

/**
 * Selects or clears one format, refusing to clear the last one.
 * @internal
 * @function
 * @param gameType - The format toggled
 * @param event - The checkbox change
 */
function onToggleGameType(gameType: GameType, event: Event): void {
  const checked: boolean = (event.target as HTMLInputElement).checked;
  const next: GameType[] = checked
    ? [...gameTypes.value, gameType]
    : gameTypes.value.filter((selected: GameType): boolean => selected !== gameType);

  if (next.length === 0) {
    // The checkbox is put back rather than the league left with nothing to play
    (event.target as HTMLInputElement).checked = true;
    errors.value.allowedGameTypes = LEAGUE_GAME_TYPES_EMPTY_MESSAGE;

    return;
  }

  errors.value.allowedGameTypes = null;
  gameTypes.value = LEAGUE_GAME_TYPE_ORDER.filter((candidate: GameType): boolean => next.includes(candidate));
}

/**
 * Validates every field and builds the request, or shows every message and returns null.
 * @internal
 * @function
 * @returns The request, or null when any field was refused
 */
function buildRequest(): ICreateLeagueRequest | null {
  const validName: string | null = record('name', validateLeagueName(name.value));
  const validAbbreviation: string | null = record('abbreviation', validateLeagueAbbreviation(abbreviation.value));
  const validGameTypes: GameType[] | null = record('allowedGameTypes', validateLeagueGameTypes(gameTypes.value));
  const descriptionResult: TFieldValidationResult<string | null> = validateLeagueDescription(description.value);

  record('description', descriptionResult);

  if (!validName || !validAbbreviation || !validGameTypes || !descriptionResult.ok || !submissionId.value) {
    return null;
  }

  return {
    abbreviation: validAbbreviation,
    allowedGameTypes: validGameTypes,
    description: descriptionResult.value,
    name: validName,
    submissionId: submissionId.value,
  };
}

/**
 * Submits the league, or the identical retry of it, and reads any failure as a refusal or an uncertain outcome.
 * @internal
 * @function
 */
async function onSubmit(): Promise<void> {
  if (phase.value === CreateLeaguePhase.SUBMITTING) {
    return;
  }

  const request: ICreateLeagueRequest | null = buildRequest();

  if (!request) {
    return;
  }

  phase.value = CreateLeaguePhase.SUBMITTING;
  alert.value = null;

  try {
    const { leagueId }: ICreateLeagueResponse = await $fetch<ICreateLeagueResponse>('/api/leagues', {
      body: request,
      method: 'POST',
    });

    await navigateTo(`${LEAGUES_ROUTE}/${leagueId}`);

    return;
  } catch (error: unknown) {
    const failure: WriteFailure = classifyWriteFailure(error);

    // The request may have committed: freeze everything so Try again is the identical request, which the server dedupes
    if (failure === WriteFailure.UNCERTAIN) {
      phase.value = CreateLeaguePhase.UNCERTAIN;
      alert.value = CreateLeagueAlert.UNCERTAIN;

      return;
    }

    if (failure === WriteFailure.UNAUTHORIZED) {
      await exit.toSignIn();

      return;
    }

    if (failure === WriteFailure.FORBIDDEN && (await exit.toWelcomeIfOwed())) {
      return;
    }

    // Every other answer is definite: nothing was written, and every value stays for the player to correct or resend
    phase.value = CreateLeaguePhase.IDLE;
    alert.value =
      failure === WriteFailure.RATE_LIMITED
        ? CreateLeagueAlert.RATE_LIMITED
        : failure === WriteFailure.CONFLICT
          ? CreateLeagueAlert.CONFLICT
          : CreateLeagueAlert.REFUSED;
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// The short mark follows the name's initials until the player types in it
watch(name, (current: string): void => {
  if (!abbreviationEdited.value) {
    abbreviation.value = deriveAbbreviation(current);
  }
});

onMounted((): void => {
  submissionId.value = crypto.randomUUID();
});
</script>

<template>
  <form
    class="border-border bg-surface rounded-lg border p-6 md:p-8"
    novalidate
    @submit.prevent="onSubmit"
  >
    <!-- Name -->
    <label
      class="text-ink text-body-sm block font-medium"
      for="league-name"
    >
      Name
    </label>

    <input
      id="league-name"
      v-model="name"
      :aria-describedby="errors.name ? 'league-name-message' : undefined"
      :aria-invalid="errors.name !== null"
      autocomplete="off"
      class="border-border bg-surface text-ink focus:border-accent mt-2 block w-full rounded-md border px-4 py-3 transition-colors outline-none read-only:opacity-60"
      name="name"
      :readonly="locked"
      type="text"
      @blur="onNameBlur"
    />

    <p
      v-if="errors.name"
      id="league-name-message"
      class="text-negative-soft-ink text-body-sm mt-2"
    >
      {{ errors.name }}
    </p>

    <!-- Short mark -->
    <label
      class="text-ink text-body-sm mt-6 block font-medium"
      for="league-abbreviation"
    >
      Short mark
    </label>

    <input
      id="league-abbreviation"
      v-model="abbreviation"
      aria-describedby="league-abbreviation-message"
      :aria-invalid="errors.abbreviation !== null"
      autocomplete="off"
      class="border-border bg-surface text-ink focus:border-accent mt-2 block w-40 rounded-md border px-4 py-3 uppercase transition-colors outline-none read-only:opacity-60"
      name="abbreviation"
      :readonly="locked"
      type="text"
      @blur="onAbbreviationBlur"
      @input="onAbbreviationInput"
    />

    <p
      id="league-abbreviation-message"
      class="text-body-sm mt-2"
      :class="errors.abbreviation ? 'text-negative-soft-ink' : 'text-ink-subtle'"
    >
      {{ errors.abbreviation ?? 'Shown on your dashboard and in standings.' }}
    </p>

    <!-- Description -->
    <label
      class="text-ink text-body-sm mt-6 block font-medium"
      for="league-description"
    >
      Description <span class="text-ink-subtle font-normal">(optional)</span>
    </label>

    <input
      id="league-description"
      v-model="description"
      :aria-describedby="errors.description ? 'league-description-message' : undefined"
      :aria-invalid="errors.description !== null"
      autocomplete="off"
      class="border-border bg-surface text-ink focus:border-accent mt-2 block w-full rounded-md border px-4 py-3 transition-colors outline-none read-only:opacity-60"
      name="description"
      placeholder="Our office squad"
      :readonly="locked"
      type="text"
      @blur="onDescriptionBlur"
    />

    <p
      v-if="errors.description"
      id="league-description-message"
      class="text-negative-soft-ink text-body-sm mt-2"
    >
      {{ errors.description }}
    </p>

    <!-- Formats -->
    <fieldset
      aria-describedby="league-formats-message"
      class="mt-6"
      :disabled="locked"
    >
      <legend class="text-ink text-body-sm font-medium">Formats played</legend>

      <div class="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        <label
          v-for="gameType in LEAGUE_GAME_TYPE_ORDER"
          :key="gameType"
          class="text-ink text-body flex items-center gap-2"
        >
          <input
            :checked="gameTypes.includes(gameType)"
            class="accent-accent size-4"
            name="allowedGameTypes"
            type="checkbox"
            :value="gameType"
            @change="onToggleGameType(gameType, $event)"
          />
          {{ GAME_TYPE_LABELS[gameType] }}
        </label>
      </div>

      <p
        v-if="errors.allowedGameTypes"
        id="league-formats-message"
        class="text-negative-soft-ink text-body-sm mt-2"
      >
        {{ errors.allowedGameTypes }}
      </p>
    </fieldset>

    <!-- Not a control: the settings editor is not in this slice, so nothing here promises one -->
    <p class="text-ink-muted text-body-sm mt-6">
      Everything else starts on Pongifi's standard rules: games to 11 (cutthroat to 7), win by two, best of one, results
      confirmed by the other players or accepted automatically after 24 hours if nobody disputes, ratings on.
    </p>

    <!-- One alert at a time; the uncertain one links to the leagues page so the player can check before retrying -->
    <p
      v-if="alert === CreateLeagueAlert.UNCERTAIN"
      class="bg-negative-soft text-negative-soft-ink text-body-sm mt-6 rounded-lg p-4"
      role="alert"
    >
      Pongifi could not confirm whether the league was created. Try again, or check
      <NuxtLink
        class="underline underline-offset-4"
        :to="LEAGUES_ROUTE"
        >your leagues</NuxtLink
      >
      first.
    </p>

    <p
      v-else-if="alert"
      class="bg-negative-soft text-negative-soft-ink text-body-sm mt-6 rounded-lg p-4"
      role="alert"
    >
      {{ CREATE_LEAGUE_ALERT_MESSAGES[alert] }}
    </p>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <button
        class="bg-accent text-accent-ink hover:bg-accent-hover text-body rounded-md px-6 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="phase === CreateLeaguePhase.SUBMITTING || !submissionId"
        type="submit"
      >
        {{
          phase === CreateLeaguePhase.SUBMITTING
            ? 'Creating…'
            : phase === CreateLeaguePhase.UNCERTAIN
              ? 'Try again'
              : 'Create league'
        }}
      </button>

      <!-- Cancel discards the identifier with the form; it is the only way to edit values after an uncertain outcome -->
      <NuxtLink
        class="text-ink-muted hover:text-ink text-body rounded-md px-4 py-3 font-medium transition-colors"
        :to="cancelTarget"
      >
        Cancel
      </NuxtLink>
    </div>
  </form>
</template>
