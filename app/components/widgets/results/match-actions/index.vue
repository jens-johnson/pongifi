<script setup lang="ts">
/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import { MAX_NOTE_LENGTH, ResultAction } from '#shared/results';
import { classifyWriteFailure, WriteFailure } from '~/utils/leagues/write-failure';
import { LEAGUES_ROUTE } from '~/utils/marketing/routes';
import type { IResultActionRequest, IResultActionState } from '~/utils/results/actions';
import {
  ACTION_LABEL,
  actionsBlocked,
  AMEND_LABEL,
  awaitingCheck,
  failAction,
  idleAction,
  ResultActionPhase,
  startAction,
  VOID_QUESTION,
} from '~/utils/results/actions';

import type { IResultsMatchActionsEmits, IResultsMatchActionsProps } from './types';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The league and the match, with this viewer's own permissions on it
 * @internal
 * @constant
 */
const props: Readonly<IResultsMatchActionsProps> = defineProps<IResultsMatchActionsProps>();

/**
 * Raised whenever the page should read the match again: after an answer landed, and after one was refused because
 * the result had already moved
 * @internal
 * @constant
 */
const emit = defineEmits<IResultsMatchActionsEmits>();

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The exits this page takes when an answer is refused because of the session rather than because of the result
 * @internal
 * @constant
 */
const exit: ReturnType<typeof useSessionExit> = useSessionExit();

/**
 * What the pressed action is doing, and what it is still holding
 * @internal
 * @constant
 */
const action: Ref<IResultActionState> = ref<IResultActionState>(idleAction());

/**
 * The words a dispute carries, kept across a refused attempt so nobody retypes them
 * @internal
 * @constant
 */
const note: Ref<string> = ref<string>('');

/**
 * Whether the void dialog is open. Void is the one action with no undo, so it is asked before it is sent
 * @internal
 * @constant
 */
const voidAsking: Ref<boolean> = ref<boolean>(false);

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether every action is unavailable because one of them is unresolved
 * @internal
 * @constant
 */
const blocked: ComputedRef<boolean> = computed((): boolean => actionsBlocked(action.value));

/**
 * Whether this viewer holds any action at all
 * @internal
 * @constant
 */
const hasActions: ComputedRef<boolean> = computed(
  (): boolean =>
    props.match.viewer.mayAmend ||
    props.match.viewer.mayConfirm ||
    props.match.viewer.mayDispute ||
    props.match.viewer.mayVoid ||
    // An answer nobody can be sure of has to stay reachable even when the re-read no longer offers the action that
    // made it: a confirmation that may have landed is exactly what removes the confirm button
    action.value.phase !== ResultActionPhase.IDLE,
);

/**
 * Where a correction is made: the Record page, opened on this result.
 *
 * The match's own id rather than the route's game id, so a correction opened from a superseded game still corrects
 * the result that game belongs to
 * @internal
 * @constant
 */
const amendRoute: ComputedRef<string> = computed(
  (): string => `${LEAGUES_ROUTE}/${props.leagueId}/games/new?amend=${props.match.canonicalMatchId}`,
);

/* ─── Methods ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Sends an answer, or asks first when it is the one that cannot be undone.
 *
 * Pressing the same button again after an uncertain outcome re-sends the same operation id rather than a new one, so
 * the server answers from the first attempt's receipt instead of acting twice — which is what makes Check safe
 * @internal
 * @async
 * @function
 * @param which - What was pressed
 */
async function press(which: ResultAction): Promise<void> {
  if (which === ResultAction.VOID && !voidAsking.value) {
    voidAsking.value = true;

    return;
  }

  // The request this press would make, if it is a new one. `startAction` keeps the earlier request instead when
  // this is a retry, so a check re-sends what the first attempt sent rather than what the page is showing now
  const intended: IResultActionRequest = {
    action: which,
    clientOperationId: crypto.randomUUID(),
    expectedRevision: props.match.revision,
    note: which === ResultAction.DISPUTE && note.value.trim().length > 0 ? note.value.trim() : null,
  };

  action.value = startAction(
    action.value,
    intended,
    `/api/leagues/${props.leagueId}/games/${props.match.canonicalMatchId}/answer`,
  );

  const sending: IResultActionState = action.value;

  try {
    await $fetch(sending.endpoint as string, { body: sending.request, method: 'POST' });

    action.value = idleAction();
    note.value = '';
    voidAsking.value = false;

    emit('resolved');
  } catch (failure: unknown) {
    action.value = failAction(sending, failure);

    // A conflict is the result having moved, not the request having failed: redraw to what is actually there and
    // let the person choose again from the actions that still apply
    if (action.value.phase === ResultActionPhase.CONFLICT) {
      voidAsking.value = false;

      emit('resolved');

      return;
    }

    // An ended session, or an account that still owes the welcome step, refused the session rather than this
    // answer, and the page leaves for the step that can actually be taken. Settled first, so an exit refused by
    // the same network that refused the write leaves an outcome nobody can be sure of still holding its request,
    // its endpoint and its operation id, with Check still on the button that made it
    await leaveForSession(failure);
  }
}

/**
 * Leaves for sign-in, or for the welcome step, when the refusal was about the session rather than about the answer.
 *
 * A 401 is the session itself; a 403 is either a role this account does not have or a welcome step it still owes,
 * and only the refreshed session can tell those apart — the first is an ordinary refusal of this answer and stays
 * on the page. Both exits carry the game back as their return path, so whoever signs in lands on the result they
 * were answering rather than at the top of the app
 * @internal
 * @async
 * @function
 * @param failure - How the write failed
 */
async function leaveForSession(failure: unknown): Promise<void> {
  const classified: WriteFailure = classifyWriteFailure(failure);

  try {
    if (classified === WriteFailure.UNAUTHORIZED) {
      await exit.toSignIn();
    } else if (classified === WriteFailure.FORBIDDEN) {
      await exit.toWelcomeIfOwed();
    }
  } catch {
    // The exit can be refused by the same network that refused the write, and an escaping rejection would leave
    // the page with no way on: what `failAction` settled stands, and an unresolved answer is still checkable
  }
}
</script>

<template>
  <div v-if="hasActions">
    <p
      v-if="action.message"
      class="text-body mb-4"
      data-test="action-message"
      role="alert"
    >
      {{ action.message }}
    </p>

    <label
      v-if="match.viewer.mayDispute"
      class="block max-w-[560px]"
    >
      <span class="text-ink-subtle text-body-sm">What's wrong with it? (optional)</span>

      <textarea
        v-model="note"
        class="border-border bg-surface text-body mt-1 block w-full rounded-lg border p-3"
        data-test="dispute-note"
        :disabled="blocked"
        :maxlength="MAX_NOTE_LENGTH"
        rows="3"
      />
    </label>

    <div class="mt-4 flex flex-wrap gap-3">
      <button
        v-if="match.viewer.mayConfirm || awaitingCheck(action, ResultAction.CONFIRM)"
        class="bg-accent-strong text-body rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
        data-test="confirm"
        :disabled="blocked && !awaitingCheck(action, ResultAction.CONFIRM)"
        type="button"
        @click="press(ResultAction.CONFIRM)"
      >
        {{ awaitingCheck(action, ResultAction.CONFIRM) ? 'Check' : ACTION_LABEL[ResultAction.CONFIRM] }}
      </button>

      <button
        v-if="match.viewer.mayDispute || awaitingCheck(action, ResultAction.DISPUTE)"
        class="border-border text-body rounded-lg border px-4 py-2 font-medium disabled:opacity-50"
        data-test="dispute"
        :disabled="blocked && !awaitingCheck(action, ResultAction.DISPUTE)"
        type="button"
        @click="press(ResultAction.DISPUTE)"
      >
        {{ awaitingCheck(action, ResultAction.DISPUTE) ? 'Check' : ACTION_LABEL[ResultAction.DISPUTE] }}
      </button>

      <!-- A link, because correcting is a page rather than an answer this one sends: it is worth opening in another
           tab, and it is a destination rather than a write. Unavailable while an answer is unresolved, for the same
           reason the answers beside it are — leaving would take the held Check with it.

           Unavailable means a disabled button rather than a dimmed link, because a link that is only dimmed is still
           a link: `pointer-events-none` stops a mouse and nothing else, so Enter on a focused link, a screen
           reader's own activation and any other non-pointer press all still navigate away from the answer nobody
           can be sure of. The sibling answers are disabled the same way, and the browser is what enforces it -->
      <template v-if="match.viewer.mayAmend">
        <NuxtLink
          v-if="!blocked"
          class="border-border text-body rounded-lg border px-4 py-2 font-medium"
          data-test="amend"
          :to="amendRoute"
        >
          {{ AMEND_LABEL }}
        </NuxtLink>

        <button
          v-else
          class="border-border text-body rounded-lg border px-4 py-2 font-medium opacity-50"
          data-test="amend"
          disabled
          type="button"
        >
          {{ AMEND_LABEL }}
        </button>
      </template>

      <button
        v-if="match.viewer.mayVoid || awaitingCheck(action, ResultAction.VOID)"
        class="text-body text-ink-subtle hover:text-ink rounded-lg px-4 py-2 font-medium disabled:opacity-50"
        data-test="void"
        :disabled="blocked && !awaitingCheck(action, ResultAction.VOID)"
        type="button"
        @click="press(ResultAction.VOID)"
      >
        {{ awaitingCheck(action, ResultAction.VOID) ? 'Check' : ACTION_LABEL[ResultAction.VOID] }}
      </button>
    </div>

    <!-- Void is the one action with no undo, so it is asked in the page rather than sent on the first press -->
    <div
      v-if="voidAsking"
      class="border-border bg-surface mt-4 max-w-[560px] rounded-lg border p-4"
      data-test="void-dialog"
      role="alertdialog"
    >
      <p class="text-body">{{ VOID_QUESTION }}</p>

      <div class="mt-4 flex gap-3">
        <button
          class="bg-accent-strong text-body rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
          data-test="void-confirm"
          :disabled="blocked"
          type="button"
          @click="press(ResultAction.VOID)"
        >
          Void this result
        </button>

        <button
          class="text-body text-ink-subtle hover:text-ink px-4 py-2 font-medium"
          data-test="void-cancel"
          type="button"
          @click="voidAsking = false"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
