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
 * ████████████████████████████████ #components/widgets/leagues/settings-form/index.vue ████████████████████████████████
 *
 * The four-section league settings editor, each section saved on its own against the revision it loaded.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesSettingsForm :league="league" />
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';

import { LEAGUE_SETTINGS_NUMERIC_BOUNDS, MATCH_FORMAT_CHOICES, TARGET_SCORE_CHOICES } from '#shared/league-settings';
import type { ILeagueConfiguration, ILeagueDetail, ISaveSettingsRequest } from '#shared/leagues';
import {
  LEAGUE_GAME_TYPE_ORDER,
  LEAGUE_GAME_TYPES_EMPTY_MESSAGE,
  SETTINGS_EDITOR_ROLES,
  SettingsSection,
} from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
import { GAME_TYPE_LABELS } from '~/utils/leagues/display';
import type { ISectionState, ISettingsDraft, TSectionValidationResult } from '~/utils/leagues/settings';
import {
  buildSectionRequest,
  collectDraftFaultErrors,
  collectPersistedFaults,
  GAME_CREATOR_CHOICES,
  GAME_CREATOR_LABELS,
  isFieldVisible,
  isSectionDirty,
  reconcileUncertainSave,
  resolveSectionAdoption,
  RESULT_RECORDER_CHOICES,
  RESULT_RECORDER_LABELS,
  SETTINGS_CONFIRMATION_ON_CAPTION,
  SETTINGS_FIELD_CAPTIONS,
  SETTINGS_FIELD_LABELS,
  SETTINGS_FIELD_UNITS,
  SETTINGS_LEAVE_PROMPT,
  SETTINGS_RATINGS_OFF_CAPTION,
  SETTINGS_RATINGS_ON_CAPTION,
  SETTINGS_SAVED_DURATION_MS,
  SETTINGS_SECTION_HEADINGS,
  SETTINGS_SECTION_ORDER,
  SETTINGS_SECTION_READ_ONLY_CAPTIONS,
  SETTINGS_SINGLES_DOUBLES_HEADING,
  SettingsSectionPhase,
  toRefusalAlert,
  toSectionRows,
  toSettingsDraft,
  UncertainReconciliation,
} from '~/utils/leagues/settings';
import { classifyWriteFailure, WriteFailure } from '~/utils/leagues/write-failure';

import { toInitialSectionState } from './constants';
import type {
  ILeaguesSettingsFormEmits,
  ILeaguesSettingsFormProps,
  ISettingsRefusalBody,
  ISettingsWriteRejection,
} from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The league being edited, as its own page reads it.
 * @internal
 * @constant
 */
const props: ILeaguesSettingsFormProps = defineProps<ILeaguesSettingsFormProps>();

/* ─── Emits ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the editor tells the page: the configuration a save stored, so the heading above these sections reads what was
 * saved rather than what the page first read.
 * @internal
 * @constant
 */
const emit: (event: 'saved', configuration: ILeagueConfiguration) => void = defineEmits<ILeaguesSettingsFormEmits>();

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The configuration as the page believes it stands, replaced by what a save returns rather than by what it submitted.
 * @internal
 * @constant
 */
const configuration: Ref<ILeagueConfiguration> = ref({
  abbreviation: props.league.abbreviation,
  configurationRevision: props.league.configurationRevision,
  description: props.league.description,
  name: props.league.name,
  settings: props.league.settings,
});

/**
 * The values every section was loaded with, which Cancel restores and a stale check compares against.
 * @internal
 * @constant
 */
const loaded: Ref<ISettingsDraft> = ref(toSettingsDraft(configuration.value));

/**
 * The values as they are being edited.
 * @internal
 * @constant
 */
const draft: Ref<ISettingsDraft> = ref(toSettingsDraft(configuration.value));

/**
 * What each section is doing and showing.
 * @internal
 * @constant
 */
const states: Ref<Record<SettingsSection, ISectionState>> = ref({
  [SettingsSection.FORMATS]: toInitialSectionState(configuration.value.configurationRevision),
  [SettingsSection.IDENTITY]: toInitialSectionState(configuration.value.configurationRevision),
  [SettingsSection.RATINGS]: toInitialSectionState(configuration.value.configurationRevision),
  [SettingsSection.RESULTS]: toInitialSectionState(configuration.value.configurationRevision),
});

/**
 * The configuration a stale section draws beside its draft, per section.
 * @internal
 * @constant
 */
const staleAgainst: Ref<Partial<Record<SettingsSection, ISettingsDraft>>> = ref({});

/**
 * The body a section submitted, held while its outcome is unknown so a retry sends exactly the same request.
 * @internal
 * @constant
 */
const submitted: Ref<Partial<Record<SettingsSection, ISaveSettingsRequest>>> = ref({});

/**
 * The saves that have not settled; a second Save waits for the first rather than racing it.
 * @internal
 * @constant
 */
let queue: Promise<void> = Promise.resolve();

/**
 * The route a confirmed departure resumes, held while the page asks about unsaved changes.
 * @internal
 * @constant
 */
const pendingDeparture: Ref<string | null> = ref(null);

/**
 * The exits a 401 or a welcome-owing 403 takes.
 * @internal
 * @constant
 */
const exit: ReturnType<typeof useSessionExit> = useSessionExit();

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The stored numeric fields a fault is forcing into view, read from what is stored rather than from the draft, so
 * typing a valid replacement does not make a revealed control disappear before Save.
 * @internal
 * @constant
 */
const revealed: ComputedRef<string[]> = computed((): string[] => collectPersistedFaults(configuration.value.settings));

/**
 * Which sections this viewer's role gives controls in.
 * @internal
 * @constant
 */
const editable: ComputedRef<Record<SettingsSection, boolean>> = computed(
  (): Record<SettingsSection, boolean> =>
    Object.fromEntries(
      SETTINGS_SECTION_ORDER.map((section: SettingsSection): [SettingsSection, boolean] => [
        section,
        SETTINGS_EDITOR_ROLES[section].includes(props.league.viewerRole),
      ]),
    ) as Record<SettingsSection, boolean>,
);

/**
 * Which sections differ from the values they were loaded with.
 * @internal
 * @constant
 */
const dirty: ComputedRef<Record<SettingsSection, boolean>> = computed(
  (): Record<SettingsSection, boolean> =>
    Object.fromEntries(
      SETTINGS_SECTION_ORDER.map((section: SettingsSection): [SettingsSection, boolean] => [
        section,
        isSectionDirty(section, draft.value, loaded.value),
      ]),
    ) as Record<SettingsSection, boolean>,
);

/**
 * Whether anything anywhere on the page is unsaved, which is what the departure question asks about.
 * @internal
 * @constant
 */
const anyDirty: ComputedRef<boolean> = computed((): boolean =>
  SETTINGS_SECTION_ORDER.some((section: SettingsSection): boolean => dirty.value[section]),
);

/**
 * The messages a draft's own numeric faults would show, used only under a control a stored fault revealed.
 * @internal
 * @constant
 */
const draftFaults: ComputedRef<Record<string, string>> = computed(
  (): Record<string, string> => collectDraftFaultErrors(draft.value) as Record<string, string>,
);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A section's values, detached from the reactive object they came out of.
 *
 * Plain data throughout, so a serialize round trip is both the cheapest copy and the one that cannot carry a proxy
 * into another section's baseline
 * @internal
 * @function
 * @param value - The values to copy
 * @returns An independent copy
 */
function detach<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}

/**
 * The message beneath one control.
 *
 * A section's own messages come from its last Save. A control a stored fault revealed also shows that fault from load,
 * read from the draft so it goes as soon as a usable value is typed, while the control stays revealed until the save
 * that corrects what is stored
 * @internal
 * @function
 * @param section - The section the control is in
 * @param field - The control, as the editor addresses it
 * @returns The message, or null
 */
function messageFor(section: SettingsSection, field: string): string | null {
  const saved: string | undefined = states.value[section].errors[field];

  if (saved !== undefined) {
    return saved;
  }

  return revealed.value.includes(field) ? (draftFaults.value[field] ?? null) : null;
}

/**
 * Whether one control is drawn.
 * @internal
 * @function
 * @param field - The control, as the editor addresses it
 * @returns Whether it is drawn
 */
function visible(field: string): boolean {
  return isFieldVisible(field, draft.value, revealed.value);
}

/**
 * Clears what a section is saying, leaving its values alone.
 * @internal
 * @function
 * @param section - The section
 */
function quieten(section: SettingsSection): void {
  states.value[section] = {
    ...states.value[section],
    alert: null,
    confirmed: false,
    errors: {},
    message: null,
  };
}

/**
 * Restores the values one section was loaded with.
 * @internal
 * @function
 * @param section - The section
 */
function onCancel(section: SettingsSection): void {
  draft.value = { ...draft.value, [section]: detach(loaded.value[section]) };
  quieten(section);
  states.value[section] = { ...states.value[section], phase: SettingsSectionPhase.IDLE };
}

/**
 * Selects or clears one format, refusing to clear the last one before any request is made.
 * @internal
 * @function
 * @param gameType - The format toggled
 * @param event - The checkbox change
 */
function onToggleFormat(gameType: GameType, event: Event): void {
  const checked: boolean = (event.target as HTMLInputElement).checked;
  const current: GameType[] = draft.value[SettingsSection.FORMATS].allowedGameTypes;
  const next: GameType[] = checked
    ? [...current, gameType]
    : current.filter((selected: GameType): boolean => selected !== gameType);

  if (next.length === 0) {
    // The checkbox is put back rather than the league left with nothing to play
    (event.target as HTMLInputElement).checked = true;
    states.value[SettingsSection.FORMATS] = {
      ...states.value[SettingsSection.FORMATS],
      errors: { allowedGameTypes: LEAGUE_GAME_TYPES_EMPTY_MESSAGE },
    };

    return;
  }

  states.value[SettingsSection.FORMATS] = {
    ...states.value[SettingsSection.FORMATS],
    errors: Object.fromEntries(
      Object.entries(states.value[SettingsSection.FORMATS].errors).filter(
        ([field]: [string, string]): boolean => field !== 'allowedGameTypes',
      ),
    ),
  };
  draft.value[SettingsSection.FORMATS].allowedGameTypes = LEAGUE_GAME_TYPE_ORDER.filter(
    (candidate: GameType): boolean => next.includes(candidate),
  );
}

/**
 * Puts focus on the control a refusal named.
 * @internal
 * @function
 * @param field - The control, as the editor addresses it
 */
function focusField(field: string): void {
  void nextTick((): void => {
    document.querySelector<HTMLElement>(`#setting-${field.replace('.', '-')}`)?.focus();
  });
}

/**
 * Takes a configuration a save returned, section by section.
 *
 * The section that saved shows what is stored rather than what it sent. A clean section adopts silently. A dirty one
 * keeps its draft, and moves to the new revision only while its own baseline is still current; otherwise it has the
 * comparison to show first (page spec, Saving)
 * @internal
 * @function
 * @param saved - The section whose save returned this configuration
 * @param returned - The configuration as it is now stored
 */
function adoptConfiguration(saved: SettingsSection, returned: ILeagueConfiguration): void {
  const returnedDraft: ISettingsDraft = toSettingsDraft(returned);

  configuration.value = returned;

  // The page draws the league's name above these sections, so it hears what was stored rather than reading again
  emit('saved', returned);

  for (const section of SETTINGS_SECTION_ORDER) {
    if (section === saved) {
      draft.value = { ...draft.value, [section]: detach(returnedDraft[section]) };
      loaded.value = { ...loaded.value, [section]: detach(returnedDraft[section]) };
      states.value[section] = {
        alert: null,
        confirmed: true,
        errors: {},
        message: null,
        phase: SettingsSectionPhase.IDLE,
        revision: returned.configurationRevision,
      };

      continue;
    }

    const adoption: ReturnType<typeof resolveSectionAdoption> = resolveSectionAdoption({
      dirty: isSectionDirty(section, draft.value, loaded.value),
      draft: draft.value,
      loaded: loaded.value,
      returned: returnedDraft,
      returnedRevision: returned.configurationRevision,
      revision: states.value[section].revision,
      section,
    });

    if (adoption.adopt) {
      draft.value = { ...draft.value, [section]: detach(returnedDraft[section]) };
    }

    if (adoption.stale) {
      staleAgainst.value = { ...staleAgainst.value, [section]: returnedDraft };
    } else {
      // A section whose own baseline is still current keeps its draft against values that have not moved under it
      loaded.value = { ...loaded.value, [section]: detach(returnedDraft[section]) };
    }

    states.value[section] = {
      ...states.value[section],
      alert: adoption.stale ? SettingsSectionAlert.STALE : states.value[section].alert,
      confirmed: false,
      phase: adoption.stale ? SettingsSectionPhase.STALE : states.value[section].phase,
      revision: adoption.revision,
    };
  }

  window.setTimeout((): void => {
    states.value[saved] = { ...states.value[saved], confirmed: false };
  }, SETTINGS_SAVED_DURATION_MS);
}

/**
 * Shows a section the configuration as it now stands, beside its own draft.
 * @internal
 * @function
 * @param section - The section
 * @param current - The configuration the server answered with
 */
function showStale(section: SettingsSection, current: ILeagueConfiguration): void {
  configuration.value = current;
  staleAgainst.value = { ...staleAgainst.value, [section]: toSettingsDraft(current) };
  states.value[section] = {
    ...states.value[section],
    alert: SettingsSectionAlert.STALE,
    confirmed: false,
    errors: {},
    message: null,
    phase: SettingsSectionPhase.STALE,
  };
}

/**
 * Reads the configuration a 409 carried, so the stale comparison makes no second request.
 * @internal
 * @function
 * @param error - What `$fetch` rejected with
 * @returns The configuration, or null when the body did not carry one
 */
function readStaleConfiguration(error: unknown): ILeagueConfiguration | null {
  const data: unknown = (error as ISettingsWriteRejection).data;

  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const candidate: Partial<ILeagueConfiguration> = data as Partial<ILeagueConfiguration>;

  return typeof candidate.configurationRevision === 'number' && candidate.settings
    ? (candidate as ILeagueConfiguration)
    : null;
}

/**
 * Reads the line a definite refusal carried, so a value the client let through is named rather than generalized.
 * @internal
 * @function
 * @param error - What `$fetch` rejected with
 * @returns The message, or null
 */
function readRefusalMessage(error: unknown): string | null {
  const rejection: ISettingsWriteRejection = error as ISettingsWriteRejection;
  const body: ISettingsRefusalBody =
    typeof rejection.data === 'object' && rejection.data !== null ? (rejection.data as ISettingsRefusalBody) : {};

  // The body first: it is the line the endpoint refused with, while the status line is whatever survived the wire
  for (const candidate of [body.message, body.statusMessage, rejection.statusMessage]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

/**
 * Re-reads the league after a save whose answer was lost, and settles the section on what it finds.
 * @internal
 * @function
 * @param section - The section
 * @param request - The body it submitted
 */
async function reconcile(section: SettingsSection, request: ISaveSettingsRequest): Promise<void> {
  let current: ILeagueConfiguration | null = null;

  try {
    const detail: ILeagueDetail = await $fetch<ILeagueDetail>(`/api/leagues/${props.league.id}`);

    current = {
      abbreviation: detail.abbreviation,
      configurationRevision: detail.configurationRevision,
      description: detail.description,
      name: detail.name,
      settings: detail.settings,
    };
  } catch {
    current = null;
  }

  if (current === null) {
    // Nothing is sent from here: the only action is another read
    states.value[section] = {
      ...states.value[section],
      alert: SettingsSectionAlert.RECONCILE_FAILED,
      phase: SettingsSectionPhase.RECONCILE_FAILED,
    };

    return;
  }

  const outcome: UncertainReconciliation = reconcileUncertainSave(request, current);

  if (outcome === UncertainReconciliation.SAVED) {
    adoptConfiguration(section, current);

    return;
  }

  if (outcome === UncertainReconciliation.STALE) {
    showStale(section, current);

    return;
  }

  // The write was lost and the revision has not moved, so the identical request may be sent again
  configuration.value = current;
  states.value[section] = { ...states.value[section], phase: SettingsSectionPhase.UNCERTAIN };
}

/**
 * Leaves for sign-in or for the welcome step when the refusal was about the session rather than the save.
 *
 * Both exits can reject on the same bad network that refused the write, and an escaping rejection would leave the
 * section read-only with no alert and no way back, so a failed exit settles with the others instead
 * @internal
 * @function
 * @param failure - How the write failed
 * @returns Whether the page is leaving, and nothing more should be settled
 */
async function leftForSession(failure: WriteFailure): Promise<boolean> {
  try {
    if (failure === WriteFailure.UNAUTHORIZED) {
      await exit.toSignIn();

      return true;
    }

    return failure === WriteFailure.FORBIDDEN && (await exit.toWelcomeIfOwed());
  } catch {
    return false;
  }
}

/**
 * Settles a section on a save that did not come back as a save.
 * @internal
 * @function
 * @param section - The section
 * @param request - The body it submitted
 * @param error - What `$fetch` rejected with
 */
async function settleFailure(section: SettingsSection, request: ISaveSettingsRequest, error: unknown): Promise<void> {
  const failure: WriteFailure = classifyWriteFailure(error);

  if (await leftForSession(failure)) {
    return;
  }

  // The 409 carries the configuration as it now stands, so the comparison makes no second request
  const current: ILeagueConfiguration | null = failure === WriteFailure.CONFLICT ? readStaleConfiguration(error) : null;

  if (current !== null) {
    showStale(section, current);

    return;
  }

  if (failure === WriteFailure.UNCERTAIN) {
    states.value[section] = { ...states.value[section], phase: SettingsSectionPhase.UNCERTAIN };

    await reconcile(section, request);

    return;
  }

  states.value[section] = {
    ...states.value[section],
    alert: toRefusalAlert(failure),
    message: failure === WriteFailure.FORBIDDEN ? null : readRefusalMessage(error),
    phase: SettingsSectionPhase.IDLE,
  };
}

/**
 * Sends one section, and reads whatever comes back as a save or as one of the ways a save does not happen.
 * @internal
 * @function
 * @param section - The section
 * @param request - The body to send
 */
async function send(section: SettingsSection, request: ISaveSettingsRequest): Promise<void> {
  submitted.value = { ...submitted.value, [section]: request };
  states.value[section] = {
    ...states.value[section],
    alert: null,
    confirmed: false,
    message: null,
    phase: SettingsSectionPhase.SAVING,
  };

  try {
    const saved: ILeagueConfiguration = await $fetch<ILeagueConfiguration>(`/api/leagues/${props.league.id}/settings`, {
      body: request,
      method: 'PATCH',
    });

    adoptConfiguration(section, saved);
  } catch (error: unknown) {
    await settleFailure(section, request, error);
  }
}

/**
 * Validates one section and sends it, behind whatever save is already in flight.
 * @internal
 * @function
 * @param section - The section
 */
function onSave(section: SettingsSection): void {
  const built: TSectionValidationResult<ISaveSettingsRequest> = buildSectionRequest(
    section,
    draft.value,
    states.value[section].revision,
  );

  if (!built.ok) {
    states.value[section] = {
      ...states.value[section],
      alert: null,
      confirmed: false,
      errors: built.errors,
      message: null,
    };
    focusField(built.focus);

    return;
  }

  // Serialized rather than concurrent: a second Save waits for the first to settle
  queue = queue.then((): Promise<void> => send(section, built.value));
}

/**
 * Sends the held snapshot again, at the revision it carried the first time.
 * @internal
 * @function
 * @param section - The section
 */
function onRetry(section: SettingsSection): void {
  const request: ISaveSettingsRequest | undefined = submitted.value[section];

  if (request !== undefined) {
    queue = queue.then((): Promise<void> => send(section, request));
  }
}

/**
 * Reads the league again after a reconciliation that could not be made.
 * @internal
 * @function
 * @param section - The section
 */
function onRetryCheck(section: SettingsSection): void {
  const request: ISaveSettingsRequest | undefined = submitted.value[section];

  if (request !== undefined) {
    queue = queue.then((): Promise<void> => reconcile(section, request));
  }
}

/**
 * Discards a stale section's draft and takes the values shown beside it.
 * @internal
 * @function
 * @param section - The section
 */
function onUseCurrent(section: SettingsSection): void {
  const current: ISettingsDraft | undefined = staleAgainst.value[section];

  if (current === undefined) {
    return;
  }

  draft.value = { ...draft.value, [section]: detach(current[section]) };
  loaded.value = { ...loaded.value, [section]: detach(current[section]) };
  quieten(section);
  states.value[section] = {
    ...states.value[section],
    phase: SettingsSectionPhase.IDLE,
    revision: configuration.value.configurationRevision,
  };
}

/**
 * Keeps a stale section's draft, against the values now shown, at the revision they came back at.
 * @internal
 * @function
 * @param section - The section
 */
function onReviewDraft(section: SettingsSection): void {
  const current: ISettingsDraft | undefined = staleAgainst.value[section];

  if (current === undefined) {
    return;
  }

  // The draft stays exactly as it is; only what it is compared against, and the revision its Save carries, move
  loaded.value = { ...loaded.value, [section]: detach(current[section]) };
  quieten(section);
  states.value[section] = {
    ...states.value[section],
    phase: SettingsSectionPhase.IDLE,
    revision: configuration.value.configurationRevision,
  };
}

/**
 * Leaves the page, having asked once.
 * @internal
 * @function
 */
async function onLeave(): Promise<void> {
  const destination: string | null = pendingDeparture.value;

  pendingDeparture.value = null;

  if (destination !== null) {
    loaded.value = detach(draft.value);

    await navigateTo(destination);
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// Asked once, in the page rather than through the browser's own dialog, and only when something is unsaved
onBeforeRouteLeave((to: RouteLocationNormalized): boolean => {
  if (!anyDirty.value || pendingDeparture.value !== null) {
    return true;
  }

  pendingDeparture.value = to.fullPath;

  return false;
});
</script>

<template>
  <div class="space-y-6">
    <!-- Identity -->
    <WidgetsLeaguesSettingsSection
      :current-rows="toSectionRows(SettingsSection.IDENTITY, staleAgainst[SettingsSection.IDENTITY] ?? draft, revealed)"
      :dirty="dirty[SettingsSection.IDENTITY]"
      :editable="editable[SettingsSection.IDENTITY]"
      :heading="SETTINGS_SECTION_HEADINGS[SettingsSection.IDENTITY]"
      :read-only-caption="SETTINGS_SECTION_READ_ONLY_CAPTIONS[SettingsSection.IDENTITY]"
      :rows="toSectionRows(SettingsSection.IDENTITY, draft, revealed)"
      :section="SettingsSection.IDENTITY"
      :state="states[SettingsSection.IDENTITY]"
      @cancel="onCancel(SettingsSection.IDENTITY)"
      @retry="onRetry(SettingsSection.IDENTITY)"
      @retry-check="onRetryCheck(SettingsSection.IDENTITY)"
      @review-draft="onReviewDraft(SettingsSection.IDENTITY)"
      @save="onSave(SettingsSection.IDENTITY)"
      @use-current="onUseCurrent(SettingsSection.IDENTITY)"
    >
      <div class="space-y-6">
        <WidgetsLeaguesSettingsField
          v-slot="{ id, describedBy, invalid }"
          field="name"
          :label="SETTINGS_FIELD_LABELS.name"
          :message="messageFor(SettingsSection.IDENTITY, 'name')"
        >
          <input
            :id="id"
            v-model="draft.IDENTITY.name"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
            autocomplete="off"
            class="border-border bg-surface text-ink focus:border-accent mt-2 block w-full rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
            type="text"
          />
        </WidgetsLeaguesSettingsField>

        <WidgetsLeaguesSettingsField
          v-slot="{ id, describedBy, invalid }"
          field="abbreviation"
          :label="SETTINGS_FIELD_LABELS.abbreviation"
          :message="messageFor(SettingsSection.IDENTITY, 'abbreviation')"
        >
          <!-- Uppercased as it is typed, the way the create form shows it, and uppercased again when it is validated -->
          <input
            :id="id"
            v-model="draft.IDENTITY.abbreviation"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
            autocomplete="off"
            class="border-border bg-surface text-ink focus:border-accent mt-2 block w-40 rounded-md border px-4 py-3 uppercase transition-colors outline-none disabled:opacity-60"
            type="text"
          />
        </WidgetsLeaguesSettingsField>

        <WidgetsLeaguesSettingsField
          v-slot="{ id, describedBy, invalid }"
          field="description"
          :label="SETTINGS_FIELD_LABELS.description"
          :message="messageFor(SettingsSection.IDENTITY, 'description')"
        >
          <input
            :id="id"
            v-model="draft.IDENTITY.description"
            :aria-describedby="describedBy"
            :aria-invalid="invalid"
            autocomplete="off"
            class="border-border bg-surface text-ink focus:border-accent mt-2 block w-full rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
            type="text"
          />
        </WidgetsLeaguesSettingsField>
      </div>
    </WidgetsLeaguesSettingsSection>

    <!-- Formats and scoring -->
    <WidgetsLeaguesSettingsSection
      :current-rows="toSectionRows(SettingsSection.FORMATS, staleAgainst[SettingsSection.FORMATS] ?? draft, revealed)"
      :dirty="dirty[SettingsSection.FORMATS]"
      :editable="editable[SettingsSection.FORMATS]"
      :heading="SETTINGS_SECTION_HEADINGS[SettingsSection.FORMATS]"
      :read-only-caption="SETTINGS_SECTION_READ_ONLY_CAPTIONS[SettingsSection.FORMATS]"
      :rows="toSectionRows(SettingsSection.FORMATS, draft, revealed)"
      :section="SettingsSection.FORMATS"
      :state="states[SettingsSection.FORMATS]"
      @cancel="onCancel(SettingsSection.FORMATS)"
      @retry="onRetry(SettingsSection.FORMATS)"
      @retry-check="onRetryCheck(SettingsSection.FORMATS)"
      @review-draft="onReviewDraft(SettingsSection.FORMATS)"
      @save="onSave(SettingsSection.FORMATS)"
      @use-current="onUseCurrent(SettingsSection.FORMATS)"
    >
      <div class="space-y-6">
        <fieldset
          :aria-describedby="
            messageFor(SettingsSection.FORMATS, 'allowedGameTypes') ? 'setting-allowedGameTypes-message' : undefined
          "
        >
          <legend class="text-ink text-body-sm font-medium">{{ SETTINGS_FIELD_LABELS.allowedGameTypes }}</legend>

          <div class="mt-3 flex flex-wrap gap-x-6 gap-y-3">
            <label
              v-for="gameType in LEAGUE_GAME_TYPE_ORDER"
              :key="gameType"
              class="text-ink text-body flex items-center gap-2"
            >
              <input
                :checked="draft.FORMATS.allowedGameTypes.includes(gameType)"
                class="accent-accent size-4"
                type="checkbox"
                :value="gameType"
                @change="onToggleFormat(gameType, $event)"
              />
              {{ GAME_TYPE_LABELS[gameType] }}
            </label>
          </div>

          <p
            v-if="messageFor(SettingsSection.FORMATS, 'allowedGameTypes')"
            id="setting-allowedGameTypes-message"
            class="text-negative-soft-ink text-body-sm mt-2"
          >
            {{ messageFor(SettingsSection.FORMATS, 'allowedGameTypes') }}
          </p>
        </fieldset>

        <!-- One select per format the league plays, and one a stored fault has forced back into view -->
        <template
          v-for="gameType in LEAGUE_GAME_TYPE_ORDER"
          :key="`target-${gameType}`"
        >
          <WidgetsLeaguesSettingsField
            v-if="visible(`targetScore.${gameType}`)"
            v-slot="{ id, describedBy, invalid }"
            :field="`targetScore.${gameType}`"
            :label="SETTINGS_FIELD_LABELS[`targetScore.${gameType}`] ?? ''"
            :message="messageFor(SettingsSection.FORMATS, `targetScore.${gameType}`)"
          >
            <select
              :id="id"
              v-model.number="draft.FORMATS.targetScore[gameType]"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              class="border-border bg-surface text-ink focus:border-accent mt-2 block w-40 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
            >
              <option
                v-for="choice in TARGET_SCORE_CHOICES[gameType]"
                :key="choice"
                :value="choice"
              >
                {{ choice }}
              </option>
            </select>
          </WidgetsLeaguesSettingsField>
        </template>

        <WidgetsLeaguesSettingsField
          v-slot="{ id, describedBy, invalid }"
          field="winningMargin"
          :label="SETTINGS_FIELD_LABELS.winningMargin"
          :message="messageFor(SettingsSection.FORMATS, 'winningMargin')"
        >
          <div class="mt-2 flex items-center gap-2">
            <input
              :id="id"
              v-model="draft.FORMATS.winningMargin"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              class="border-border bg-surface text-ink focus:border-accent block w-28 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
              inputmode="numeric"
              :max="LEAGUE_SETTINGS_NUMERIC_BOUNDS.winningMargin.max"
              :min="LEAGUE_SETTINGS_NUMERIC_BOUNDS.winningMargin.min"
              type="number"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.winningMargin }}</span>
          </div>
        </WidgetsLeaguesSettingsField>

        <!-- Cutthroat rotates service on a lost rally and never expedites, so these are named as the others' rules -->
        <fieldset
          v-if="visible('matchFormat') || visible('serviceInterval') || visible('expediteEnabled')"
          class="border-border space-y-6 rounded-md border p-4"
        >
          <legend
            v-if="draft.FORMATS.allowedGameTypes.includes(GameType.CUTTHROAT)"
            class="text-ink text-body-sm px-2 font-medium"
          >
            {{ SETTINGS_SINGLES_DOUBLES_HEADING }}
          </legend>

          <WidgetsLeaguesSettingsField
            v-if="visible('matchFormat')"
            v-slot="{ id, describedBy, invalid }"
            field="matchFormat"
            :label="SETTINGS_FIELD_LABELS.matchFormat"
            :message="messageFor(SettingsSection.FORMATS, 'matchFormat')"
          >
            <select
              :id="id"
              v-model.number="draft.FORMATS.matchFormat"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              class="border-border bg-surface text-ink focus:border-accent mt-2 block w-40 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
            >
              <option
                v-for="choice in MATCH_FORMAT_CHOICES"
                :key="choice"
                :value="choice"
              >
                {{ choice }}
              </option>
            </select>
          </WidgetsLeaguesSettingsField>

          <WidgetsLeaguesSettingsField
            v-if="visible('serviceInterval')"
            v-slot="{ id, describedBy, invalid }"
            :caption="SETTINGS_FIELD_CAPTIONS.serviceInterval"
            field="serviceInterval"
            :label="SETTINGS_FIELD_LABELS.serviceInterval"
            :message="messageFor(SettingsSection.FORMATS, 'serviceInterval')"
          >
            <div class="mt-2 flex items-center gap-2">
              <input
                :id="id"
                v-model="draft.FORMATS.serviceInterval"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
                class="border-border bg-surface text-ink focus:border-accent block w-28 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
                inputmode="numeric"
                :max="LEAGUE_SETTINGS_NUMERIC_BOUNDS.serviceInterval.max"
                :min="LEAGUE_SETTINGS_NUMERIC_BOUNDS.serviceInterval.min"
                type="number"
              />

              <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.serviceInterval }}</span>
            </div>
          </WidgetsLeaguesSettingsField>

          <label
            v-if="visible('expediteEnabled')"
            class="text-ink text-body flex items-center gap-3"
          >
            <input
              v-model="draft.FORMATS.expediteEnabled"
              class="accent-accent size-4"
              type="checkbox"
            />
            {{ SETTINGS_FIELD_LABELS.expediteEnabled }}
          </label>
        </fieldset>

        <WidgetsLeaguesSettingsField
          v-if="visible('cutthroatTimeCap')"
          v-slot="{ id, describedBy, invalid }"
          field="cutthroatTimeCap"
          :label="SETTINGS_FIELD_LABELS.cutthroatTimeCap"
          :message="messageFor(SettingsSection.FORMATS, 'cutthroatTimeCap')"
        >
          <div class="mt-2 flex items-center gap-2">
            <input
              :id="id"
              v-model="draft.FORMATS.cutthroatTimeCap"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              class="border-border bg-surface text-ink focus:border-accent block w-28 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
              inputmode="numeric"
              :max="LEAGUE_SETTINGS_NUMERIC_BOUNDS.cutthroatTimeCap.max"
              :min="LEAGUE_SETTINGS_NUMERIC_BOUNDS.cutthroatTimeCap.min"
              type="number"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.cutthroatTimeCap }}</span>
          </div>
        </WidgetsLeaguesSettingsField>

        <WidgetsLeaguesSettingsField
          v-slot="{ id, describedBy, invalid }"
          field="walkoverGracePeriod"
          :label="SETTINGS_FIELD_LABELS.walkoverGracePeriod"
          :message="messageFor(SettingsSection.FORMATS, 'walkoverGracePeriod')"
        >
          <div class="mt-2 flex items-center gap-2">
            <input
              :id="id"
              v-model="draft.FORMATS.walkoverGracePeriod"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              class="border-border bg-surface text-ink focus:border-accent block w-28 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
              inputmode="numeric"
              :max="LEAGUE_SETTINGS_NUMERIC_BOUNDS.walkoverGracePeriod.max"
              :min="LEAGUE_SETTINGS_NUMERIC_BOUNDS.walkoverGracePeriod.min"
              type="number"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.walkoverGracePeriod }}</span>
          </div>
        </WidgetsLeaguesSettingsField>
      </div>
    </WidgetsLeaguesSettingsSection>

    <!-- Results -->
    <WidgetsLeaguesSettingsSection
      :current-rows="toSectionRows(SettingsSection.RESULTS, staleAgainst[SettingsSection.RESULTS] ?? draft, revealed)"
      :dirty="dirty[SettingsSection.RESULTS]"
      :editable="editable[SettingsSection.RESULTS]"
      :heading="SETTINGS_SECTION_HEADINGS[SettingsSection.RESULTS]"
      :read-only-caption="SETTINGS_SECTION_READ_ONLY_CAPTIONS[SettingsSection.RESULTS]"
      :rows="toSectionRows(SettingsSection.RESULTS, draft, revealed)"
      :section="SettingsSection.RESULTS"
      :state="states[SettingsSection.RESULTS]"
      @cancel="onCancel(SettingsSection.RESULTS)"
      @retry="onRetry(SettingsSection.RESULTS)"
      @retry-check="onRetryCheck(SettingsSection.RESULTS)"
      @review-draft="onReviewDraft(SettingsSection.RESULTS)"
      @save="onSave(SettingsSection.RESULTS)"
      @use-current="onUseCurrent(SettingsSection.RESULTS)"
    >
      <div class="space-y-6">
        <WidgetsLeaguesSettingsField
          v-slot="{ id, describedBy }"
          field="whoCanCreateGames"
          :label="SETTINGS_FIELD_LABELS.whoCanCreateGames"
        >
          <select
            :id="id"
            v-model="draft.RESULTS.whoCanCreateGames"
            :aria-describedby="describedBy"
            class="border-border bg-surface text-ink focus:border-accent mt-2 block w-full max-w-sm rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
          >
            <option
              v-for="choice in GAME_CREATOR_CHOICES"
              :key="choice"
              :value="choice"
            >
              {{ GAME_CREATOR_LABELS[choice] }}
            </option>
          </select>
        </WidgetsLeaguesSettingsField>

        <WidgetsLeaguesSettingsField
          v-slot="{ id, describedBy }"
          field="whoCanRecordResults"
          :label="SETTINGS_FIELD_LABELS.whoCanRecordResults"
        >
          <select
            :id="id"
            v-model="draft.RESULTS.whoCanRecordResults"
            :aria-describedby="describedBy"
            class="border-border bg-surface text-ink focus:border-accent mt-2 block w-full max-w-sm rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
          >
            <option
              v-for="choice in RESULT_RECORDER_CHOICES"
              :key="choice"
              :value="choice"
            >
              {{ RESULT_RECORDER_LABELS[choice] }}
            </option>
          </select>
        </WidgetsLeaguesSettingsField>

        <div>
          <label class="text-ink text-body flex items-center gap-3">
            <input
              v-model="draft.RESULTS.requireConfirmation"
              class="accent-accent size-4"
              type="checkbox"
            />
            {{ SETTINGS_FIELD_LABELS.requireConfirmation }}
          </label>

          <p
            v-if="draft.RESULTS.requireConfirmation"
            class="text-ink-subtle text-caption mt-2"
          >
            {{ SETTINGS_CONFIRMATION_ON_CAPTION }}
          </p>
        </div>

        <WidgetsLeaguesSettingsField
          v-if="visible('resultConfirmationWindow')"
          v-slot="{ id, describedBy, invalid }"
          field="resultConfirmationWindow"
          :label="SETTINGS_FIELD_LABELS.resultConfirmationWindow"
          :message="messageFor(SettingsSection.RESULTS, 'resultConfirmationWindow')"
        >
          <div class="mt-2 flex items-center gap-2">
            <input
              :id="id"
              v-model="draft.RESULTS.resultConfirmationWindow"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              class="border-border bg-surface text-ink focus:border-accent block w-28 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
              inputmode="numeric"
              :max="LEAGUE_SETTINGS_NUMERIC_BOUNDS.resultConfirmationWindow.max"
              :min="LEAGUE_SETTINGS_NUMERIC_BOUNDS.resultConfirmationWindow.min"
              type="number"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.resultConfirmationWindow }}</span>
          </div>
        </WidgetsLeaguesSettingsField>

        <WidgetsLeaguesSettingsField
          v-slot="{ id, describedBy, invalid }"
          :caption="SETTINGS_FIELD_CAPTIONS.resultAmendmentWindow"
          field="resultAmendmentWindow"
          :label="SETTINGS_FIELD_LABELS.resultAmendmentWindow"
          :message="messageFor(SettingsSection.RESULTS, 'resultAmendmentWindow')"
        >
          <div class="mt-2 flex items-center gap-2">
            <input
              :id="id"
              v-model="draft.RESULTS.resultAmendmentWindow"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              class="border-border bg-surface text-ink focus:border-accent block w-28 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
              inputmode="numeric"
              :max="LEAGUE_SETTINGS_NUMERIC_BOUNDS.resultAmendmentWindow.max"
              :min="LEAGUE_SETTINGS_NUMERIC_BOUNDS.resultAmendmentWindow.min"
              type="number"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.resultAmendmentWindow }}</span>
          </div>
        </WidgetsLeaguesSettingsField>
      </div>
    </WidgetsLeaguesSettingsSection>

    <!-- Ratings -->
    <WidgetsLeaguesSettingsSection
      :current-rows="toSectionRows(SettingsSection.RATINGS, staleAgainst[SettingsSection.RATINGS] ?? draft, revealed)"
      :dirty="dirty[SettingsSection.RATINGS]"
      :editable="editable[SettingsSection.RATINGS]"
      :heading="SETTINGS_SECTION_HEADINGS[SettingsSection.RATINGS]"
      :read-only-caption="SETTINGS_SECTION_READ_ONLY_CAPTIONS[SettingsSection.RATINGS]"
      :rows="toSectionRows(SettingsSection.RATINGS, draft, revealed)"
      :section="SettingsSection.RATINGS"
      :state="states[SettingsSection.RATINGS]"
      @cancel="onCancel(SettingsSection.RATINGS)"
      @retry="onRetry(SettingsSection.RATINGS)"
      @retry-check="onRetryCheck(SettingsSection.RATINGS)"
      @review-draft="onReviewDraft(SettingsSection.RATINGS)"
      @save="onSave(SettingsSection.RATINGS)"
      @use-current="onUseCurrent(SettingsSection.RATINGS)"
    >
      <div class="space-y-6">
        <div>
          <label class="text-ink text-body flex items-center gap-3">
            <input
              v-model="draft.RATINGS.ratingEnabled"
              class="accent-accent size-4"
              type="checkbox"
            />
            {{ SETTINGS_FIELD_LABELS.ratingEnabled }}
          </label>

          <p class="text-ink-subtle text-caption mt-2">
            {{ draft.RATINGS.ratingEnabled ? SETTINGS_RATINGS_ON_CAPTION : SETTINGS_RATINGS_OFF_CAPTION }}
          </p>
        </div>

        <WidgetsLeaguesSettingsField
          v-if="visible('provisionalGames')"
          v-slot="{ id, describedBy, invalid }"
          :caption="SETTINGS_FIELD_CAPTIONS.provisionalGames"
          field="provisionalGames"
          :label="SETTINGS_FIELD_LABELS.provisionalGames"
          :message="messageFor(SettingsSection.RATINGS, 'provisionalGames')"
        >
          <div class="mt-2 flex items-center gap-2">
            <input
              :id="id"
              v-model="draft.RATINGS.provisionalGames"
              :aria-describedby="describedBy"
              :aria-invalid="invalid"
              class="border-border bg-surface text-ink focus:border-accent block w-28 rounded-md border px-4 py-3 transition-colors outline-none disabled:opacity-60"
              inputmode="numeric"
              :max="LEAGUE_SETTINGS_NUMERIC_BOUNDS.provisionalGames.max"
              :min="LEAGUE_SETTINGS_NUMERIC_BOUNDS.provisionalGames.min"
              type="number"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.provisionalGames }}</span>
          </div>
        </WidgetsLeaguesSettingsField>
      </div>
    </WidgetsLeaguesSettingsSection>

    <!-- Asked once, in the page, when a departure would take unsaved changes with it -->
    <div
      v-if="pendingDeparture !== null"
      class="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div class="border-border bg-surface w-full max-w-sm rounded-lg border p-6">
        <p class="text-ink text-body font-medium">{{ SETTINGS_LEAVE_PROMPT }}</p>

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-5 py-2.5 font-medium transition-colors"
            type="button"
            @click="onLeave()"
          >
            Leave
          </button>

          <button
            class="border-border text-ink hover:border-accent text-body-sm rounded-md border px-5 py-2.5 font-medium transition-colors"
            type="button"
            @click="pendingDeparture = null"
          >
            Stay
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
