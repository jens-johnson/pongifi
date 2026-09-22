<script setup lang="ts">
/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';

import type {
  IGameScoreRow,
  IResultAmendment,
  IResultFormContext,
  IResultSeat,
  IResultSubmission,
  Seat as TSeat,
} from '#shared/results';
import { ResultConflict, ResultEnding, seatsForGameType } from '#shared/results';
import type { IMatchSettings } from '#shared/rules-engine';
import { GameType } from '#shared/rules-engine';
import { SETTINGS_LEAVE_PROMPT } from '~/utils/leagues/settings';
import { classifyWriteFailure, readWriteStatus, WriteFailure } from '~/utils/leagues/write-failure';
import { toDisputeLine } from '~/utils/results/format';
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
  RECORD_AMEND_LABEL,
  RECORD_AMEND_SAVING_LABEL,
  RECORD_CHECK_LABEL,
  RECORD_DUPLICATE_LINK,
  RECORD_EXISTING_LINK,
  RECORD_POST_RECEIPT_STATUSES,
  RECORD_REFUSED_MESSAGE,
  RECORD_SAVE_LABEL,
  RECORD_SAVING_LABEL,
  RECORD_STILL_UNRESOLVED_MESSAGE,
  RECORD_SUPERSEDED_LINK,
  RECORD_UNCERTAIN_MESSAGE,
} from './constants';
import type {
  IRecordAttempt,
  IRecordDuplicate,
  IRecordedAnswer,
  IRecordExisting,
  IRecordFailure,
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
 * The exits taken when a write was refused about the session rather than about the result
 * @internal
 * @constant
 */
const exit: ReturnType<typeof useSessionExit> = useSessionExit();

/**
 * The operation this save belongs to, from the first attempt until an outcome is known
 * @internal
 * @constant
 */
const operationId: Ref<string> = ref<string>(crypto.randomUUID());

/**
 * Whether the server has answered the operation the form is holding.
 *
 * An answered operation cannot record anything else: the server keys a receipt to the id and a digest of the body,
 * so a later save carrying a different result under the same id is refused as a changed body for as long as the
 * page stays open. The next deliberate save is therefore a new operation, and this is what knows to start one
 * @internal
 */
let answered: boolean = false;

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
 * Whether the result this correction was opened on has moved out from under it.
 *
 * Terminal, and the only refusal on this form that is: the correction is judged against the revision the page was
 * opened at, and that revision is gone — amended or voided by another administrator, or past the window it could be
 * corrected within. A second press carrying the same expected revision is the same refusal again forever, so Save
 * stops rather than inviting one. Never set on an entry, where a conflict is something a redraw resolves
 * @internal
 * @constant
 */
const superseded: Ref<boolean> = ref<boolean>(false);

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
 * The save a check would repeat, held from the press until its outcome is known.
 *
 * Held whole rather than by its operation id alone: creation is keyed on a digest of the body, so a check has to
 * re-send what the first attempt sent, to where it sent it. Cleared the moment the server answers authoritatively,
 * because the next press is then a fresh save of whatever the form is showing — a draft edited after a duplicate
 * warning must go as edited
 * @internal
 * @constant
 */
const held: Ref<IRecordAttempt | null> = ref<IRecordAttempt | null>(null);

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
 * Whether the page is leaving on a departure it decided itself.
 *
 * Leave was answered, or the result was recorded and the page is going to it. The draft is still dirty at both of
 * those moments, so without the mark the guard would ask about work that is either being abandoned on purpose or
 * already saved — and in the first case it would ask the same question about the answer it was just given, so the
 * departure would never resolve
 * @internal
 */
let departing: boolean = false;

/**
 * Whether the page is leaving for sign-in or for the welcome step, because a write said the session had to.
 *
 * Nobody chose this departure, so it is not a draft anybody is being asked about: the question would abort the very
 * navigation the refusal requires, and an aborted push resolves rather than rejects, so the form would sit there
 * with a save it could no longer make
 * @internal
 */
let leavingForSession: boolean = false;

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
 * The result being corrected, when the form was opened to correct one.
 *
 * Read from the prop rather than from the held copy of the rules: a correction is judged against the revision the
 * page was given, and nothing the server answers back replaces it
 * @internal
 * @constant
 */
const amendment: ComputedRef<IResultAmendment | null> = computed(
  (): IResultAmendment | null => props.context.amendment,
);

/**
 * What the dispute this correction answers said, for the line above the form
 * @internal
 * @constant
 */
const disputeLine: ComputedRef<string> = computed((): string => toDisputeLine(amendment.value ?? { dispute: null }));

/**
 * Where Cancel goes: back to the result a correction was opened from, or to the league an entry was started in.
 *
 * Somebody abandoning a correction is answering a dispute they arrived from, and the result is where the other
 * resolution still is
 * @internal
 * @constant
 */
const cancelRoute: ComputedRef<string> = computed((): string =>
  amendment.value
    ? `/leagues/${props.leagueId}/games/${amendment.value.canonicalMatchId}`
    : `/leagues/${props.leagueId}`,
);

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
    playedAt: outside && chosen !== rules.value.now ? PLAYED_AT_MESSAGE(rules.value, amendment.value !== null) : null,
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
    return amendment.value ? RECORD_AMEND_SAVING_LABEL : RECORD_SAVING_LABEL;
  }

  if (uncertain.value) {
    return RECORD_CHECK_LABEL;
  }

  return amendment.value ? RECORD_AMEND_LABEL : RECORD_SAVE_LABEL;
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
  (): boolean => saving.value || superseded.value || (!uncertain.value && hasProblem.value),
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
 * Opens the form on a result that already exists, for a correction.
 *
 * Everything the revision stated, including the play time it stated: a correction starts from what was entered, so
 * the person changes the thing that was wrong and nothing else. The scores are the strings the inputs carry, as
 * every other row in this form is
 * @internal
 * @function
 * @param submission - The revision being corrected
 */
function openOn(submission: IResultSubmission): void {
  draft.value = {
    ending: submission.ending === ResultEnding.RETIRED ? 'RETIRED' : 'COMPLETED',
    gamesPlayed: submission.games.length,
    gameType: submission.gameType,
    playedAt: toDateTimeLocal(submission.playedAt),
    retiredSeat: submission.retiredSeat,
    rows: [...submission.games]
      .sort((left: IGameScoreRow, right: IGameScoreRow): number => left.gameNumber - right.gameNumber)
      .map((game: IGameScoreRow): IRecordRow => ({ a: String(game.a), b: String(game.b) })),
    seats: submission.seats.map((seat: IResultSeat): IRecordSeat => ({
      guestName: seat.guestName,
      seat: seat.seat,
      userId: seat.userId,
    })),
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
 * Reads a save that did not come back as a save onto the form.
 *
 * Three answers, and they are not the same answer. An outcome nobody can know keeps the request and offers Check.
 * A refusal about the session is not about this result at all, and the page leaves for the step that can be taken.
 * Everything else is an answer: it never clears the draft, and it settles the operation the press belonged to
 * @internal
 * @async
 * @function
 * @param failure - What `$fetch` rejected with
 */
async function settleFailure(failure: unknown): Promise<void> {
  const classified: WriteFailure = classifyWriteFailure(failure);

  if (classified === WriteFailure.UNCERTAIN) {
    // No answer at all, or the server itself failed: either may have committed. Calling that a failure is how a
    // second identical result gets entered, so the request and its operation id are kept and Check re-sends them
    uncertain.value = true;
    serverMessage.value = RECORD_UNCERTAIN_MESSAGE;

    return;
  }

  const data: Record<string, unknown> = (failure as IRecordFailure).data ?? {};
  const message: string = typeof data.message === 'string' ? data.message : RECORD_REFUSED_MESSAGE;
  const status: number | null = readWriteStatus(failure);

  // An ended session, or an account that still owes the welcome step, was not a refusal of this result at all, and
  // the page leaves for the step that can actually be taken. Everything it is holding is left exactly as it is on
  // the way out: an unresolved save stays unresolved rather than being reported as a failure it was never shown
  // to be
  if (await leftForSession(classified)) {
    return;
  }

  // A refusal decided before the server looked for the operation's receipt says nothing about the save being
  // checked on. The body's shape, the session, the origin, the membership and the write allowance are all read in
  // front of the league's lock, so a check refused by one of them establishes only that the check did not run —
  // and the earlier save, which may well have committed, stays outstanding with Check still offered
  if (uncertain.value && !(status !== null && RECORD_POST_RECEIPT_STATUSES.includes(status))) {
    serverMessage.value = `${message} ${RECORD_STILL_UNRESOLVED_MESSAGE}`;

    return;
  }

  // Answered, so nothing is outstanding: the next press is a fresh save of whatever the form is showing by then,
  // under an operation of its own
  held.value = null;
  uncertain.value = false;
  answered = true;

  if (typeof data.acknowledgement === 'string') {
    // Shown what was found, and records anyway if they mean to: two identical honest matches in one evening are
    // possible, and this is what keeps them possible
    acknowledgement.value = data.acknowledgement;
    candidates.value = (data.candidates as IRecordDuplicate[]) ?? [];
  } else if (status !== null && RECORD_POST_RECEIPT_STATUSES.includes(status)) {
    // A warning belongs to the operation it was issued about, and this refusal has just settled that operation
    // from inside the lock. Keeping its token would hold the next press on an id the server has already answered —
    // which is the same refusal again for as long as the page stays open — and keeping its list would leave the
    // matches that warning found sitting on the page under a message about something else entirely
    acknowledgement.value = null;
    candidates.value = [];
  }

  // Named only when the refusal named it. The message tells the person to open the result that exists, so without
  // the link it points at nothing they can reach
  existing.value = data.existing ? (data.existing as IRecordExisting) : null;

  // A correction is judged against the revision this page was opened at, and that revision is gone: amended or
  // voided by somebody else, or past the window. The same press can only ever earn the same refusal, so the form
  // stops offering one and points at the result instead. Read from the refusal rather than from the status, because
  // a reused operation carrying a changed body is a 409 too and is answered before a correction's eligibility is
  // ever looked at — that one resolves the way it always has. An entry ends on nothing: every conflict it can meet
  // is one a redraw or a second press resolves
  if (amendment.value && data.refusal === ResultConflict.STALE_RESULT) {
    superseded.value = true;
  }

  if (data.context) {
    // The league moved under the form; the caption redraws to the rules the entry will now be judged by
    rules.value = data.context as IResultFormContext;
  }

  serverMessage.value = message;
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
  // A deliberate save after the server answered the last one is a new operation, because the answered id can never
  // record anything else — a changed-body refusal is exactly that, and re-using the id would answer this result
  // with the same refusal for as long as the page stays open. Rotated here, at the press, rather than when the
  // answer arrived: nothing holds an operation nobody has asked for yet. A check is untouched, because it carries
  // the id its held body already has; and the press that answers a duplicate warning is the same save going
  // through, so it keeps the id the warning was issued about
  if (held.value === null && answered && acknowledgement.value === null) {
    operationId.value = crypto.randomUUID();
    answered = false;
  }

  // A check re-sends what the first attempt sent, to where it sent it, never anything rebuilt from what the page
  // holds now: the same operation id carrying a different body is a conflict, and a check aimed at a league the
  // original operation was never made against would answer about nothing
  const correction: IResultAmendment | null = amendment.value;
  // A correction is judged against the revision it was opened on rather than against the league's configuration,
  // because the amended result stays under the rules the match was played under; and it is sent to the match it
  // corrects rather than to the league's collection of results
  const attempt: IRecordAttempt = held.value ?? {
    body: correction
      ? {
          clientOperationId: operationId.value,
          expectedRevision: correction.expectedRevision,
          submission: toSubmission(),
        }
      : {
          acknowledgement: acknowledgement.value,
          clientOperationId: operationId.value,
          expectedLeagueRevision: rules.value.configurationRevision,
          submission: toSubmission(),
        },
    endpoint: correction
      ? `/api/leagues/${props.leagueId}/games/${correction.canonicalMatchId}/amend`
      : `/api/leagues/${props.leagueId}/games`,
    leagueId: props.leagueId,
  };

  held.value = attempt;
  saving.value = true;
  serverMessage.value = null;

  try {
    const answer: IRecordedAnswer = await $fetch<IRecordedAnswer>(attempt.endpoint, {
      body: attempt.body,
      method: 'POST',
    });

    held.value = null;
    uncertain.value = false;
    candidates.value = [];
    existing.value = null;
    acknowledgement.value = null;

    // The page is about to go to the result this draft became, and the guard asks about drafts that would be lost.
    // Marked for a check that came back recorded as much as for a first save: the edits made while the outcome was
    // unknown are not part of what was recorded, and they are not work to be offered back either
    departing = true;

    // The league the attempt was made against, never the prop as it stands now: the result was written where the
    // request went, and that is the page it is read at
    emit('recorded', answer.current.canonicalMatchId, attempt.leagueId);
  } catch (failure: unknown) {
    await settleFailure(failure);
  } finally {
    saving.value = false;
  }
}

/**
 * Leaves for sign-in, or for the welcome step, when the refusal was about the session rather than about the result.
 *
 * A 401 is the session itself; a 403 is either a role this account does not have or a welcome step it still owes,
 * and only the refreshed session can tell those apart — the first is an ordinary refusal of this write and stays
 * on the page. Either exit can be refused by the same network that refused the write, and an escaping rejection
 * would leave the form with no message and no way on, so a failed exit falls back to the ordinary handling and the
 * held request stays exactly where it was
 * @internal
 * @async
 * @function
 * @param failure - How the write failed
 * @returns Whether the page is leaving, and nothing more should be read onto the form
 */
async function leftForSession(failure: WriteFailure): Promise<boolean> {
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

/**
 * What this form is, as the URL states it: the league it records in, and the result a correction was opened on.
 *
 * Compared between two URLs rather than against what the form is holding, because the query names a game and the
 * form holds the match that game was folded onto — a correction opened from a superseded game would read as a
 * different form on every update if the two were compared directly
 * @internal
 * @function
 * @param where - A route this page is or is about to be at
 * @returns Its identity
 */
function identityOf(where: RouteLocationNormalized): string {
  return `${String(where.params.leagueId)}|${typeof where.query.amend === 'string' ? where.query.amend : ''}`;
}

/**
 * Asks before a departure that would lose the draft, and refuses the departure until it is answered
 * @internal
 * @function
 * @param to - Where the departure is going
 * @returns Whether to go
 */
function askBeforeLosing(to: RouteLocationNormalized): boolean {
  if (departing || leavingForSession || !dirty.value || to.path.startsWith(SIGN_IN_ROUTE)) {
    return true;
  }

  if (pendingDeparture.value === null) {
    departureOrigin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pendingDeparture.value = to.fullPath;

    // The question is the page's own dialog, so focus moves into it on the safe answer
    void nextTick((): void => stayButton.value?.focus());
  }

  return false;
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

layOut(gameType.value);

if (amendment.value) {
  openOn(amendment.value.submission);
}

watch([shown, settings], (): void => growRows());

// The settings editor's rule, in the page rather than in a browser dialog: a form with work in it asks before it is
// left, and a session that has ended is not a question anybody can usefully answer. An unanswered question is not
// permission either — a second attempt while it stands is refused too, and only Leave departs
onBeforeRouteLeave(askBeforeLosing);

// A query change is not a departure the guard above ever sees: the router matches the same record, so the page is
// updated rather than left. It is a departure to this form all the same, because what the form is — the league, the
// mode, and the result a correction was opened on — is read off the URL, and all three of them can change without
// the path changing at all. Asked only when one of them does: an unrelated query is not work anybody is losing
onBeforeRouteUpdate((to, from): boolean => (identityOf(to) === identityOf(from) ? true : askBeforeLosing(to)));
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

    <!-- What was said against the result this correction answers, so it is read beside what is being corrected -->
    <p
      v-if="disputeLine"
      class="text-body mt-4"
      data-test="dispute"
    >
      {{ disputeLine }}
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
        <!-- Named by when it was played: a warning about two matches is two links, and two lines reading the same
             thing are not a choice between them -->
        <NuxtLink
          class="text-accent-strong hover:text-accent font-medium"
          :to="`/leagues/${leagueId}/games/${candidate.canonicalMatchId}`"
        >
          {{ RECORD_DUPLICATE_LINK(candidate.playedAt) }}
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

    <!-- The correction has ended: the result it was opened on has moved, and the line above says so. The link is
         built from the match this form was opened on rather than from anything the refusal answered, because the
         amend route answers a conflict with no current state at all -->
    <p
      v-if="superseded && amendment"
      class="text-body-sm mt-2"
      data-test="superseded"
    >
      <NuxtLink
        class="text-accent-strong hover:text-accent font-medium"
        :to="`/leagues/${leagueId}/games/${amendment.canonicalMatchId}`"
      >
        {{ RECORD_SUPERSEDED_LINK }}
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
        :to="cancelRoute"
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
