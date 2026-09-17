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
 * ████████████████████████████████ #components/widgets/leagues/invite-panel/index.vue █████████████████████████████████
 *
 * A league's invite panel for commissioners and managers: create, copy, show as a code, save, replace and revoke one
 * shareable link.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * <WidgetsLeaguesInvitePanel :abbreviation="league.abbreviation" :league-id="league.id" :league-name="league.name" />
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • abbreviation
 *     - Description: the league's short mark, which names the downloaded code
 *     - Type: string
 *     - Required: true
 *   • leagueId
 *     - Description: the league whose link the panel manages
 *     - Type: string
 *     - Required: true
 *   • leagueName
 *     - Description: the league's name, shown beside the code and printed under the downloaded one
 *     - Type: string
 *     - Required: true
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef, Ref } from 'vue';

import type { IInviteLink, IInviteLinkOptions, IInvitePanel } from '#shared/leagues';
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
  INVITE_EXPIRY_DAY_CHOICES,
  INVITE_MAX_USES_CEILING,
  InviteLinkState,
} from '#shared/leagues';
import { AccountReadState, type IAccountReadStateInput } from '~/utils/account/read-state';
import { describeInviteLink } from '~/utils/leagues/display';
import { buildInviteUrl } from '~/utils/leagues/entry';
import { classifyWriteFailure, WriteFailure } from '~/utils/leagues/write-failure';

import {
  COPIED_VISIBLE_MS,
  DOWNLOAD_RELEASE_MS,
  INVITE_AUTHORITY_LOST_MESSAGE,
  INVITE_EXPIRY_OPTIONS,
  INVITE_MAX_USES_MESSAGE,
  INVITE_QR_UNAVAILABLE_MESSAGE,
  INVITE_QR_UNREAD_MESSAGE,
  INVITE_UPDATE_FAILED_MESSAGE,
  QR_IMAGE_TYPE,
} from './constants';
import { InvitePanelMode } from './enums';
import type { ILeaguesInvitePanelProps } from './types';
import { drawInviteQr, settleInviteWrite, toInviteQrCaptions, toInviteQrFile, toInviteQrFileName } from './utils';

/* ─── Props ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The league whose link this panel manages, and the name and short mark its code is captioned and saved with.
 * @internal
 * @constant
 */
const props: Readonly<ILeaguesInvitePanelProps> = defineProps<ILeaguesInvitePanelProps>();

/* ─── State ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The panel's state, read in the browser only: the token is served to a commissioner or manager on request, never
 * rendered into the league page's HTML.
 * @internal
 * @constant
 */
const {
  data: panel,
  error,
  refresh,
  status,
}: ReturnType<typeof useFetch<IInvitePanel>> = useFetch<IInvitePanel>(
  (): string => `/api/leagues/${props.leagueId}/invitations`,
  { key: `invite-panel-${props.leagueId}`, server: false },
);

/**
 * What the panel is asking right now.
 * @internal
 * @constant
 */
const mode: Ref<InvitePanelMode> = ref(InvitePanelMode.VIEW);

/**
 * The chosen expiry in days.
 * @internal
 * @constant
 */
const expiresInDays: Ref<number> = ref(DEFAULT_INVITE_EXPIRY_DAYS);

/**
 * The use limit as typed; empty means no limit.
 * @internal
 * @constant
 */
const maxUsesInput: Ref<string> = ref('');

/**
 * The use limit's message, or null.
 * @internal
 * @constant
 */
const maxUsesError: Ref<string | null> = ref(null);

/**
 * Whether a write, or the re-read after one, is in flight.
 * @internal
 * @constant
 */
const busy: Ref<boolean> = ref(false);

/**
 * The one alert the panel shows, or null.
 * @internal
 * @constant
 */
const alert: Ref<string | null> = ref(null);

/**
 * Whether Copied is showing.
 * @internal
 * @constant
 */
const copied: Ref<boolean> = ref(false);

/**
 * The read-only field holding the link, selected when the clipboard cannot be written.
 * @internal
 * @constant
 */
const linkField: Ref<HTMLInputElement | null> = ref(null);

/**
 * The exits a 401 or a welcome-owing 403 takes.
 * @internal
 * @constant
 */
const exit: ReturnType<typeof useSessionExit> = useSessionExit();

/**
 * This deployment's origin, which the copied link is built on.
 * @internal
 * @constant
 */
const origin: string = useRequestURL().origin;

/**
 * The code the open region shows, as an image, or null when the region is closed.
 * @internal
 * @constant
 */
const qrImage: Ref<string | null> = ref(null);

/**
 * Whether a QR action is checking the link or drawing its code.
 * @internal
 * @constant
 */
const qrChecking: Ref<boolean> = ref(false);

/**
 * Whether the viewer still runs this league, as the panel's own reads have observed it. A read that answers otherwise
 * takes every control with it rather than leaving a token on screen the server would no longer serve.
 * @internal
 * @constant
 */
const authority: Ref<boolean> = ref(true);

/**
 * The timer that hides Copied, tracked so a second copy cannot leave an orphaned one behind.
 * @internal
 */
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * The identity of the QR action in flight. Every invalidation moves it, and a completion that no longer matches is
 * discarded before anything is shown or saved, so a code checked before a revoke never arrives after one.
 * @internal
 */
let qrGeneration: number = 0;

/**
 * The temporary URL the last download was handed over, held only until the browser has taken it.
 * @internal
 */
let downloadUrl: string | null = null;

/**
 * The timer that releases it.
 * @internal
 */
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

/* ─── Computed ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the panel draws for its read: the panel, a skeleton, a retryable failure with no controls, or nothing while
 * sign-in is being reached.
 * @internal
 * @constant
 */
const readState: ComputedRef<AccountReadState> = useAccountReadState((): IAccountReadStateInput => ({
  errorStatusCode: error.value?.statusCode ?? null,
  hasData: Boolean(panel.value),
  status: status.value,
}));

/**
 * The current or most recent link, or null when none was ever issued.
 * @internal
 * @constant
 */
const link: ComputedRef<IInviteLink | null> = computed((): IInviteLink | null => panel.value?.link ?? null);

/**
 * Whether the league has a link anyone can use right now.
 * @internal
 * @constant
 */
const usable: ComputedRef<boolean> = computed((): boolean => link.value?.state === InviteLinkState.USABLE);

/**
 * The URL a commissioner copies, while the link is usable.
 * @internal
 * @constant
 */
const inviteUrl: ComputedRef<string> = computed((): string =>
  link.value?.token ? buildInviteUrl(origin, link.value.token) : '',
);

/**
 * Which link a drawn code belongs to, or an empty key when there is no link a code could encode.
 *
 * Identity and usability only: a link whose use count has moved is still the same link, and redrawing a code because
 * somebody joined would be noise. Watched rather than compared inside each action, so a replacement observed by any
 * read at all invalidates a code, not only one this panel asked for
 * @internal
 * @constant
 */
const qrLinkKey: ComputedRef<string> = computed((): string =>
  usable.value && link.value?.token ? `${link.value.id}:${link.value.token}` : '',
);

/* ─── Handlers ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Sets the controls to a link's duration and limit, or the defaults when there is none.
 * @internal
 * @function
 * @param source - The link to prefill from
 */
function prefill(source: IInviteLink | null): void {
  expiresInDays.value =
    source && INVITE_EXPIRY_DAY_CHOICES.includes(source.expiresInDays)
      ? source.expiresInDays
      : DEFAULT_INVITE_EXPIRY_DAYS;
  maxUsesInput.value = source?.maxUses === null || !source ? '' : String(source.maxUses);
  maxUsesError.value = null;
}

/**
 * Reads the controls into the options the endpoints accept, or shows the use limit's message.
 * @internal
 * @function
 * @returns The options, or null when the use limit is not usable
 */
function readOptions(): IInviteLinkOptions | null {
  const typed: string = String(maxUsesInput.value).trim();

  if (typed === '') {
    maxUsesError.value = null;

    return { expiresInDays: expiresInDays.value, maxUses: null };
  }

  const maxUses: number = Number(typed);

  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > INVITE_MAX_USES_CEILING) {
    maxUsesError.value = INVITE_MAX_USES_MESSAGE;

    return null;
  }

  maxUsesError.value = null;

  return { expiresInDays: expiresInDays.value, maxUses };
}

/**
 * Runs one write and settles the panel on its outcome.
 *
 * A definite refusal leaves the old link working and says so. A conflict re-reads and shows the current link, and a
 * link that ran out of time or uses re-reads the same way but says the link is dead rather than replaced. An uncertain
 * outcome re-reads before showing any control, and only alerts if the re-read shows nothing changed, so a replacement
 * whose answer was lost is found by the re-read rather than by a second replacement
 * @internal
 * @function
 * @param write - The request to send
 */
async function runWrite(write: () => Promise<IInvitePanel>): Promise<void> {
  const before: string = JSON.stringify(link.value);

  // A write begins: whatever link a code was drawn from is about to stop being the answer
  clearQr();

  busy.value = true;
  alert.value = null;

  try {
    panel.value = await write();
    mode.value = InvitePanelMode.VIEW;
    prefill(link.value);
  } catch (caught: unknown) {
    const failure: WriteFailure = classifyWriteFailure(caught);

    if (failure === WriteFailure.UNAUTHORIZED) {
      await exit.toSignIn();

      return;
    }

    if (failure === WriteFailure.FORBIDDEN && (await exit.toWelcomeIfOwed())) {
      return;
    }

    // A refusal that leaves the link as it was; the controls stay as they were for another try
    if (failure === WriteFailure.RATE_LIMITED || failure === WriteFailure.REFUSED) {
      alert.value = INVITE_UPDATE_FAILED_MESSAGE;

      return;
    }

    await refresh();
    mode.value = InvitePanelMode.VIEW;
    prefill(link.value);

    alert.value = settleInviteWrite(failure, JSON.stringify(link.value) !== before);
  } finally {
    busy.value = false;
  }
}

/**
 * Creates a link, naming the last link the panel saw so a stale panel cannot rotate a link it never showed.
 * @internal
 * @function
 */
async function onCreate(): Promise<void> {
  const options: IInviteLinkOptions | null = readOptions();

  if (!options) {
    return;
  }

  await runWrite((): Promise<IInvitePanel> =>
    $fetch<IInvitePanel>(`/api/leagues/${props.leagueId}/invitations`, {
      body: { ...options, previousId: link.value?.id ?? null },
      method: 'POST',
    }),
  );
}

/**
 * Replaces the current link, carrying its id.
 * @internal
 * @function
 */
async function onConfirmReplace(): Promise<void> {
  const options: IInviteLinkOptions | null = readOptions();
  const current: IInviteLink | null = link.value;

  if (!options || !current) {
    return;
  }

  await runWrite((): Promise<IInvitePanel> =>
    $fetch<IInvitePanel>(`/api/leagues/${props.leagueId}/invitations/${current.id}/replace`, {
      body: options,
      method: 'POST',
    }),
  );
}

/**
 * Revokes the current link, carrying its id.
 * @internal
 * @function
 */
async function onConfirmRevoke(): Promise<void> {
  const current: IInviteLink | null = link.value;

  if (!current) {
    return;
  }

  await runWrite((): Promise<IInvitePanel> =>
    $fetch<IInvitePanel>(`/api/leagues/${props.leagueId}/invitations/${current.id}/revoke`, { method: 'POST' }),
  );
}

/**
 * Opens a confirmation, prefilled from the current link.
 * @internal
 * @function
 * @param next - The confirmation to open
 */
function onAsk(next: InvitePanelMode): void {
  alert.value = null;
  prefill(link.value);
  mode.value = next;
}

/**
 * Closes a confirmation without doing anything.
 * @internal
 * @function
 */
function onCancel(): void {
  mode.value = InvitePanelMode.VIEW;
  maxUsesError.value = null;
}

/**
 * Copies the link and confirms with Copied, or selects it for a manual copy when the clipboard is unavailable.
 * @internal
 * @function
 */
async function onCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
  } catch {
    // Some browsers refuse the clipboard outside a secure context; selecting the text leaves one keypress to copy it
    linkField.value?.select();

    return;
  }

  copied.value = true;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout((): void => {
    copied.value = false;
  }, COPIED_VISIBLE_MS);
}

/**
 * Drops the code on screen and orphans anything still being drawn.
 * @internal
 * @function
 */
function clearQr(): void {
  qrGeneration += 1;
  qrImage.value = null;
}

/**
 * Releases the last download's temporary URL.
 * @internal
 * @function
 */
function releaseDownload(): void {
  clearTimeout(releaseTimer);

  if (downloadUrl !== null) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
}

/**
 * Reads the panel from the server and answers only with a link that is usable at this moment.
 *
 * A failed read answers nothing rather than falling back on what the panel happens to be holding: a panel that loaded
 * a usable link keeps showing it through a failed read, and treating that as an answer is exactly how a revoked code
 * would be drawn. A read that succeeds replaces the panel, so a link revoked elsewhere renders as the state it is in
 * @internal
 * @function
 * @returns The usable link, or null when the read failed or answered anything else
 */
async function readUsableLink(): Promise<IInviteLink | null> {
  try {
    const fresh: IInvitePanel = await $fetch<IInvitePanel>(`/api/leagues/${props.leagueId}/invitations`);

    panel.value = fresh;

    const current: IInviteLink | null = fresh.link;

    if (current === null || current.state !== InviteLinkState.USABLE || (current.token ?? '') === '') {
      return null;
    }

    return current;
  } catch (caught: unknown) {
    const failure: WriteFailure = classifyWriteFailure(caught);

    if (failure === WriteFailure.UNAUTHORIZED) {
      await exit.toSignIn();

      return null;
    }

    // A player is refused this endpoint, so a 403 no welcome step explains is the role itself being gone
    if (failure === WriteFailure.FORBIDDEN) {
      if (!(await exit.toWelcomeIfOwed())) {
        authority.value = false;
        clearQr();
      }

      return null;
    }

    alert.value = INVITE_QR_UNREAD_MESSAGE;

    return null;
  }
}

/**
 * Hands a finished file to the browser and releases its temporary URL once the browser has taken it.
 * @internal
 * @function
 * @param file - The file
 * @param name - The name to save it under
 */
function saveDownload(file: Blob, name: string): void {
  releaseDownload();

  const anchor: HTMLAnchorElement = document.createElement('a');

  downloadUrl = URL.createObjectURL(file);
  anchor.download = name;
  anchor.href = downloadUrl;
  anchor.click();

  releaseTimer = setTimeout(releaseDownload, DOWNLOAD_RELEASE_MS);
}

/**
 * Opens the code under the link, or hides it.
 *
 * Hiding is local and asks the server nothing. Opening checks the link first, and the identity it carries is taken
 * before that check, so a revoke that lands while the check is in flight discards the code rather than racing it
 * @internal
 * @function
 */
async function onToggleQr(): Promise<void> {
  if (qrImage.value !== null) {
    clearQr();

    return;
  }

  const mine: number = (qrGeneration += 1);

  qrChecking.value = true;
  alert.value = null;

  try {
    const current: IInviteLink | null = await readUsableLink();

    if (current === null || mine !== qrGeneration) {
      return;
    }

    const canvas: HTMLCanvasElement | null = drawInviteQr(buildInviteUrl(origin, current.token ?? ''), []);

    if (canvas === null) {
      alert.value = INVITE_QR_UNAVAILABLE_MESSAGE;

      return;
    }

    if (mine === qrGeneration) {
      qrImage.value = canvas.toDataURL(QR_IMAGE_TYPE);
    }
  } finally {
    qrChecking.value = false;
  }
}

/**
 * Saves the code as a file carrying the league and the day the link stops working.
 *
 * Nothing is minted, spent or rotated by saving one, and a saved image cannot be recalled: a replaced or revoked link
 * stops working through the token's own lifecycle, which is what the printed expiry is honest about
 * @internal
 * @function
 */
async function onDownloadQr(): Promise<void> {
  const mine: number = (qrGeneration += 1);

  qrChecking.value = true;
  alert.value = null;

  try {
    const current: IInviteLink | null = await readUsableLink();

    if (current === null || mine !== qrGeneration) {
      return;
    }

    const canvas: HTMLCanvasElement | null = drawInviteQr(
      buildInviteUrl(origin, current.token ?? ''),
      toInviteQrCaptions(props.leagueName, current),
    );
    const file: Blob | null = canvas === null ? null : await toInviteQrFile(canvas);

    if (file === null) {
      alert.value = INVITE_QR_UNAVAILABLE_MESSAGE;

      return;
    }

    if (mine === qrGeneration) {
      saveDownload(file, toInviteQrFileName(props.abbreviation));
    }
  } finally {
    qrChecking.value = false;
  }
}

/* ─── Lifecycle ──────────────────────────────────────────────────────────────────────────────────────────────────── */

// The controls start from the link they would replace or succeed, whenever a fresh panel arrives
watch(link, (current: IInviteLink | null): void => {
  if (mode.value === InvitePanelMode.VIEW) {
    prefill(current);
  }
});

// Synchronous, so a read that replaces the panel has invalidated the old code before the action that read it resumes
watch(qrLinkKey, clearQr, { flush: 'sync' });

onBeforeUnmount((): void => {
  clearTimeout(copiedTimer);
  clearQr();
  releaseDownload();
});
</script>

<template>
  <section class="border-border bg-surface rounded-lg border p-6 md:p-8">
    <h2 class="font-display text-h3 font-medium tracking-tight">{{ usable ? 'Invite link' : 'Invite players' }}</h2>

    <!-- The re-read failed: a retryable failure and no controls, because none of them could be trusted -->
    <div
      v-if="readState === AccountReadState.FAILED"
      class="mt-4"
      role="alert"
    >
      <p class="text-ink text-body">Could not load the invite link.</p>

      <button
        class="border-border text-ink hover:border-accent text-body-sm mt-4 rounded-md border px-4 py-2 font-medium transition-colors"
        type="button"
        @click="refresh()"
      >
        Retry
      </button>
    </div>

    <div
      v-else-if="readState === AccountReadState.PENDING"
      aria-hidden="true"
      class="bg-surface-raised mt-4 h-24 animate-pulse rounded-md"
    />

    <!-- A check answered that the role is gone: the controls go with it rather than showing a token nothing serves -->
    <p
      v-else-if="readState === AccountReadState.READY && !authority"
      class="text-ink text-body mt-4"
      role="alert"
    >
      {{ INVITE_AUTHORITY_LOST_MESSAGE }}
    </p>

    <div v-else-if="readState === AccountReadState.READY">
      <!-- A usable link: copy it, show or save its code, or replace or revoke it by id -->
      <template v-if="usable && link">
        <div class="mt-4">
          <label
            class="sr-only"
            for="invite-url"
          >
            Invite link
          </label>

          <input
            id="invite-url"
            ref="linkField"
            class="border-border bg-surface-raised text-ink text-body-sm block w-full rounded-md border px-3 py-2 font-mono"
            readonly
            type="text"
            :value="inviteUrl"
          />
        </div>

        <!-- The link's own actions, wrapping together rather than squeezing the field they act on -->
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            class="border-border text-ink hover:border-accent text-body-sm shrink-0 rounded-md border px-4 py-2 font-medium transition-colors"
            type="button"
            @click="onCopy"
          >
            {{ copied ? 'Copied' : 'Copy' }}
          </button>

          <button
            class="border-border text-ink hover:border-accent text-body-sm shrink-0 rounded-md border px-4 py-2 font-medium transition-colors disabled:opacity-50"
            :disabled="busy || qrChecking"
            type="button"
            @click="onToggleQr"
          >
            {{ qrImage ? 'Hide QR' : 'Show QR' }}
          </button>

          <button
            class="border-border text-ink hover:border-accent text-body-sm shrink-0 rounded-md border px-4 py-2 font-medium transition-colors disabled:opacity-50"
            :disabled="busy || qrChecking"
            type="button"
            @click="onDownloadQr"
          >
            Download QR
          </button>
        </div>

        <p class="text-ink-subtle text-caption mt-2">{{ describeInviteLink(link) }}</p>

        <!-- The code, drawn in this browser from the link above; showing it mints, spends and rotates nothing -->
        <div
          v-if="qrImage"
          class="border-border mt-4 rounded-md border p-4"
        >
          <img
            :alt="`QR code for the ${leagueName} invite link`"
            class="mx-auto block h-auto w-full max-w-[260px]"
            :src="qrImage"
          />

          <p class="text-ink text-body-sm mt-3 text-center break-words">{{ leagueName }}</p>

          <p class="text-ink-subtle text-caption mt-1 text-center">{{ describeInviteLink(link) }}</p>
        </div>

        <div
          v-if="mode === InvitePanelMode.VIEW"
          class="mt-4 flex flex-wrap gap-3"
        >
          <button
            class="text-ink-muted hover:text-ink text-body-sm font-medium transition-colors disabled:opacity-50"
            :disabled="busy"
            type="button"
            @click="onAsk(InvitePanelMode.CONFIRM_REPLACE)"
          >
            Replace link
          </button>

          <button
            class="text-ink-muted hover:text-ink text-body-sm font-medium transition-colors disabled:opacity-50"
            :disabled="busy"
            type="button"
            @click="onAsk(InvitePanelMode.CONFIRM_REVOKE)"
          >
            Revoke link
          </button>
        </div>
      </template>

      <!-- Never issued, or the last link is spent: say so plainly, with nothing to copy -->
      <template v-else>
        <p
          v-if="link"
          class="text-ink text-body-sm mt-4"
        >
          {{ describeInviteLink(link) }}
        </p>

        <p
          v-else
          class="text-ink-muted text-body mt-4"
        >
          Anyone with the link can join as a player. It expires after the time you choose, or sooner if it reaches a use
          limit.
        </p>
      </template>

      <!-- The expiry and limit controls, for a first link, a successor, or a confirmed replacement -->
      <div
        v-if="!usable || mode === InvitePanelMode.CONFIRM_REPLACE"
        class="mt-4"
      >
        <p
          v-if="mode === InvitePanelMode.CONFIRM_REPLACE"
          class="text-ink text-body-sm"
        >
          The old link stops working the moment the new one exists.
        </p>

        <div class="mt-3 flex flex-wrap gap-4">
          <label class="text-ink text-body-sm font-medium">
            Expires
            <select
              v-model.number="expiresInDays"
              class="border-border bg-surface text-ink mt-1 block rounded-md border px-3 py-2"
              :disabled="busy"
            >
              <option
                v-for="option in INVITE_EXPIRY_OPTIONS"
                :key="option.days"
                :value="option.days"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="text-ink text-body-sm font-medium">
            Use limit
            <input
              v-model="maxUsesInput"
              :aria-describedby="maxUsesError ? 'invite-max-uses-message' : undefined"
              :aria-invalid="maxUsesError !== null"
              class="border-border bg-surface text-ink mt-1 block w-32 rounded-md border px-3 py-2"
              :disabled="busy"
              inputmode="numeric"
              min="1"
              placeholder="No limit"
              step="1"
              type="number"
            />
          </label>
        </div>

        <p
          v-if="maxUsesError"
          id="invite-max-uses-message"
          class="text-negative-soft-ink text-body-sm mt-2"
        >
          {{ maxUsesError }}
        </p>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            v-if="mode === InvitePanelMode.CONFIRM_REPLACE"
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-50"
            :disabled="busy"
            type="button"
            @click="onConfirmReplace"
          >
            Replace link
          </button>

          <button
            v-else
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-50"
            :disabled="busy"
            type="button"
            @click="onCreate"
          >
            {{ link ? 'Create a new link' : 'Create invite link' }}
          </button>

          <button
            v-if="mode === InvitePanelMode.CONFIRM_REPLACE"
            class="text-ink-muted hover:text-ink text-body-sm px-2 py-2 font-medium transition-colors"
            :disabled="busy"
            type="button"
            @click="onCancel"
          >
            Cancel
          </button>
        </div>
      </div>

      <!-- Revoke asks once; the link is named by id, and memberships made through it stay -->
      <div
        v-if="usable && mode === InvitePanelMode.CONFIRM_REVOKE"
        class="mt-4"
      >
        <p class="text-ink text-body-sm">Revoke this link? Nobody can use it after this.</p>

        <div class="mt-3 flex flex-wrap gap-3">
          <button
            class="bg-accent text-accent-ink hover:bg-accent-hover text-body-sm rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-50"
            :disabled="busy"
            type="button"
            @click="onConfirmRevoke"
          >
            Revoke link
          </button>

          <button
            class="text-ink-muted hover:text-ink text-body-sm px-2 py-2 font-medium transition-colors"
            :disabled="busy"
            type="button"
            @click="onCancel"
          >
            Cancel
          </button>
        </div>
      </div>

      <p
        v-if="alert"
        class="bg-negative-soft text-negative-soft-ink text-body-sm mt-4 rounded-lg p-4"
        role="alert"
      >
        {{ alert }}
      </p>
    </div>
  </section>
</template>
