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
 * ████████████████████████████ #components/widgets/results/match-actions/index.vue.test.ts ████████████████████████████
 *
 * Mounted tests for the result actions: who is offered what, and what a press holds.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import type { H3Event } from 'h3';
import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { beforeEach, describe, expect, it } from 'vitest';

import type { IMatchView } from '#shared/results';
import { ResultAction, ResultState } from '#shared/results';
import {
  ACTION_LABEL,
  CONFLICT_MESSAGE,
  STILL_UNRESOLVED_MESSAGE,
  UNCERTAIN_MESSAGE,
  VOID_QUESTION,
} from '~/utils/results/actions';

import MatchActions from './index.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The league the match belongs to
 * @internal
 * @constant
 */
const LEAGUE_ID: string = 'b5e2d1ef-0000-4000-8000-000000000002';

/**
 * The match being answered
 * @internal
 * @constant
 */
const MATCH_ID: string = 'd7a4f3b1-0000-4000-8000-000000000004';

/**
 * A different match, which a page that re-read under the widget might be showing instead
 * @internal
 * @constant
 */
const LATER_MATCH_ID: string = 'f9c6b5d3-0000-4000-8000-000000000006';

/**
 * The names the template gives each control
 * @internal
 * @constant
 */
const CONFIRM: string = 'confirm';

/**
 * The dispute button
 * @internal
 * @constant
 */
const DISPUTE: string = 'dispute';

/**
 * The dispute note field
 * @internal
 * @constant
 */
const NOTE: string = 'dispute-note';

/**
 * What the page says while something is outstanding
 * @internal
 * @constant
 */
const MESSAGE: string = 'action-message';

/**
 * The words a case disputes with
 * @internal
 * @constant
 */
const WORDS: string = 'that was not the score';

/**
 * Every body the component sent, in order.
 *
 * Recorded at a registered endpoint rather than at a stubbed `$fetch`, so the request travels the real fetch path
 * and a refusal is a real response the real client rejects on
 * @internal
 */
let sent: Record<string, unknown>[] = [];

/**
 * Every path the component sent to, in order, so a retry aimed at a different match is visible
 * @internal
 */
let paths: string[] = [];

/**
 * The endpoint's default answer: accepted, with nothing the component reads
 * @internal
 * @function
 * @returns An empty answer
 */
function answerAccepted(): unknown {
  return {};
}

/**
 * The server failing in a way that says nothing about whether the write landed
 * @internal
 * @function
 * @param event - The request
 * @returns The refusal body
 */
function answerUnavailable(event: H3Event): unknown {
  setResponseStatus(event, 502);

  return { message: 'Pongifi could not save this right now.' };
}

/**
 * The write allowance spent, which is decided before the receipt is ever consulted
 * @internal
 * @function
 * @param event - The request
 * @returns The refusal body
 */
function answerRateLimited(event: H3Event): unknown {
  setResponseStatus(event, 429);

  return { message: 'Too many saves.' };
}

/**
 * What the endpoint answers next, set per case
 * @internal
 */
let answer: (event: H3Event) => unknown = answerAccepted;

for (const target of [MATCH_ID, LATER_MATCH_ID]) {
  // Both are registered so that a retry aimed at the wrong match is recorded and visible, rather than disappearing
  // into a 404 that a case could mistake for the refusal it was testing
  registerEndpoint(`/api/leagues/${LEAGUE_ID}/games/${target}/answer`, {
    handler: defineEventHandler(async (event: H3Event): Promise<unknown> => {
      sent.push((await readBody(event)) as Record<string, unknown>);
      paths.push(event.path ?? '');

      return answer(event);
    }),
    method: 'POST',
  });
}

/**
 * A match as one viewer reads it
 * @internal
 * @function
 * @param viewer - What this viewer may do
 * @returns The match
 */
function match(viewer: Partial<IMatchView['viewer']> = {}): IMatchView {
  return {
    canonicalMatchId: MATCH_ID,
    revision: 3,
    state: ResultState.UNCONFIRMED,
    viewer: {
      administrator: false,
      mayAmend: false,
      mayConfirm: false,
      mayDispute: false,
      mayVoid: false,
      seated: true,
      ...viewer,
    },
  } as unknown as IMatchView;
}

/**
 * Mounts the actions as one viewer sees them
 * @internal
 * @async
 * @function
 * @param viewer - What this viewer may do
 * @returns The mounted actions
 */
async function mountActions(
  viewer: Partial<IMatchView['viewer']> = {},
  overrides: Partial<IMatchView> = {},
): Promise<VueWrapper> {
  return mountSuspended(MatchActions, {
    props: { leagueId: LEAGUE_ID, match: { ...match(viewer), ...overrides } },
  });
}

/**
 * Presses one of the buttons and waits for the request it makes to settle.
 *
 * `trigger` waits for the render, not for the handler's fetch; without this the assertions run before the request
 * has left
 * @internal
 * @async
 * @function
 * @param wrapper - The mounted actions
 * @param name - The test name of the button
 */
async function pressButton(wrapper: VueWrapper, name: string): Promise<void> {
  await at(wrapper, name).trigger('click');
  await new Promise((resolve: (value: unknown) => void): void => {
    setTimeout(resolve, 0);
  });
  await wrapper.vm.$nextTick();
}

/**
 * Finds one of the buttons by the name the template gives it
 * @internal
 * @function
 * @param wrapper - The mounted actions
 * @param name - The test name
 * @returns The element, which may not exist
 */
function at(wrapper: VueWrapper, name: string): DOMWrapper<Element> {
  return wrapper.find(`[data-test="${name}"]`);
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    sent = [];
    paths = [];
    answer = answerAccepted;
  });

  it('offers a viewer who holds nothing no actions at all', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountActions();

    expect(wrapper.find('button').exists()).toBe(false);
    expect(at(wrapper, NOTE).exists()).toBe(false);
  });

  it('offers each action only to the viewer the read says holds it', async (): Promise<void> => {
    // The server decides this at the moment of the write; the page must never offer more than the read allowed
    const confirmer: VueWrapper = await mountActions({ mayConfirm: true, mayDispute: true });

    expect(at(confirmer, 'confirm').exists()).toBe(true);
    expect(at(confirmer, 'dispute').exists()).toBe(true);
    expect(at(confirmer, 'void').exists()).toBe(false);

    // The recorder, the recorder's partner and a member of an already confirmed side: dispute alone
    const disputer: VueWrapper = await mountActions({ mayDispute: true });

    expect(disputer.find('[data-test="confirm"]').exists()).toBe(false);
    expect(at(disputer, 'dispute').exists()).toBe(true);
  });

  it('sends the answer the button stands for, against the revision the page was showing', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountActions({ mayConfirm: true });

    await pressButton(wrapper, CONFIRM);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      action: ResultAction.CONFIRM,
      expectedRevision: 3,
      note: null,
    });
    expect(sent[0]?.clientOperationId).toEqual(expect.any(String));
    expect(wrapper.emitted('resolved')).toHaveLength(1);
  });

  it('carries a dispute’s words, and sends null rather than an empty note', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountActions({ mayDispute: true });

    await pressButton(wrapper, DISPUTE);
    expect(sent[0]?.note).toBeNull();

    await at(wrapper, NOTE).setValue(`  ${WORDS}  `);
    await pressButton(wrapper, DISPUTE);
    expect(sent[1]?.note).toBe(WORDS);
  });

  it('asks before voiding, and sends nothing until the question is answered', async (): Promise<void> => {
    // Void is the one action with no undo
    const wrapper: VueWrapper = await mountActions({ mayVoid: true });

    await pressButton(wrapper, 'void');

    expect(at(wrapper, 'void-dialog').text()).toContain(VOID_QUESTION);
    expect(sent).toHaveLength(0);

    await pressButton(wrapper, 'void-confirm');

    expect(sent).toHaveLength(1);
    expect(sent[0]?.action).toBe(ResultAction.VOID);
  });

  it('sends nothing when the void question is cancelled', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountActions({ mayVoid: true });

    await pressButton(wrapper, 'void');
    await at(wrapper, 'void-cancel').trigger('click');

    expect(at(wrapper, 'void-dialog').exists()).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('holds every other action while one outcome is unknown', async (): Promise<void> => {
    // Pressing Void while a Confirm may or may not have landed is how somebody ends up having done both
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 502);

      return { message: 'Pongifi could not save this right now.' };
    };

    const wrapper: VueWrapper = await mountActions({
      mayConfirm: true,
      mayDispute: true,
      mayVoid: true,
    });

    await pressButton(wrapper, CONFIRM);

    expect(at(wrapper, MESSAGE).text()).toBe(UNCERTAIN_MESSAGE);
    expect(at(wrapper, DISPUTE).attributes('disabled')).toBeDefined();
    expect(at(wrapper, 'void').attributes('disabled')).toBeDefined();

    // The pressed one stays available, and asks about the same operation rather than starting a second
    expect(at(wrapper, CONFIRM).attributes('disabled')).toBeUndefined();
    expect(at(wrapper, CONFIRM).text()).toBe('Check');
  });

  it('checks the same operation rather than acting twice', async (): Promise<void> => {
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 502);
      answer = answerAccepted;

      return { message: 'Pongifi could not save this right now.' };
    };

    const wrapper: VueWrapper = await mountActions({ mayConfirm: true });

    await pressButton(wrapper, CONFIRM);
    await pressButton(wrapper, CONFIRM);

    expect(sent).toHaveLength(2);
    expect(sent[1]?.clientOperationId).toBe(sent[0]?.clientOperationId);
  });

  it('leaves the answer outstanding when the check itself was refused', async (): Promise<void> => {
    // The write allowance is spent before the server ever looks for the earlier operation's receipt, so a 429 on a
    // check proves only that the check did not run. Treating it as a refusal would tell somebody their confirmation
    // failed when it may well have landed
    answer = answerUnavailable;

    const wrapper: VueWrapper = await mountActions({
      mayConfirm: true,
      mayDispute: true,
      mayVoid: true,
    });

    await pressButton(wrapper, CONFIRM);

    answer = answerRateLimited;
    await pressButton(wrapper, CONFIRM);

    expect(at(wrapper, MESSAGE).text()).toContain(STILL_UNRESOLVED_MESSAGE);
    expect(at(wrapper, CONFIRM).text()).toBe('Check');
    expect(at(wrapper, DISPUTE).attributes('disabled')).toBeDefined();
    expect(at(wrapper, 'void').attributes('disabled')).toBeDefined();
    expect(wrapper.emitted('resolved')).toBeUndefined();
  });

  it('recovers once the check gets through, on the same operation throughout', async (): Promise<void> => {
    answer = answerUnavailable;

    const wrapper: VueWrapper = await mountActions({ mayConfirm: true, mayDispute: true });

    await pressButton(wrapper, CONFIRM);

    answer = answerRateLimited;
    await pressButton(wrapper, CONFIRM);

    answer = answerAccepted;
    await pressButton(wrapper, CONFIRM);

    expect(sent).toHaveLength(3);
    expect(new Set(sent.map((body): unknown => body.clientOperationId)).size).toBe(1);
    expect(at(wrapper, MESSAGE).exists()).toBe(false);
    expect(at(wrapper, CONFIRM).text()).toBe(ACTION_LABEL[ResultAction.CONFIRM]);
    expect(at(wrapper, DISPUTE).attributes('disabled')).toBeUndefined();
    expect(wrapper.emitted('resolved')).toHaveLength(1);
  });

  it('checks with the request it first sent, even after the page re-read', async (): Promise<void> => {
    // The page may refresh under the widget between the press and the check. A check rebuilt from the new props
    // would carry a later revision under the same operation id, which the server reads as a changed body
    answer = answerUnavailable;

    const wrapper: VueWrapper = await mountActions({ mayConfirm: true });

    await pressButton(wrapper, CONFIRM);

    await wrapper.setProps({
      match: {
        ...match({ mayConfirm: true }),
        canonicalMatchId: LATER_MATCH_ID,
        revision: 4,
      },
    });
    await pressButton(wrapper, CONFIRM);

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[1]?.expectedRevision).toBe(3);
    expect(paths[1]).toBe(paths[0]);
  });

  it('keeps the check reachable when the re-read no longer offers the action', async (): Promise<void> => {
    // A confirmation that may have landed is exactly what removes the confirm button, so recovery would otherwise
    // disappear at the moment it is needed
    answer = answerUnavailable;

    const wrapper: VueWrapper = await mountActions({ mayConfirm: true });

    await pressButton(wrapper, CONFIRM);
    await wrapper.setProps({ match: match() });

    expect(at(wrapper, CONFIRM).exists()).toBe(true);
    expect(at(wrapper, CONFIRM).text()).toBe('Check');
  });

  it('redraws rather than retrying when the result moved underneath it', async (): Promise<void> => {
    // The real shape: the route sets 409 and returns the refusal as a body
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 409);

      return {
        current: null,
        message: 'You have already answered this result.',
        refusal: 'ALREADY_ANSWERED',
      };
    };

    const wrapper: VueWrapper = await mountActions({ mayConfirm: true, mayDispute: true });

    await pressButton(wrapper, CONFIRM);

    expect(at(wrapper, MESSAGE).text()).toBe(CONFLICT_MESSAGE);
    // Nothing is held: the person chooses again from whatever the re-read offers
    expect(at(wrapper, DISPUTE).attributes('disabled')).toBeUndefined();
    expect(wrapper.emitted('resolved')).toHaveLength(1);
  });

  it('shows the server’s own words on a refusal, and keeps the note', async (): Promise<void> => {
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 403);

      return { message: 'Your role in this league does not allow that.' };
    };

    const wrapper: VueWrapper = await mountActions({ mayDispute: true });

    await at(wrapper, NOTE).setValue(WORDS);
    await pressButton(wrapper, DISPUTE);

    expect(at(wrapper, MESSAGE).text()).toBe('Your role in this league does not allow that.');
    expect((at(wrapper, NOTE).element as HTMLTextAreaElement).value).toBe(WORDS);
    expect(wrapper.emitted('resolved')).toBeUndefined();
  });

  it('clears the note once the dispute has landed', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountActions({ mayDispute: true });

    await at(wrapper, NOTE).setValue(WORDS);
    await pressButton(wrapper, DISPUTE);

    expect((at(wrapper, NOTE).element as HTMLTextAreaElement).value).toBe('');
  });

  it('caps the note at the length the column holds', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountActions({ mayDispute: true });

    expect(at(wrapper, NOTE).attributes('maxlength')).toBe('280');
  });
});
