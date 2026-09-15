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

import { MATCH_FORMAT_CHOICES, TARGET_SCORE_CHOICES } from '#shared/league-settings';
import type { ILeagueConfiguration, ILeagueDetail, ISaveSettingsRequest } from '#shared/leagues';
import {
  LEAGUE_GAME_TYPE_ORDER,
  LEAGUE_GAME_TYPES_EMPTY_MESSAGE,
  LEAGUE_VALUE_REJECTED_STATUS,
  SETTINGS_EDITOR_ROLES,
  SettingsSection,
} from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
import { GAME_TYPE_LABELS } from '~/utils/leagues/display';
import type {
  ISectionState,
  ISettingsComparison,
  ISettingsDraft,
  TSectionFieldErrors,
  TSectionValidationResult,
  TSettingsControl,
} from '~/utils/leagues/settings';
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
  SETTINGS_SECTION_CONTROL_ORDER,
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
import { classifyWriteFailure, readWriteStatus, WriteFailure } from '~/utils/leagues/write-failure';

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
 * The configuration a stale section draws beside its draft, with the revision those values are at, per section.
 *
 * The revision travels with the values rather than being read off the page when the person answers: another section's
 * conflict moves the page's own idea of current, and a section may only adopt the revision it was actually shown
 * @internal
 * @constant
 */
const staleAgainst: Ref<Partial<Record<SettingsSection, ISettingsComparison>>> = ref({});

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
 * What had focus when the departure question was asked, so answering Stay gives it back.
 * @internal
 * @constant
 */
let departureOrigin: HTMLElement | null = null;

/**
 * Whether the page is leaving because the session ended rather than because the person chose to.
 *
 * A forced exit is not a departure to ask about: the guard would block its own `navigateTo`, and Vue Router answers an
 * aborted push with a failure rather than a rejection, so the section that triggered it would sit at Saving for good
 * @internal
 * @constant
 */
let leavingForSession: boolean = false;

/**
 * The departure question's safe answer, which takes focus while the question stands.
 * @internal
 * @constant
 */
const stayButton: Ref<HTMLButtonElement | null> = ref(null);

/**
 * The departure question's other answer, which Tab cycles back to.
 * @internal
 * @constant
 */
const leaveButton: Ref<HTMLButtonElement | null> = ref(null);

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

/**
 * The line under the ratings toggle, which says what the draft would change rather than what the league already is.
 *
 * Off reads as what playing without ratings means. On reads as when ratings would start, and only while the loaded
 * value was off: a league whose ratings have always been on is not starting anything, and was reading a promise about
 * its next game from load (page spec 2.4, Ratings)
 * @internal
 * @constant
 */
const ratingsCaption: ComputedRef<string | null> = computed((): string | null => {
  if (!draft.value[SettingsSection.RATINGS].ratingEnabled) {
    return SETTINGS_RATINGS_OFF_CAPTION;
  }

  return loaded.value[SettingsSection.RATINGS].ratingEnabled ? null : SETTINGS_RATINGS_ON_CAPTION;
});

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
 * The message under every drawn row of one section, by the same rule its controls read.
 *
 * A viewer with no controls here reads rows rather than fields, and a row a stored fault revealed carries the message
 * that fault would have put under the control, so the fault reads as a fault to every role (page spec, Saving)
 * @internal
 * @function
 * @param section - The section
 * @returns One message per field that has one
 */
function rowMessagesFor(section: SettingsSection): TSectionFieldErrors {
  return Object.fromEntries(
    SETTINGS_SECTION_CONTROL_ORDER[section]
      .map((field: TSettingsControl): [string, string | null] => [field, messageFor(section, field)])
      .filter((entry: [string, string | null]): entry is [string, string] => entry[1] !== null),
  );
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
      staleAgainst.value = {
        ...staleAgainst.value,
        [section]: { draft: returnedDraft, revision: returned.configurationRevision },
      };
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
  staleAgainst.value = {
    ...staleAgainst.value,
    [section]: { draft: toSettingsDraft(current), revision: current.configurationRevision },
  };
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
 *
 * Only the value rejection is read this way. Every other refusal the page words itself, because the server's own line
 * for a 429 or a plain 4xx is not the line the page promises, and letting a body through replaced pinned copy with
 * whatever the endpoint happened to say (page spec, Saving; Fable, 2026-09-15)
 * @internal
 * @function
 * @param error - What `$fetch` rejected with
 * @returns The message, or null when the refusal is not the one that names a field
 */
function readRefusalMessage(error: unknown): string | null {
  if (readWriteStatus(error) !== LEAGUE_VALUE_REJECTED_STATUS) {
    return null;
  }

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
  // The unsaved-changes question is not asked about an exit nobody chose: the guard would abort this very navigation,
  // and an aborted push resolves rather than rejects, so the section would stay locked with nothing to say
  leavingForSession = true;

  try {
    if (failure === WriteFailure.UNAUTHORIZED) {
      await exit.toSignIn();

      return true;
    }

    return failure === WriteFailure.FORBIDDEN && (await exit.toWelcomeIfOwed());
  } catch {
    return false;
  } finally {
    leavingForSession = false;
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
    // Reconciling, not yet uncertain: Retry belongs to the settled state, or a person could queue one behind the read
    states.value[section] = { ...states.value[section], phase: SettingsSectionPhase.RECONCILING };

    await reconcile(section, request);

    return;
  }

  states.value[section] = {
    ...states.value[section],
    alert: toRefusalAlert(failure),
    message: readRefusalMessage(error),
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
 * Sends a save that waited behind another section's, once that one has settled.
 *
 * The wait is where a section can stop being savable: another section's answer can leave this one with a comparison
 * to show first, and the held body is dropped rather than pushed through it. A revision that moved with this
 * section's own values unchanged is adopted instead, which is the same rule its baseline already followed, so waiting
 * behind another save never turns an ordinary save into a conflict
 * @internal
 * @function
 * @param section - The section
 * @param request - The body it queued
 */
async function dispatchQueuedSave(section: SettingsSection, request: ISaveSettingsRequest): Promise<void> {
  const state: ISectionState = states.value[section];

  if (state.phase === SettingsSectionPhase.STALE) {
    return;
  }

  await send(section, { ...request, revision: state.revision });
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

  // Locked the moment it is queued, not when it is sent: a section left editable behind another section's save could
  // be edited or cancelled while its own body was already committed to, and the cancelled values would still commit
  states.value[section] = {
    ...states.value[section],
    alert: null,
    confirmed: false,
    errors: {},
    message: null,
    phase: SettingsSectionPhase.SAVING,
  };

  // Serialized rather than concurrent: a second Save waits for the first to settle
  queue = queue.then((): Promise<void> => dispatchQueuedSave(section, built.value));
}

/**
 * Sends a retry that waited behind another section's request, unless that request settled this one first.
 *
 * A retry is the one write the page may repeat, so what it is allowed to repeat is checked again here rather than at
 * the click: while it waited, another section's answer can have resolved this one outright, or moved the revision it
 * was submitted at. The held body is never sent at a revision it was not reviewed against, and never re-sent into a
 * section that has already settled (page spec 2.4, Saving)
 * @internal
 * @function
 * @param section - The section
 * @param request - The body it held
 */
async function dispatchQueuedRetry(section: SettingsSection, request: ISaveSettingsRequest): Promise<void> {
  const state: ISectionState = states.value[section];

  // Anything other than the phase the click left behind means something else settled this section while it waited
  if (state.phase !== SettingsSectionPhase.SAVING) {
    return;
  }

  // The revision moved under the retry. It cannot go out at the revision it was submitted at, which no longer exists,
  // and must not be quietly upgraded, which is how a delayed first write and its retry would both commit: read again
  if (state.revision !== request.revision) {
    states.value[section] = { ...state, phase: SettingsSectionPhase.RECONCILING };

    await reconcile(section, request);

    return;
  }

  await send(section, request);
}

/**
 * Reads the league again for a check that waited behind another section's request, unless that request settled it.
 * @internal
 * @function
 * @param section - The section
 * @param request - The body it held
 */
async function dispatchQueuedCheck(section: SettingsSection, request: ISaveSettingsRequest): Promise<void> {
  if (states.value[section].phase !== SettingsSectionPhase.RECONCILING) {
    return;
  }

  await reconcile(section, request);
}

/**
 * Sends the held snapshot again, at the revision it carried the first time.
 *
 * Disarmed where it is pressed rather than where it is sent: the phase moves before the queue is touched, so the
 * button is gone for the whole wait and a second press cannot append a second write behind the first
 * @internal
 * @function
 * @param section - The section
 */
function onRetry(section: SettingsSection): void {
  const request: ISaveSettingsRequest | undefined = submitted.value[section];

  if (request === undefined || states.value[section].phase !== SettingsSectionPhase.UNCERTAIN) {
    return;
  }

  states.value[section] = { ...states.value[section], phase: SettingsSectionPhase.SAVING };
  queue = queue.then((): Promise<void> => dispatchQueuedRetry(section, request));
}

/**
 * Reads the league again after a reconciliation that could not be made.
 * @internal
 * @function
 * @param section - The section
 */
function onRetryCheck(section: SettingsSection): void {
  const request: ISaveSettingsRequest | undefined = submitted.value[section];

  if (request === undefined || states.value[section].phase !== SettingsSectionPhase.RECONCILE_FAILED) {
    return;
  }

  states.value[section] = { ...states.value[section], phase: SettingsSectionPhase.RECONCILING };
  queue = queue.then((): Promise<void> => dispatchQueuedCheck(section, request));
}

/**
 * Discards a stale section's draft and takes the values shown beside it.
 * @internal
 * @function
 * @param section - The section
 */
function onUseCurrent(section: SettingsSection): void {
  const current: ISettingsComparison | undefined = staleAgainst.value[section];

  if (current === undefined) {
    return;
  }

  draft.value = { ...draft.value, [section]: detach(current.draft[section]) };
  loaded.value = { ...loaded.value, [section]: detach(current.draft[section]) };
  quieten(section);

  // The revision of the values that were shown, not whatever another section's conflict has moved the page on to
  states.value[section] = {
    ...states.value[section],
    phase: SettingsSectionPhase.IDLE,
    revision: current.revision,
  };
}

/**
 * Keeps a stale section's draft, against the values now shown, at the revision they came back at.
 * @internal
 * @function
 * @param section - The section
 */
function onReviewDraft(section: SettingsSection): void {
  const current: ISettingsComparison | undefined = staleAgainst.value[section];

  if (current === undefined) {
    return;
  }

  // The draft stays exactly as it is; only what it is compared against, and the revision its Save carries, move — and
  // both come from the comparison that was actually shown, so a save cannot pass a revision it was never reviewed at
  loaded.value = { ...loaded.value, [section]: detach(current.draft[section]) };
  quieten(section);
  states.value[section] = {
    ...states.value[section],
    phase: SettingsSectionPhase.IDLE,
    revision: current.revision,
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
  departureOrigin = null;

  if (destination !== null) {
    loaded.value = detach(draft.value);

    await navigateTo(destination);
  }
}

/**
 * Closes the departure question, leaving the draft and the page exactly as they were.
 * @internal
 * @function
 */
function onStay(): void {
  const origin: HTMLElement | null = departureOrigin;

  pendingDeparture.value = null;
  departureOrigin = null;

  // Focus goes back where the departure was attempted from, rather than to the top of the document
  void nextTick((): void => origin?.focus());
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// Asked once, in the page rather than through the browser's own dialog, and only when something is unsaved. An
// unanswered question is not permission: a second attempt while it stands is refused too, and only Leave departs
onBeforeRouteLeave((to: RouteLocationNormalized): boolean => {
  if (leavingForSession || !anyDirty.value) {
    return true;
  }

  if (pendingDeparture.value === null) {
    departureOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pendingDeparture.value = to.fullPath;

    // The question is the page's own dialog, so focus moves into it on the safe answer
    void nextTick((): void => stayButton.value?.focus());
  }

  return false;
});
</script>

<template>
  <div class="space-y-6">
    <!-- Identity -->
    <WidgetsLeaguesSettingsSection
      :current-rows="
        toSectionRows(SettingsSection.IDENTITY, staleAgainst[SettingsSection.IDENTITY]?.draft ?? draft, revealed, {})
      "
      :dirty="dirty[SettingsSection.IDENTITY]"
      :editable="editable[SettingsSection.IDENTITY]"
      :heading="SETTINGS_SECTION_HEADINGS[SettingsSection.IDENTITY]"
      :read-only-caption="SETTINGS_SECTION_READ_ONLY_CAPTIONS[SettingsSection.IDENTITY]"
      :rows="toSectionRows(SettingsSection.IDENTITY, draft, revealed, rowMessagesFor(SettingsSection.IDENTITY))"
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
      :current-rows="
        toSectionRows(SettingsSection.FORMATS, staleAgainst[SettingsSection.FORMATS]?.draft ?? draft, revealed, {})
      "
      :dirty="dirty[SettingsSection.FORMATS]"
      :editable="editable[SettingsSection.FORMATS]"
      :heading="SETTINGS_SECTION_HEADINGS[SettingsSection.FORMATS]"
      :read-only-caption="SETTINGS_SECTION_READ_ONLY_CAPTIONS[SettingsSection.FORMATS]"
      :rows="toSectionRows(SettingsSection.FORMATS, draft, revealed, rowMessagesFor(SettingsSection.FORMATS))"
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
        <!-- The refusal names the group rather than a checkbox, so the group is what takes focus; never tabbed to -->
        <fieldset
          id="setting-allowedGameTypes"
          :aria-describedby="
            messageFor(SettingsSection.FORMATS, 'allowedGameTypes') ? 'setting-allowedGameTypes-message' : undefined
          "
          tabindex="-1"
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

        <!-- Text rather than a number input: Vue casts a number input's model for you, which would both break the draft
             the shared validator reads as typed and quietly turn a typed 1,440 into 1 instead of refusing it -->
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
              type="text"
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
                type="text"
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
              type="text"
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
              type="text"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.walkoverGracePeriod }}</span>
          </div>
        </WidgetsLeaguesSettingsField>
      </div>
    </WidgetsLeaguesSettingsSection>

    <!-- Results -->
    <WidgetsLeaguesSettingsSection
      :current-rows="
        toSectionRows(SettingsSection.RESULTS, staleAgainst[SettingsSection.RESULTS]?.draft ?? draft, revealed, {})
      "
      :dirty="dirty[SettingsSection.RESULTS]"
      :editable="editable[SettingsSection.RESULTS]"
      :heading="SETTINGS_SECTION_HEADINGS[SettingsSection.RESULTS]"
      :read-only-caption="SETTINGS_SECTION_READ_ONLY_CAPTIONS[SettingsSection.RESULTS]"
      :rows="toSectionRows(SettingsSection.RESULTS, draft, revealed, rowMessagesFor(SettingsSection.RESULTS))"
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
              type="text"
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
              type="text"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.resultAmendmentWindow }}</span>
          </div>
        </WidgetsLeaguesSettingsField>
      </div>
    </WidgetsLeaguesSettingsSection>

    <!-- Ratings -->
    <WidgetsLeaguesSettingsSection
      :current-rows="
        toSectionRows(SettingsSection.RATINGS, staleAgainst[SettingsSection.RATINGS]?.draft ?? draft, revealed, {})
      "
      :dirty="dirty[SettingsSection.RATINGS]"
      :editable="editable[SettingsSection.RATINGS]"
      :heading="SETTINGS_SECTION_HEADINGS[SettingsSection.RATINGS]"
      :read-only-caption="SETTINGS_SECTION_READ_ONLY_CAPTIONS[SettingsSection.RATINGS]"
      :rows="toSectionRows(SettingsSection.RATINGS, draft, revealed, rowMessagesFor(SettingsSection.RATINGS))"
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

          <p
            v-if="ratingsCaption !== null"
            class="text-ink-subtle text-caption mt-2"
          >
            {{ ratingsCaption }}
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
              type="text"
            />

            <span class="text-ink-muted text-body-sm">{{ SETTINGS_FIELD_UNITS.provisionalGames }}</span>
          </div>
        </WidgetsLeaguesSettingsField>
      </div>
    </WidgetsLeaguesSettingsSection>

    <!-- Asked once, in the page, when a departure would take unsaved changes with it. Two answers and two tab stops,
         so the cycle between them is the containment; Escape is Stay, the answer that changes nothing -->
    <div
      v-if="pendingDeparture !== null"
      aria-labelledby="settings-leave-prompt"
      aria-modal="true"
      class="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      @keydown.esc="onStay()"
    >
      <div class="border-border bg-surface w-full max-w-sm rounded-lg border p-6">
        <p
          id="settings-leave-prompt"
          class="text-ink text-body font-medium"
        >
          {{ SETTINGS_LEAVE_PROMPT }}
        </p>

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            ref="leaveButton"
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-5 py-2.5 font-medium transition-colors"
            type="button"
            @click="onLeave()"
            @keydown.shift.tab.prevent="stayButton?.focus()"
          >
            Leave
          </button>

          <button
            ref="stayButton"
            class="border-border text-ink hover:border-accent text-body-sm rounded-md border px-5 py-2.5 font-medium transition-colors"
            type="button"
            @click="onStay()"
            @keydown.exact.tab.prevent="leaveButton?.focus()"
          >
            Stay
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
