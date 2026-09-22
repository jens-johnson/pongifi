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
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import type { H3Event } from 'h3';
import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick } from 'vue';
import type { Router } from 'vue-router';

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
 * The session this file's account is signed into: whether it still owes the welcome step, and whether the refresh
 * the welcome exit makes can itself be reached.
 *
 * Set by the cases about the session, and only after they have mounted: the game route is gated, so an account that
 * owed the step from the start would never reach the page these cases are about
 * @internal
 * @constant
 */
const { session } = vi.hoisted((): { session: { owed: boolean; reachable: boolean } } => ({
  session: { owed: false, reachable: true },
}));

// A signed-in session, so the route middleware the departure cases navigate through lets them past its gate rather
// than replacing every destination with sign-in
mockNuxtImport('useUserSession', () => (): Record<string, unknown> => ({
  fetch: async (): Promise<void> => {
    if (!session.reachable) {
      throw new Error('offline');
    }
  },
  loggedIn: computed((): boolean => true),
  session: { value: {} },
  user: computed((): { needsWelcome: boolean } => ({ needsWelcome: session.owed })),
}));

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
 * A different league, which the page may also have moved to under the widget
 * @internal
 * @constant
 */
const LATER_LEAGUE_ID: string = 'a1b2c3d4-0000-4000-8000-000000000007';

/**
 * The page the actions are shown on, and the page a session exit has to bring the person back to
 * @internal
 * @constant
 */
const GAME_PATH: string = `/leagues/${LEAGUE_ID}/games/${MATCH_ID}`;

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
 * The control that opens a correction
 * @internal
 * @constant
 */
const AMEND: string = 'amend';

/**
 * The void control
 * @internal
 * @constant
 */
const VOID: string = 'void';

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
 * What a 403 that is about a role rather than about the session says
 * @internal
 * @constant
 */
const ROLE_REFUSED: string = 'Your role in this league does not allow that.';

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
 * The session having ended, which is not a refusal of this answer at all
 * @internal
 * @function
 * @param event - The request
 * @returns The refusal body
 */
function answerSignedOut(event: H3Event): unknown {
  setResponseStatus(event, 401);

  return { message: 'Your session has ended.' };
}

/**
 * A 403, which is either a welcome step still owed or a role this account does not hold
 * @internal
 * @function
 * @param event - The request
 * @returns The refusal body
 */
function answerForbidden(event: H3Event): unknown {
  setResponseStatus(event, 403);

  return { message: ROLE_REFUSED };
}

/**
 * What the endpoint answers next, set per case
 * @internal
 */
let answer: (event: H3Event) => unknown = answerAccepted;

for (const [league, target] of [
  [LEAGUE_ID, MATCH_ID],
  [LEAGUE_ID, LATER_MATCH_ID],
  [LATER_LEAGUE_ID, MATCH_ID],
  [LATER_LEAGUE_ID, LATER_MATCH_ID],
]) {
  // Every league-and-match combination is registered so that a retry aimed at the wrong one is recorded and
  // visible, rather than disappearing into a 404 a case could mistake for the refusal it was testing
  registerEndpoint(`/api/leagues/${league}/games/${target}/answer`, {
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
 * Mounts the actions at the game's own route, so the exits a session refusal takes have a page to carry back
 * @internal
 * @async
 * @function
 * @param viewer - What this viewer may do
 * @returns The mounted actions and the router they are on
 */
async function mountRouted(viewer: Partial<IMatchView['viewer']> = {}): Promise<{
  router: Router;
  wrapper: VueWrapper;
}> {
  const router: Router = useNuxtApp().$router as Router;

  await router.replace(GAME_PATH);

  const wrapper: VueWrapper = await mountSuspended(MatchActions, {
    props: { leagueId: LEAGUE_ID, match: match(viewer) },
    route: GAME_PATH,
  });

  return { router, wrapper };
}

/**
 * Lets an exit the press started resolve its own navigation guards
 * @internal
 * @async
 * @function
 */
async function settled(): Promise<void> {
  for (let round: number = 0; round < 2; round += 1) {
    await new Promise((resolve: (value: unknown) => void): void => {
      setTimeout(resolve, 0);
    });
    await nextTick();
  }
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
    session.owed = false;
    session.reachable = true;
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

  it('checks a held void rather than asking about it again, after the question was dismissed', async (): Promise<void> => {
    // Cancel closes the question but not the answer: the void may already have landed, and its Check is on the
    // button above. Reopening the question on that press would strand the held request behind a dialog whose own
    // yes is unavailable while an answer is held — there would be no way left to resolve it at all
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 502);
      answer = answerAccepted;

      return { message: 'Pongifi could not save this right now.' };
    };

    const wrapper: VueWrapper = await mountActions({ mayVoid: true });

    await pressButton(wrapper, 'void');
    await pressButton(wrapper, 'void-confirm');

    expect(at(wrapper, 'void').text()).toBe('Check');

    await at(wrapper, 'void-cancel').trigger('click');
    await nextTick();

    expect(at(wrapper, 'void-dialog').exists()).toBe(false);

    await pressButton(wrapper, 'void');

    // The question stays shut and the press goes straight to the request the first attempt made
    expect(at(wrapper, 'void-dialog').exists()).toBe(false);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[1]?.clientOperationId).toBe(sent[0]?.clientOperationId);
    expect(paths[1]).toBe(paths[0]);
    expect(wrapper.emitted('resolved')).toHaveLength(1);
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

  it('checks with the request it first sent, to where it first sent it, after a re-read', async (): Promise<void> => {
    // The page may refresh under the widget between the press and the check. A check rebuilt from the new props
    // would carry a later revision under the same operation id, which the server reads as a changed body — and be
    // aimed at a target the original operation was never made against, where its receipt is not
    answer = answerUnavailable;

    const wrapper: VueWrapper = await mountActions({ mayConfirm: true });

    await pressButton(wrapper, CONFIRM);

    // Both props move together: the league as well as the match, since the endpoint is built from both
    await wrapper.setProps({
      leagueId: LATER_LEAGUE_ID,
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
    // The registered endpoint is served under a prefix, so the tail is what identifies the target
    expect(paths[1]).toContain(`/api/leagues/${LEAGUE_ID}/games/${MATCH_ID}/answer`);
    expect(paths[1]).not.toContain(LATER_LEAGUE_ID);
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

      return { message: ROLE_REFUSED };
    };

    const wrapper: VueWrapper = await mountActions({ mayDispute: true });

    await at(wrapper, NOTE).setValue(WORDS);
    await pressButton(wrapper, DISPUTE);

    expect(at(wrapper, MESSAGE).text()).toBe(ROLE_REFUSED);
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
  describe('a refusal about the session rather than the result', (): void => {
    it('leaves for sign-in, carrying the game back with it', async (): Promise<void> => {
      // An ended session is not a refusal of this answer, and the page that stayed put offered a button that could
      // only fail again
      answer = answerSignedOut;

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted({ mayConfirm: true });

      await pressButton(wrapper, CONFIRM);

      await vi.waitFor((): void => {
        expect(router.currentRoute.value.path).toBe('/sign-in');
      });

      expect(router.currentRoute.value.query.redirect).toBe(GAME_PATH);
    });

    it('leaves for a welcome step the account still owes', async (): Promise<void> => {
      answer = answerForbidden;

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted({ mayConfirm: true });

      // Owed from here rather than from the start: the game route is gated, and an account owing the step would
      // have been sent to it instead of to this page
      session.owed = true;
      await pressButton(wrapper, CONFIRM);

      await vi.waitFor((): void => {
        expect(router.currentRoute.value.path).toBe('/welcome');
      });

      expect(router.currentRoute.value.query.redirect).toBe(GAME_PATH);
    });

    it('stays where it is for a 403 that owes no welcome step', async (): Promise<void> => {
      // A request from elsewhere, or a role this account does not have, is an ordinary refusal of this answer and
      // there is nowhere to send anybody
      answer = answerForbidden;

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted({ mayConfirm: true });

      await pressButton(wrapper, CONFIRM);
      await settled();

      expect(router.currentRoute.value.path).toBe(GAME_PATH);
      expect(at(wrapper, MESSAGE).text()).toBe(ROLE_REFUSED);
    });

    it('leaves a check the same way, and holds nothing back on the way out', async (): Promise<void> => {
      // The session can end between the press and the check as easily as before it
      answer = answerUnavailable;

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted({ mayConfirm: true });

      await pressButton(wrapper, CONFIRM);

      expect(at(wrapper, CONFIRM).text()).toBe('Check');

      answer = answerSignedOut;
      await pressButton(wrapper, CONFIRM);

      await vi.waitFor((): void => {
        expect(router.currentRoute.value.path).toBe('/sign-in');
      });

      expect(router.currentRoute.value.query.redirect).toBe(GAME_PATH);
      expect(sent).toHaveLength(2);
      expect(sent[1]?.clientOperationId).toBe(sent[0]?.clientOperationId);
    });

    it('keeps an unresolved answer checkable when the exit itself cannot be made', async (): Promise<void> => {
      // The network that refused the write can refuse the session refresh too. The page that cannot leave has to
      // still be holding the answer nobody can be sure of, on the button that made it
      answer = answerUnavailable;

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted({ mayConfirm: true });

      await pressButton(wrapper, CONFIRM);

      answer = answerForbidden;
      session.owed = true;
      session.reachable = false;
      await pressButton(wrapper, CONFIRM);
      await settled();

      expect(router.currentRoute.value.path).toBe(GAME_PATH);
      expect(at(wrapper, MESSAGE).text()).toContain(STILL_UNRESOLVED_MESSAGE);
      expect(at(wrapper, CONFIRM).text()).toBe('Check');

      answer = answerAccepted;
      await pressButton(wrapper, CONFIRM);

      expect(sent).toHaveLength(3);
      expect(new Set(sent.map((body): unknown => body.clientOperationId)).size).toBe(1);
      expect(wrapper.emitted('resolved')).toHaveLength(1);
    });
  });

  describe('opening a correction', (): void => {
    it('offers the Record page in Amend mode, on the match rather than on the route', async (): Promise<void> => {
      const wrapper: VueWrapper = await mountActions({
        administrator: true,
        mayAmend: true,
        mayVoid: true,
      });

      expect(at(wrapper, AMEND).text()).toBe('Amend result');
      expect(at(wrapper, AMEND).attributes('href')).toBe(`/leagues/${LEAGUE_ID}/games/new?amend=${MATCH_ID}`);
    });

    it('offers nothing to a viewer who may not correct it', async (): Promise<void> => {
      // Past the bound, or on a result nobody questioned, the read says so and the page offers void alone
      const wrapper: VueWrapper = await mountActions({ administrator: true, mayVoid: true });

      expect(at(wrapper, AMEND).exists()).toBe(false);
      expect(at(wrapper, VOID).exists()).toBe(true);
    });

    it('cannot be followed by any means while an answer is unresolved, and can be once it is not', async (): Promise<void> => {
      // Leaving would take the held request and its Check with it, which is the same reason the answers beside it
      // are unavailable. Unavailable has to mean unavailable to every input method: a link that is only dimmed is
      // still a link, and Enter on it, or a screen reader activating it, would leave anyway
      answer = answerUnavailable;

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted({
        administrator: true,
        mayAmend: true,
        mayVoid: true,
      });

      await pressButton(wrapper, VOID);
      await pressButton(wrapper, 'void-confirm');

      // There is no destination on the page at all, so there is nothing for any activation to follow
      expect(at(wrapper, AMEND).attributes('href')).toBeUndefined();
      expect(at(wrapper, AMEND).attributes('disabled')).toBeDefined();

      await at(wrapper, AMEND).trigger('click');
      await at(wrapper, AMEND).trigger('keydown', { key: 'Enter' });
      await settled();

      expect(router.currentRoute.value.path).toBe(GAME_PATH);
      // And the answer nobody could be sure of is still exactly where it was
      expect(at(wrapper, VOID).text()).toBe('Check');

      // Reconciled, and the way to the correction is open again
      answer = answerAccepted;
      await pressButton(wrapper, VOID);

      expect(at(wrapper, AMEND).attributes('href')).toBe(`/leagues/${LEAGUE_ID}/games/new?amend=${MATCH_ID}`);
    });

    it('cannot be followed while the first press is still in flight', async (): Promise<void> => {
      // The same hold, a moment earlier: the request has left and nothing has answered it yet
      let release: () => void = (): void => undefined;

      answer = (): Promise<unknown> =>
        new Promise((resolve: (value: unknown) => void): void => {
          release = (): void => resolve(answerAccepted());
        });

      const { wrapper }: { wrapper: VueWrapper } = await mountRouted({
        administrator: true,
        mayAmend: true,
        mayVoid: true,
      });

      await at(wrapper, VOID).trigger('click');
      await at(wrapper, 'void-confirm').trigger('click');
      await nextTick();

      expect(at(wrapper, AMEND).attributes('href')).toBeUndefined();

      release();
      await settled();

      expect(at(wrapper, AMEND).attributes('href')).toBe(`/leagues/${LEAGUE_ID}/games/new?amend=${MATCH_ID}`);
    });
  });
});
