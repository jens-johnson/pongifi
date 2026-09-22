<script setup lang="ts">
/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import type { IResultFormContext, IResultSubmission, Seat as TSeat } from '#shared/results';
import { ResultEnding, seatsForGameType } from '#shared/results';
import type { IMatchSettings } from '#shared/rules-engine';
import { GameType } from '#shared/rules-engine';
import { SETTINGS_LEAVE_PROMPT } from '~/utils/leagues/settings';
import { classifyWriteFailure, WriteFailure } from '~/utils/leagues/write-failure';
import type {
  IRecordDraft,
  IRecordProblems,
  IRecordRecorder,
  IRecordRow,
  IRecordSeat,
  IRecordSideNames,
} from '~/utils/results/record';
import {
  findRecordProblems,
  fromDateTimeLocal,
  MAX_GUEST_NAME,
  readScore,
  rowsToShow,
  toDateTimeLocal,
  toDerivedLine,
} from '~/utils/results/record';

import {
  PLAYED_AT_MESSAGE,
  RECORD_CHECK_LABEL,
  RECORD_EXISTING_LINK,
  RECORD_REFUSED_MESSAGE,
  RECORD_SAVE_LABEL,
  RECORD_SAVING_LABEL,
  RECORD_UNCERTAIN_MESSAGE,
} from './constants';
import type {
  IRecordDuplicate,
  IRecordedAnswer,
  IRecordExisting,
  IRecordFailure,
  IRecordRequestBody,
  IResultsRecordFormEmits,
  IResultsRecordFormProps,
} from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The league's rules, the league itself, and who is recording
 * @internal
 * @constant
 */
const props: Readonly<IResultsRecordFormProps> = defineProps<IResultsRecordFormProps>();

/**
 * Raised once a result exists, so the page can go to it
 * @internal
 * @constant
 */
const emit = defineEmits<IResultsRecordFormEmits>();

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The league's rules as the form read them.
 *
 * Held rather than read through the prop, because a stale-rules refusal replaces them with what the league says now
 * and the caption has to redraw to those
 * @internal
 * @constant
 */
const rules: Ref<IResultFormContext> = ref<IResultFormContext>({ ...props.context });

/**
 * Which format is being recorded
 * @internal
 * @constant
 */
const gameType: Ref<GameType> = ref<GameType>(props.context.formats[0] ?? GameType.SINGLES);

/**
 * The seats, the scores, the ending and the play time
 * @internal
 * @constant
 */
const draft: Ref<IRecordDraft> = ref<IRecordDraft>({
  ending: 'COMPLETED',
  gamesPlayed: 1,
  gameType: gameType.value,
  // The database's clock, never the device's: a browser five minutes fast would offer a play time its own server
  // refuses as the future. Rendered for a local input, which takes wall-clock time and no zone
  playedAt: toDateTimeLocal(props.context.now),
  retiredSeat: null,
  rows: [],
  seats: [],
});

/**
 * The operation this save belongs to, from the first attempt until an outcome is known
 * @internal
 * @constant
 */
const operationId: Ref<string> = ref<string>(crypto.randomUUID());

/**
 * The token a duplicate warning issued, sent back to record anyway
 * @internal
 * @constant
 */
const acknowledgement: Ref<string | null> = ref<string | null>(null);

/**
 * The matches this entry was warned about looking like
 * @internal
 * @constant
 */
const candidates: Ref<IRecordDuplicate[]> = ref<IRecordDuplicate[]>([]);

/**
 * The result this operation id already wrote, when a refusal named one
 * @internal
 * @constant
 */
const existing: Ref<IRecordExisting | null> = ref<IRecordExisting | null>(null);

/**
 * What the server said, shown above Save without clearing the draft
 * @internal
 * @constant
 */
const serverMessage: Ref<string | null> = ref<string | null>(null);

/**
 * Whether a save is in flight
 * @internal
 * @constant
 */
const saving: Ref<boolean> = ref<boolean>(false);

/**
 * The body a save sent, held from the press until its outcome is known.
 *
 * Held whole rather than by its operation id alone: creation is keyed on a digest of the body, so a check has to
 * re-send what the first attempt sent. Cleared the moment the server answers either way, because the next press is
 * then a fresh save of whatever the form is showing — a draft edited after a duplicate warning must go as edited
 * @internal
 * @constant
 */
const held: Ref<IRecordRequestBody | null> = ref<IRecordRequestBody | null>(null);

/**
 * Whether a save may or may not have been recorded.
 *
 * A distinct answer from refused, and the only one the page cannot resolve by itself: the write may have committed
 * before its answer was lost, so the page holds the request and offers Check rather than inviting a second entry
 * @internal
 * @constant
 */
const uncertain: Ref<boolean> = ref<boolean>(false);

/**
 * The route a confirmed departure resumes, held while the page asks about the draft it would lose
 * @internal
 * @constant
 */
const pendingDeparture: Ref<string | null> = ref<string | null>(null);

/**
 * What had focus when the departure question was asked, so answering Stay gives it back
 * @internal
 * @constant
 */
let departureOrigin: HTMLElement | null = null;

/**
 * Whether the page is leaving because Leave was answered.
 *
 * The draft is still dirty at that moment, so the guard would otherwise ask the same question about the answer it
 * was just given and the departure would never resolve
 * @internal
 * @constant
 */
let departing: boolean = false;

/**
 * The departure question's safe answer, which takes focus while the question stands
 * @internal
 * @constant
 */
const stayButton: Ref<HTMLButtonElement | null> = ref<HTMLButtonElement | null>(null);

/**
 * The departure question's other answer, which Tab cycles back to
 * @internal
 * @constant
 */
const leaveButton: Ref<HTMLButtonElement | null> = ref<HTMLButtonElement | null>(null);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The scoring rules this entry is judged by, in the shape the engine takes
 * @internal
 * @constant
 */
const settings: ComputedRef<IMatchSettings> = computed((): IMatchSettings => ({
  cutthroatTimeCap: 0,
  expediteEnabled: false,
  gameType: gameType.value,
  matchFormat: rules.value.rules.matchFormat,
  serviceInterval: 2,
  targetScore: rules.value.rules.targetScore[gameType.value] ?? 11,
  winningMargin: rules.value.rules.winningMargin,
}));

/**
 * Who is recording, as the form's checks need to know them
 * @internal
 * @constant
 */
const recorder: ComputedRef<IRecordRecorder> = computed((): IRecordRecorder => ({
  mustPlay: rules.value.authority.mustPlay,
  nameOf: (userId: string): string =>
    rules.value.roster.find((member): boolean => member.id === userId)?.displayName ?? 'That player',
  userId: props.recorderId,
}));

/**
 * How many rows belong on screen
 * @internal
 * @constant
 */
const shown: ComputedRef<number> = computed((): number => rowsToShow(settings.value, draft.value));

/**
 * The rows the form is showing
 * @internal
 * @constant
 */
const visibleRows: ComputedRef<IRecordRow[]> = computed((): IRecordRow[] => draft.value.rows.slice(0, shown.value));

/**
 * What to call each side, for the line under the rows
 * @internal
 * @constant
 */
const sideNames: ComputedRef<IRecordSideNames> = computed((): IRecordSideNames => {
  const name = (seat: IRecordSeat): string =>
    seat.userId === null
      ? (seat.guestName?.trim() ?? '')
      : (rules.value.roster.find((member): boolean => member.id === seat.userId)?.displayName ?? '');
  const of = (side: 'A' | 'B'): string =>
    draft.value.seats
      .filter((seat): boolean => String(seat.seat).startsWith(side))
      .map(name)
      .filter((value): boolean => value.length > 0)
      .join(' and ');

  return { a: of('A') || 'Side A', b: of('B') || 'Side B' };
});

/**
 * The line under the rows
 * @internal
 * @constant
 */
const derivedLine: ComputedRef<string> = computed((): string =>
  toDerivedLine(settings.value, draft.value, sideNames.value),
);

/**
 * Everything the form is refusing, addressed to where it is shown
 * @internal
 * @constant
 */
const problems: ComputedRef<IRecordProblems> = computed((): IRecordProblems => {
  const found: IRecordProblems = findRecordProblems(settings.value, draft.value, recorder.value);
  const chosen: string | null = fromDateTimeLocal(draft.value.playedAt);
  const at: number = chosen === null ? Number.NaN : Date.parse(chosen);
  const earliest: number = Date.parse(rules.value.earliest);
  const latest: number = Date.parse(rules.value.now);

  // The client bound surfaces the message early and can never refuse the instant the server itself issued; the
  // server validates every submitted time strictly and is the one that counts
  const outside: boolean = Number.isNaN(at) || at < earliest || at > latest;

  return {
    ...found,
    playedAt: outside && chosen !== rules.value.now ? PLAYED_AT_MESSAGE(rules.value) : null,
  };
});

/**
 * Whether the form has any message showing at all
 * @internal
 * @constant
 */
const hasProblem: ComputedRef<boolean> = computed(
  (): boolean =>
    problems.value.match !== null ||
    problems.value.playedAt !== null ||
    Object.keys(problems.value.rows).length > 0 ||
    Object.keys(problems.value.seats).length > 0,
);

/**
 * What the Save button reads.
 *
 * Three states on one button rather than a second control beside it: Check is the same request under the same
 * operation id, which is exactly what makes pressing it safe
 * @internal
 * @constant
 */
const saveLabel: ComputedRef<string> = computed((): string => {
  if (saving.value) {
    return RECORD_SAVING_LABEL;
  }

  return uncertain.value ? RECORD_CHECK_LABEL : RECORD_SAVE_LABEL;
});

/**
 * Whether the Save button is unavailable.
 *
 * Save is single-shot, so it is disabled while it is in flight. A Check is not gated on the form's own messages:
 * it re-sends a body that was already accepted by these checks, and an unresolved save has to stay resolvable
 * however the draft has been edited since
 * @internal
 * @constant
 */
const saveBlocked: ComputedRef<boolean> = computed(
  (): boolean => saving.value || (!uncertain.value && hasProblem.value),
);

/**
 * Whether anything has been entered, so leaving would lose work
 * @internal
 * @constant
 */
const dirty: ComputedRef<boolean> = computed(
  (): boolean =>
    draft.value.rows.some((row): boolean => row.a.trim().length > 0 || row.b.trim().length > 0) ||
    draft.value.seats.some((seat, index): boolean => {
      // The recorder's own seat is pre-filled, so it is not work anybody would mind losing
      const preseated: boolean = index === 0 && seat.userId === props.recorderId;

      return !preseated && (seat.userId !== null || (seat.guestName ?? '').trim().length > 0);
    }),
);

/* ─── Methods ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Lays the seats out for a format, pre-seating the recorder in the first of them
 * @internal
 * @function
 * @param format - The format
 * @returns The seats
 */
function seatsFor(format: GameType): IRecordSeat[] {
  return seatsForGameType(format).map((seat: TSeat, index: number): IRecordSeat => ({
    guestName: null,
    seat,
    userId: index === 0 ? props.recorderId : null,
  }));
}

/**
 * Starts the form, or re-starts it for a different format.
 *
 * Switching format clears the seats and keeps the scores: the games were played whatever the form says about who
 * played them
 * @internal
 * @function
 * @param format - The format to lay out
 */
function layOut(format: GameType): void {
  const keep: IRecordRow[] = draft.value.rows;

  gameType.value = format;
  draft.value = {
    ...draft.value,
    gameType: format,
    retiredSeat: null,
    rows: keep.length > 0 ? keep : [],
    seats: seatsFor(format),
  };

  growRows();
}

/**
 * Makes sure the draft holds at least as many rows as the form is showing
 * @internal
 * @function
 */
function growRows(): void {
  const needed: number = rowsToShow(settings.value, draft.value);

  while (draft.value.rows.length < needed) {
    draft.value.rows.push({ a: '', b: '' });
  }
}

/**
 * Turns a seat into a guest seat, or back into a member seat
 * @internal
 * @function
 * @param seat - Which seat
 * @param guest - Whether it should hold a guest
 */
function setGuest(seat: TSeat, guest: boolean): void {
  const found: IRecordSeat | undefined = draft.value.seats.find((one): boolean => one.seat === seat);

  if (found) {
    found.guestName = guest ? '' : null;
    found.userId = null;
  }
}

/**
 * Builds the submission from the draft, over the rows the form is actually showing
 * @internal
 * @function
 * @returns The submission
 */
function toSubmission(): IResultSubmission {
  return {
    ending: draft.value.ending === 'RETIRED' ? ResultEnding.RETIRED : ResultEnding.COMPLETED,
    gameType: gameType.value,
    games: visibleRows.value.map((row, index) => {
      const a = readScore(row.a);
      const b = readScore(row.b);

      return {
        a: 'score' in a ? a.score : 0,
        b: 'score' in b ? b.score : 0,
        gameNumber: index + 1,
      };
    }),
    // The instant the form was initialized with, unchanged by how long the draft sat open
    playedAt: fromDateTimeLocal(draft.value.playedAt) ?? props.context.now,
    retiredSeat: draft.value.ending === 'RETIRED' ? draft.value.retiredSeat : null,
    seats: draft.value.seats.map((seat) => ({
      guestName: seat.userId === null ? (seat.guestName?.trim() ?? '') : null,
      seat: seat.seat,
      userId: seat.userId,
    })),
  };
}

/**
 * Saves the result, or checks on one whose outcome is unknown, and reads whatever the server answers back onto the
 * form.
 *
 * A refusal never clears the draft. A duplicate warning is answered by pressing Save again, which sends the token
 * the warning issued; a rules change redraws the caption to what the league says now; an answer that never arrived
 * is re-sent unchanged rather than rebuilt, so the server answers it from the first attempt's receipt
 * @internal
 * @async
 * @function
 */
async function save(): Promise<void> {
  // A check re-sends the body the first attempt sent, never one rebuilt from what the form is showing now: the same
  // operation id carrying a different body is a conflict, and the save being checked on would stay unresolved
  const body: IRecordRequestBody = held.value ?? {
    acknowledgement: acknowledgement.value,
    clientOperationId: operationId.value,
    expectedLeagueRevision: rules.value.configurationRevision,
    submission: toSubmission(),
  };

  held.value = body;
  saving.value = true;
  serverMessage.value = null;

  try {
    const answer: IRecordedAnswer = await $fetch<IRecordedAnswer>(`/api/leagues/${props.leagueId}/games`, {
      body,
      method: 'POST',
    });

    held.value = null;
    uncertain.value = false;
    candidates.value = [];
    existing.value = null;
    acknowledgement.value = null;
    emit('recorded', answer.current.canonicalMatchId);
  } catch (failure: unknown) {
    if (classifyWriteFailure(failure) === WriteFailure.UNCERTAIN) {
      // No answer at all, or the server itself failed: either may have committed. Calling that a failure is how a
      // second identical result gets entered, so the request and its operation id are kept and Check re-sends them
      uncertain.value = true;
      serverMessage.value = RECORD_UNCERTAIN_MESSAGE;

      return;
    }

    const data: Record<string, unknown> = (failure as IRecordFailure).data ?? {};

    // Answered, so nothing is outstanding: the next press is a fresh save of whatever the form is showing by then
    held.value = null;
    uncertain.value = false;

    if (typeof data.acknowledgement === 'string') {
      // Shown what was found, and records anyway if they mean to: two identical honest matches in one evening are
      // possible, and this is what keeps them possible
      acknowledgement.value = data.acknowledgement;
      candidates.value = (data.candidates as IRecordDuplicate[]) ?? [];
    }

    // Named only when the refusal named it. The message tells the person to open the result that exists, so without
    // the link it points at nothing they can reach
    existing.value = data.existing ? (data.existing as IRecordExisting) : null;

    if (data.context) {
      // The league moved under the form; the caption redraws to the rules the entry will now be judged by
      rules.value = data.context as IResultFormContext;
    }

    serverMessage.value = typeof data.message === 'string' ? data.message : RECORD_REFUSED_MESSAGE;
  } finally {
    saving.value = false;
  }
}

/**
 * Leaves the page, having asked once.
 *
 * The departure is marked before it is started, because the guard is about to see it: the draft is still dirty, and
 * without the mark the page would ask the same question about the answer it was just given
 * @internal
 * @async
 * @function
 */
async function onLeave(): Promise<void> {
  const destination: string | null = pendingDeparture.value;

  pendingDeparture.value = null;
  departureOrigin = null;

  if (destination !== null) {
    departing = true;

    await navigateTo(destination);
  }
}

/**
 * Closes the departure question, leaving the draft and the page exactly as they were
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

layOut(gameType.value);

watch([shown, settings], (): void => growRows());

// The settings editor's rule, in the page rather than in a browser dialog: a form with work in it asks before it is
// left, and a session that has ended is not a question anybody can usefully answer. An unanswered question is not
// permission either — a second attempt while it stands is refused too, and only Leave departs
onBeforeRouteLeave((to): boolean => {
  if (departing || !dirty.value || to.path.startsWith(SIGN_IN_ROUTE)) {
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
  <form
    class="max-w-[560px]"
    @submit.prevent="save()"
  >
    <p
      class="text-ink-subtle text-body-sm"
      data-test="caption"
    >
      {{ rules.leagueName }} · Best of {{ settings.matchFormat }} · Games to {{ settings.targetScore }}, win by
      {{ settings.winningMargin }}
    </p>

    <!-- A league that records one format states it rather than offering a choice of one -->
    <fieldset
      v-if="rules.formats.length > 1"
      class="mt-8"
    >
      <legend class="text-body font-medium">Format</legend>

      <label
        v-for="format in rules.formats"
        :key="format"
        class="text-body mr-4 inline-flex items-center gap-2"
      >
        <input
          :checked="gameType === format"
          :data-test="`format-${format}`"
          name="format"
          type="radio"
          @change="layOut(format)"
        />
        {{ format === GameType.DOUBLES ? 'Doubles' : 'Singles' }}
      </label>
    </fieldset>

    <p
      v-else
      class="text-body mt-8"
      data-test="format-fixed"
    >
      {{ gameType === GameType.DOUBLES ? 'Doubles' : 'Singles' }}
    </p>

    <fieldset
      v-for="side in ['A', 'B']"
      :key="side"
      class="mt-8"
    >
      <legend class="text-body font-medium">Side {{ side }}</legend>

      <div
        v-for="seat in draft.seats.filter((one) => String(one.seat).startsWith(side))"
        :key="seat.seat"
        class="mt-2"
      >
        <select
          v-if="seat.guestName === null"
          v-model="seat.userId"
          class="border-border bg-surface text-body w-full rounded-lg border p-2"
          :data-test="`seat-${seat.seat}`"
          @change="
            (event) => ((event.target as HTMLSelectElement).value === 'GUEST' ? setGuest(seat.seat, true) : undefined)
          "
        >
          <option :value="null">Pick a member</option>

          <option
            v-for="member in rules.roster"
            :key="member.id"
            :value="member.id"
          >
            {{ member.displayName }}
          </option>

          <option value="GUEST">Add a guest</option>
        </select>

        <div
          v-else
          class="flex gap-2"
        >
          <!-- Named as well as prompted: a placeholder is the only label this field had, and it goes away the
               moment somebody starts typing into it -->
          <input
            v-model="seat.guestName"
            aria-label="Guest name"
            class="border-border bg-surface text-body w-full rounded-lg border p-2"
            :data-test="`guest-${seat.seat}`"
            inputmode="text"
            :maxlength="MAX_GUEST_NAME"
            placeholder="Guest name"
            type="text"
          />

          <button
            class="text-ink-subtle hover:text-ink text-body-sm"
            type="button"
            @click="setGuest(seat.seat, false)"
          >
            Cancel
          </button>
        </div>

        <p
          v-if="problems.seats[seat.seat]"
          class="text-body-sm mt-1"
          :data-test="`seat-problem-${seat.seat}`"
          role="alert"
        >
          {{ problems.seats[seat.seat] }}
        </p>
      </div>
    </fieldset>

    <fieldset class="mt-8">
      <legend class="text-body font-medium">Scores</legend>

      <!-- Which box is which side, said once above the rows rather than repeated on every one. Each input carries
           the same pairing as its own accessible name, because a column head is a sighted reading of the layout -->
      <div
        class="text-ink-subtle text-body-sm mt-2 flex items-center gap-2"
        data-test="score-heads"
      >
        <span class="w-16"></span>

        <span class="w-16">Side A</span>

        <span class="w-16">Side B</span>
      </div>

      <div
        v-for="(row, index) in visibleRows"
        :key="index"
        class="mt-2"
      >
        <div class="text-body flex items-center gap-2">
          <span class="text-ink-subtle text-body-sm w-16">Game {{ index + 1 }}</span>

          <!-- Text with a numeric keypad, not type="number": Vue 3.5 casts a number input and a half-typed box
               would stop being the string it is -->
          <input
            v-model="row.a"
            :aria-label="`Game ${index + 1}, Side A`"
            class="border-border bg-surface text-body w-16 rounded-lg border p-2"
            :data-test="`score-a-${index}`"
            inputmode="numeric"
            type="text"
          />

          <input
            v-model="row.b"
            :aria-label="`Game ${index + 1}, Side B`"
            class="border-border bg-surface text-body w-16 rounded-lg border p-2"
            :data-test="`score-b-${index}`"
            inputmode="numeric"
            type="text"
          />
        </div>

        <p
          v-if="problems.rows[index]"
          class="text-body-sm mt-1"
          :data-test="`row-problem-${index}`"
          role="alert"
        >
          {{ problems.rows[index] }}
        </p>
      </div>

      <p
        class="text-ink-subtle text-body mt-3"
        data-test="derived-line"
      >
        {{ derivedLine }}
      </p>
    </fieldset>

    <fieldset class="mt-8">
      <legend class="text-body font-medium">How it ended</legend>

      <label class="text-body mr-4 inline-flex items-center gap-2">
        <input
          v-model="draft.ending"
          data-test="ending-completed"
          name="ending"
          type="radio"
          value="COMPLETED"
        />
        Played to a finish
      </label>

      <label class="text-body inline-flex items-center gap-2">
        <input
          v-model="draft.ending"
          data-test="ending-retired"
          name="ending"
          type="radio"
          value="RETIRED"
        />
        One side retired
      </label>

      <div
        v-if="draft.ending === 'RETIRED'"
        class="mt-3"
      >
        <label class="text-body block">
          <span class="text-ink-subtle text-body-sm">Who retired</span>

          <select
            v-model="draft.retiredSeat"
            class="border-border bg-surface text-body mt-1 block w-full rounded-lg border p-2"
            data-test="retired-seat"
          >
            <option :value="null">Pick a player</option>

            <option
              v-for="seat in draft.seats"
              :key="seat.seat"
              :value="seat.seat"
            >
              {{ seat.userId ? recorder.nameOf(seat.userId) : seat.guestName }}
            </option>
          </select>
        </label>

        <label class="text-body mt-3 block">
          <span class="text-ink-subtle text-body-sm">Games played</span>

          <input
            v-model.number="draft.gamesPlayed"
            class="border-border bg-surface text-body mt-1 block w-20 rounded-lg border p-2"
            data-test="games-played"
            :max="settings.matchFormat"
            min="1"
            type="number"
          />
        </label>

        <p class="text-ink-subtle text-body-sm mt-2">
          The score entered for the last game is the score at the moment of withdrawal.
        </p>
      </div>
    </fieldset>

    <label class="text-body mt-8 block">
      <span class="text-ink-subtle text-body-sm">When it was played</span>

      <input
        v-model="draft.playedAt"
        class="border-border bg-surface text-body mt-1 block w-full rounded-lg border p-2"
        data-test="played-at"
        type="datetime-local"
      />
    </label>

    <p
      v-if="problems.playedAt"
      class="text-body-sm mt-1"
      data-test="played-at-problem"
      role="alert"
    >
      {{ problems.playedAt }}
    </p>

    <p
      v-if="problems.match"
      class="text-body mt-8"
      data-test="match-problem"
      role="alert"
    >
      {{ problems.match }}
    </p>

    <p
      v-if="serverMessage"
      class="text-body mt-4"
      data-test="server-message"
      role="alert"
    >
      {{ serverMessage }}
    </p>

    <ul
      v-if="candidates.length > 0"
      class="text-body-sm mt-2"
      data-test="duplicates"
    >
      <li
        v-for="candidate in candidates"
        :key="candidate.canonicalMatchId"
      >
        <NuxtLink
          class="text-accent-strong hover:text-accent font-medium"
          :to="`/leagues/${leagueId}/games/${candidate.canonicalMatchId}`"
        >
          A result already recorded
        </NuxtLink>
      </li>
    </ul>

    <p
      v-if="existing"
      class="text-body-sm mt-2"
      data-test="existing"
    >
      <NuxtLink
        class="text-accent-strong hover:text-accent font-medium"
        :to="`/leagues/${leagueId}/games/${existing.canonicalMatchId}`"
      >
        {{ RECORD_EXISTING_LINK }}
      </NuxtLink>
    </p>

    <div class="mt-8 flex gap-3">
      <button
        class="bg-accent-strong text-body rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
        data-test="save"
        :disabled="saveBlocked"
        type="submit"
      >
        {{ saveLabel }}
      </button>

      <NuxtLink
        class="text-body text-ink-subtle hover:text-ink px-4 py-2 font-medium"
        data-test="cancel"
        :to="`/leagues/${leagueId}`"
      >
        Cancel
      </NuxtLink>
    </div>

    <!-- Asked once, in the page, when a departure would take unsaved changes with it. The settings editor's dialog,
         down to its words: two answers and two tab stops, so the cycle between them is the containment; Escape is
         Stay, the answer that changes nothing -->
    <div
      v-if="pendingDeparture !== null"
      aria-labelledby="record-leave-prompt"
      aria-modal="true"
      class="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-6"
      data-test="leave-dialog"
      role="dialog"
      @keydown.esc="onStay()"
    >
      <div class="border-border bg-surface w-full max-w-sm rounded-lg border p-6">
        <p
          id="record-leave-prompt"
          class="text-ink text-body font-medium"
        >
          {{ SETTINGS_LEAVE_PROMPT }}
        </p>

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            ref="leaveButton"
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-5 py-2.5 font-medium transition-colors"
            data-test="leave-confirm"
            type="button"
            @click="onLeave()"
            @keydown.shift.tab.prevent="stayButton?.focus()"
          >
            Leave
          </button>

          <button
            ref="stayButton"
            class="border-border text-ink hover:border-accent text-body-sm rounded-md border px-5 py-2.5 font-medium transition-colors"
            data-test="leave-cancel"
            type="button"
            @click="onStay()"
            @keydown.exact.tab.prevent="leaveButton?.focus()"
          >
            Stay
          </button>
        </div>
      </div>
    </div>
  </form>
</template>
