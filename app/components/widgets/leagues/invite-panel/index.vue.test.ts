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
 * ████████████████████████████ #components/widgets/leagues/invite-panel/index.vue.test.ts █████████████████████████████
 *
 * Mounted component tests for the invite panel's QR disclosure, check, render, download and invalidation.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import { createError } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import type { IInviteLink, IInvitePanel } from '#shared/leagues';
import { InviteLinkState } from '#shared/leagues';

import {
  INVITE_AUTHORITY_LOST_MESSAGE,
  INVITE_QR_REGION_ID,
  INVITE_QR_UNREAD_MESSAGE,
  INVITE_STALE_MESSAGE,
} from './constants';
import InvitePanel from './index.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * How many panels the file has mounted. Every mount gets a league of its own, because a panel's read is cached under
 * a key built from the league, and a second panel on one league would be served the first one's answer
 * @internal
 * @constant
 */
const mounted: { count: number } = { count: 0 };

/**
 * The control that opens the code
 * @internal
 * @constant
 */
const SHOW: string = 'Show QR';

/**
 * The control that saves it
 * @internal
 * @constant
 */
const DOWNLOAD: string = 'Download QR';

/**
 * The write every race case runs against the code
 * @internal
 * @constant
 */
const REVOKE: string = 'Revoke link';

/**
 * The other write that retires the link a code was checked against
 * @internal
 * @constant
 */
const REPLACE: string = 'Replace link';

/**
 * The line the panel shows once the last link has been revoked
 * @internal
 * @constant
 */
const REVOKED_LINE: string = 'Last link: revoked';

/**
 * The read-only field holding the link, offered only while there is a link to copy
 * @internal
 * @constant
 */
const LINK_FIELD: string = '#invite-url';

/**
 * A usable link, the state every QR control is offered in
 * @internal
 * @constant
 */
const USABLE: IInviteLink = {
  expiresAt: '2026-09-24T12:00:00.000Z',
  expiresInDays: 7,
  id: 'invite-1',
  maxUses: 5,
  state: InviteLinkState.USABLE,
  token: 'abcdefghijklmnopqrstuvwx',
  useCount: 2,
};

/**
 * The same link after somebody revoked it in another tab; a retired link is served without its token
 * @internal
 * @constant
 */
const REVOKED: IInviteLink = {
  ...USABLE,
  state: InviteLinkState.REVOKED,
  token: null,
};

/**
 * The link that replaced it, issued in another tab: a different link, and one anybody could still use
 * @internal
 * @constant
 */
const SUCCESSOR: IInviteLink = {
  ...USABLE,
  id: 'invite-2',
  token: 'zyxwvutsrqponmlkjihgfedc',
  useCount: 0,
};

/**
 * What the invitations endpoint answers next, held open so a case decides per request
 * @internal
 * @constant
 */
const endpoint: { read: () => Promise<IInvitePanel>; writes: string[] } = vi.hoisted(() => ({
  read: (): Promise<IInvitePanel> => Promise.reject(new Error('unstubbed')),
  writes: [],
}));

/**
 * Every file the browser was asked to save, captured from the anchor the panel hands it
 * @internal
 * @constant
 */
const saved: { name: string }[] = [];

/**
 * How many temporary URLs were minted, so a refused download can be shown to have minted none
 * @internal
 * @constant
 */
const minted: { count: number } = { count: 0 };

/**
 * Answers the next read with a panel
 * @internal
 * @function
 * @param link - The link to answer with
 */
function answerWith(link: IInviteLink | null): void {
  endpoint.read = (): Promise<IInvitePanel> => Promise.resolve({ link });
}

/**
 * Lets every answered request and the render it causes settle
 * @internal
 * @function
 */
async function flush(): Promise<void> {
  await new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, 0);
  });
  await nextTick();
}

/**
 * Mounts the panel with its first read already answered
 * @internal
 * @function
 * @param link - The link the panel loads with
 * @returns The mounted panel
 */
async function mountPanel(link: IInviteLink | null): Promise<VueWrapper> {
  mounted.count += 1;

  const leagueId: string = `league-${mounted.count}`;

  answerWith(link);
  registerEndpoint(`/api/leagues/${leagueId}/invitations`, (): Promise<IInvitePanel> => endpoint.read());
  registerEndpoint(`/api/leagues/${leagueId}/invitations/${USABLE.id}/revoke`, {
    handler: (): Promise<IInvitePanel> => {
      endpoint.writes.push('revoke');

      return Promise.resolve({ link: REVOKED });
    },
    method: 'POST',
  });
  registerEndpoint(`/api/leagues/${leagueId}/invitations/${USABLE.id}/replace`, {
    handler: (): Promise<IInvitePanel> => {
      endpoint.writes.push('replace');

      return Promise.resolve({ link: SUCCESSOR });
    },
    method: 'POST',
  });

  const wrapper: VueWrapper = await mountSuspended(InvitePanel, {
    props: {
      abbreviation: 'OFF',
      leagueId,
      leagueName: 'Office League',
    },
  });

  await flush();

  return wrapper;
}

/**
 * Finds a control by the words on it
 * @internal
 * @function
 * @param wrapper - The mounted panel
 * @param label - The words
 * @returns The control, or undefined when the panel is not offering it
 */
function control(wrapper: VueWrapper, label: string): DOMWrapper<Element> | undefined {
  return wrapper.findAll('button').find((button: DOMWrapper<Element>): boolean => button.text().trim() === label);
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    endpoint.writes.length = 0;
    saved.length = 0;
    minted.count = 0;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (): CanvasRenderingContext2D =>
        ({
          fillRect: (): void => undefined,
          fillText: (): void => undefined,
          measureText: (text: string): TextMetrics => ({ width: text.length * 7 }) as TextMetrics,
        }) as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,drawn');
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback): void => void callback(new Blob(['png'], { type: 'image/png' })),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function anchorClick(
      this: HTMLAnchorElement,
    ): void {
      saved.push({ name: this.download });
    });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((): string => {
      minted.count += 1;

      return 'blob:stub';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((): void => undefined);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('offers the code only while there is a usable link to encode', async (): Promise<void> => {
    const usable: VueWrapper = await mountPanel(USABLE);

    expect(control(usable, SHOW)).toBeDefined();
    expect(control(usable, DOWNLOAD)).toBeDefined();

    const never: VueWrapper = await mountPanel(null);

    expect(control(never, SHOW)).toBeUndefined();
    expect(control(never, DOWNLOAD)).toBeUndefined();

    const retired: VueWrapper = await mountPanel(REVOKED);

    expect(control(retired, SHOW)).toBeUndefined();
    expect(control(retired, DOWNLOAD)).toBeUndefined();
  });

  it('opens a code under the link, and a second click hides it', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    await control(wrapper, SHOW)?.trigger('click');
    await flush();

    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,drawn');
    expect(wrapper.text()).toContain('Office League');

    await control(wrapper, 'Hide QR')?.trigger('click');
    await flush();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(endpoint.writes).toEqual([]);
  });

  it('announces the code as a disclosure, open or closed', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    expect(control(wrapper, SHOW)?.attributes('aria-controls')).toBe(INVITE_QR_REGION_ID);
    expect(control(wrapper, SHOW)?.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find(`#${INVITE_QR_REGION_ID}`).exists()).toBe(true);

    await control(wrapper, SHOW)?.trigger('click');
    await flush();

    expect(control(wrapper, 'Hide QR')?.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find(`#${INVITE_QR_REGION_ID}`).exists()).toBe(true);
  });

  it('renders no code for a link revoked in another tab, and shows the state it is in', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    answerWith(REVOKED);
    await control(wrapper, SHOW)?.trigger('click');
    await flush();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain(REVOKED_LINE);
    expect(control(wrapper, SHOW)).toBeUndefined();

    // The panel already says what happened; only a link that quietly changed under the click needs saying out loud
    expect(wrapper.text()).not.toContain(INVITE_STALE_MESSAGE);
  });

  it('refuses a code for a link replaced in another tab, and says the link changed', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    answerWith(SUCCESSOR);
    await control(wrapper, SHOW)?.trigger('click');
    await flush();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain(INVITE_STALE_MESSAGE);
    expect(wrapper.find(LINK_FIELD).attributes('value')).toContain(SUCCESSOR.token);
    expect(control(wrapper, SHOW)).toBeDefined();
  });

  it('saves nothing for a link replaced in another tab, and says the link changed', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    answerWith(SUCCESSOR);
    await control(wrapper, DOWNLOAD)?.trigger('click');
    await flush();

    expect(saved).toEqual([]);
    expect(minted.count).toBe(0);
    expect(wrapper.text()).toContain(INVITE_STALE_MESSAGE);
    expect(wrapper.find(LINK_FIELD).attributes('value')).toContain(SUCCESSOR.token);
  });

  it('refuses rather than falling back on the usable link it is still holding', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    endpoint.read = (): Promise<IInvitePanel> => Promise.reject(createError({ statusCode: 502 }));
    await control(wrapper, SHOW)?.trigger('click');
    await flush();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain(INVITE_QR_UNREAD_MESSAGE);
    expect(wrapper.find(LINK_FIELD).attributes('value')).toContain(USABLE.token);
  });

  it('saves the code under the league short mark, writing nothing', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    await control(wrapper, DOWNLOAD)?.trigger('click');
    await flush();

    expect(saved).toEqual([{ name: 'OFF-invite.png' }]);
    expect(endpoint.writes).toEqual([]);
  });

  it('saves nothing when the check finds the link revoked', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    answerWith(REVOKED);
    await control(wrapper, DOWNLOAD)?.trigger('click');
    await flush();

    expect(saved).toEqual([]);
    expect(minted.count).toBe(0);
    expect(wrapper.text()).toContain(REVOKED_LINE);
  });

  it('discards a code whose check was overtaken by a revoke', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    let release: (panel: IInvitePanel) => void = (): void => undefined;

    endpoint.read = (): Promise<IInvitePanel> =>
      new Promise((resolve: (panel: IInvitePanel) => void): void => {
        release = resolve;
      });

    const showing: Promise<void> = control(wrapper, SHOW)?.trigger('click') ?? Promise.resolve();

    await control(wrapper, REVOKE)?.trigger('click');
    await flush();
    await control(wrapper, REVOKE)?.trigger('click');
    await flush();

    // The check started before the revoke answers with the link as it was, and must not be drawn from
    release({ link: USABLE });
    await showing;
    await flush();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(endpoint.writes).toEqual(['revoke']);

    // Nor adopted: an answer older than the revoke would put the dead link and its controls back on screen
    expect(wrapper.find(LINK_FIELD).exists()).toBe(false);
    expect(wrapper.text()).toContain(REVOKED_LINE);
    expect(control(wrapper, SHOW)).toBeUndefined();
  });

  it('keeps the link a replacement left, rather than the one a held download read answers with', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    let release: (panel: IInvitePanel) => void = (): void => undefined;

    endpoint.read = (): Promise<IInvitePanel> =>
      new Promise((resolve: (panel: IInvitePanel) => void): void => {
        release = resolve;
      });

    const saving: Promise<void> = control(wrapper, DOWNLOAD)?.trigger('click') ?? Promise.resolve();

    await control(wrapper, REPLACE)?.trigger('click');
    await flush();
    await control(wrapper, REPLACE)?.trigger('click');
    await flush();

    release({ link: USABLE });
    await saving;
    await flush();

    expect(saved).toEqual([]);
    expect(minted.count).toBe(0);
    expect(endpoint.writes).toEqual(['replace']);
    expect(wrapper.find(LINK_FIELD).attributes('value')).toContain(SUCCESSOR.token);
  });

  it('clears the shown code and controls when a check observes removed membership', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    await control(wrapper, SHOW)?.trigger('click');
    await flush();

    expect(wrapper.find('img').exists()).toBe(true);

    endpoint.read = (): Promise<IInvitePanel> => Promise.reject(createError({ statusCode: 404 }));
    await control(wrapper, DOWNLOAD)?.trigger('click');
    await flush();

    expect(saved).toEqual([]);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find(LINK_FIELD).exists()).toBe(false);
    expect(control(wrapper, DOWNLOAD)).toBeUndefined();
  });

  it('says nothing about a read that failed for a click a write had already overtaken', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    let fail: (failure: unknown) => void = (): void => undefined;

    // One promise for every call, because a failed read is retried once and both attempts must answer the same way
    const held: Promise<IInvitePanel> = new Promise(
      (_resolve: (panel: IInvitePanel) => void, reject: (failure: unknown) => void): void => {
        fail = reject;
      },
    );

    endpoint.read = (): Promise<IInvitePanel> => held;

    const showing: Promise<void> = control(wrapper, SHOW)?.trigger('click') ?? Promise.resolve();

    await control(wrapper, REVOKE)?.trigger('click');
    await flush();
    await control(wrapper, REVOKE)?.trigger('click');
    await flush();

    fail(createError({ statusCode: 502 }));
    await showing;
    await flush();

    expect(wrapper.text()).not.toContain(INVITE_QR_UNREAD_MESSAGE);
    expect(wrapper.text()).toContain(REVOKED_LINE);
  });

  it('lets the controls go for a lost role, even on a click a write had already overtaken', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    await control(wrapper, SHOW)?.trigger('click');
    await flush();

    let fail: (failure: unknown) => void = (): void => undefined;

    const held: Promise<IInvitePanel> = new Promise(
      (_resolve: (panel: IInvitePanel) => void, reject: (failure: unknown) => void): void => {
        fail = reject;
      },
    );

    endpoint.read = (): Promise<IInvitePanel> => held;

    const saving: Promise<void> = control(wrapper, DOWNLOAD)?.trigger('click') ?? Promise.resolve();

    await control(wrapper, REVOKE)?.trigger('click');
    await flush();
    await control(wrapper, REVOKE)?.trigger('click');
    await flush();

    // A role that is gone is gone whichever click found out; it is not a message a newer action gets to swallow
    fail(createError({ statusCode: 404 }));
    await saving;
    await flush();

    expect(wrapper.text()).toContain(INVITE_AUTHORITY_LOST_MESSAGE);
    expect(wrapper.find('img').exists()).toBe(false);
    expect(saved).toEqual([]);
  });

  it('clears an open code the moment a write begins', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountPanel(USABLE);

    await control(wrapper, SHOW)?.trigger('click');
    await flush();

    expect(wrapper.find('img').exists()).toBe(true);

    await control(wrapper, REVOKE)?.trigger('click');
    await flush();
    await control(wrapper, REVOKE)?.trigger('click');
    await flush();

    expect(wrapper.find('img').exists()).toBe(false);
  });
});
