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
import { CONFLICT_MESSAGE, UNCERTAIN_MESSAGE, VOID_QUESTION } from '~/utils/results/actions';

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
 * The endpoint's default answer: accepted, with nothing the component reads
 * @internal
 * @function
 * @returns An empty answer
 */
function answerAccepted(): unknown {
  return {};
}

/**
 * What the endpoint answers next, set per case
 * @internal
 */
let answer: (event: H3Event) => unknown = answerAccepted;

registerEndpoint(`/api/leagues/${LEAGUE_ID}/games/${MATCH_ID}/answer`, {
  handler: defineEventHandler(async (event: H3Event): Promise<unknown> => {
    sent.push((await readBody(event)) as Record<string, unknown>);

    return answer(event);
  }),
  method: 'POST',
});

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
async function mountActions(viewer: Partial<IMatchView['viewer']> = {}): Promise<VueWrapper> {
  return mountSuspended(MatchActions, { props: { leagueId: LEAGUE_ID, match: match(viewer) } });
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
