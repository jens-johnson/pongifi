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
 * █████████████████████████████ #components/widgets/results/record-form/index.vue.test.ts █████████████████████████████
 *
 * Mounted tests for the Record form: what it derives, what it refuses, and what it sends.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import type { H3Event } from 'h3';
import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick } from 'vue';
import type { Router } from 'vue-router';
import { matchedRouteKey } from 'vue-router';

import type { IResultFormContext } from '#shared/results';
import { GameType } from '#shared/rules-engine';
import { toLocalDateTime } from '~/utils/results/format';

import RecordForm from './index.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Whether the session this file's account is signed into still owes the welcome step.
 *
 * Set by the one case about it, and only after that case has mounted: the record route is gated, so a session that
 * owed the step from the start would never reach the page the case is about
 * @internal
 * @constant
 */
const { welcome } = vi.hoisted((): { welcome: { owed: boolean } } => ({ welcome: { owed: false } }));

// A signed-in session, so the route middleware the departure cases navigate through lets them past its gate rather
// than replacing every destination with sign-in
mockNuxtImport('useUserSession', () => (): Record<string, unknown> => ({
  fetch: async (): Promise<void> => undefined,
  loggedIn: computed((): boolean => true),
  session: { value: {} },
  user: computed((): { needsWelcome: boolean } => ({ needsWelcome: welcome.owed })),
}));

/**
 * The league being recorded in
 * @internal
 * @constant
 */
const LEAGUE_ID: string = 'b5e2d1ef-0000-4000-8000-000000000002';

/**
 * Who is recording
 * @internal
 * @constant
 */
const ADA: string = 'a4f1c0de-0000-4000-8000-000000000001';

/**
 * Who they played
 * @internal
 * @constant
 */
const BEN: string = 'c6f3e2a0-0000-4000-8000-000000000003';

/**
 * The match a save creates
 * @internal
 * @constant
 */
const MATCH_ID: string = 'd7a4f3b1-0000-4000-8000-000000000004';

/**
 * A second match, used only where a list of one would prove nothing
 * @internal
 * @constant
 */
const OTHER_MATCH_ID: string = 'e8b5a4c2-0000-4000-8000-000000000005';

/**
 * The route the form is rendered at, which its departure guard is registered against
 * @internal
 * @constant
 */
const RECORD_PATH: string = `/leagues/${LEAGUE_ID}/games/new`;

/**
 * A second league, used only to prove a check goes where its own save went
 * @internal
 * @constant
 */
const OTHER_LEAGUE_ID: string = 'a1c3f5e7-0000-4000-8000-000000000009';

/**
 * The question the form asks before a departure would take an unsaved draft with it, which is the settings
 * editor's question word for word
 * @internal
 * @constant
 */
const LEAVE_PROMPT: string = 'Leave without saving?';

/**
 * The line above Save, which every refusal and every uncertain outcome writes to
 * @internal
 * @constant
 */
const SERVER_MESSAGE: string = 'server-message';

/**
 * The attribute an input's accessible name is read from
 * @internal
 * @constant
 */
const ARIA_LABEL: string = 'aria-label';

/**
 * The departure question's two answers
 * @internal
 * @constant
 */
const LEAVE: string = 'leave-confirm';

/**
 * The answer that changes nothing
 * @internal
 * @constant
 */
const STAY: string = 'leave-cancel';

/**
 * What a 422 says, which is the refusal several cases answer with
 * @internal
 * @constant
 */
const UNRECORDABLE: string = 'Some of what was entered cannot be recorded as played.';

/**
 * What a probable-duplicate warning says
 * @internal
 * @constant
 */
const WARNED: string = 'This looks like a result already recorded.';

/**
 * What the refusal that names an occupied operation id says
 * @internal
 * @constant
 */
const CHANGED_BODY: string = 'This entry was already recorded with different details.';

/**
 * When the match a duplicate warning names was played
 * @internal
 * @constant
 */
const WARNED_AT: string = '2026-09-20T11:00:00.000Z';

/**
 * Every body the form sent, in order
 * @internal
 */
let sent: Record<string, unknown>[] = [];

/**
 * Every body that reached a league this form was never saving into
 * @internal
 */
let strays: Record<string, unknown>[] = [];

/**
 * Every form a case mounted, unmounted afterwards.
 *
 * The departure guards are registered on the route record the whole file shares, so a form left mounted would keep
 * answering the next case's navigation in place of the form that case mounted
 * @internal
 * @constant
 */
const mounted: VueWrapper[] = [];

/**
 * The answer a saved result gets
 * @internal
 * @function
 * @returns The receipt
 */
function answerRecorded(): unknown {
  return {
    current: { canonicalMatchId: MATCH_ID },
    effect: {},
    replayed: false,
  };
}

/**
 * What the endpoint answers next, set per case
 * @internal
 */
let answer: (event: H3Event) => unknown = answerRecorded;

registerEndpoint(`/api/leagues/${LEAGUE_ID}/games`, {
  handler: defineEventHandler(async (event: H3Event): Promise<unknown> => {
    sent.push((await readBody(event)) as Record<string, unknown>);

    return answer(event);
  }),
  method: 'POST',
});

registerEndpoint(`/api/leagues/${OTHER_LEAGUE_ID}/games`, {
  handler: defineEventHandler(async (event: H3Event): Promise<unknown> => {
    strays.push((await readBody(event)) as Record<string, unknown>);

    return answerRecorded();
  }),
  method: 'POST',
});

/**
 * The league's rules, as the server issues them
 * @internal
 * @function
 * @param overrides - What the case changes
 * @returns The context
 */
function context(overrides: Partial<IResultFormContext> = {}): IResultFormContext {
  return {
    authority: {
      may: true,
      mustPlay: false,
      who: 'a commissioner or manager',
    },
    configurationRevision: 7,
    earliest: '2026-09-18T12:00:00.000Z',
    formats: [GameType.SINGLES, GameType.DOUBLES],
    leagueName: 'Friday Ladder',
    now: '2026-09-20T12:00:00.000Z',
    roster: [
      { displayName: 'Ada', id: ADA },
      { displayName: 'Ben', id: BEN },
    ],
    rules: {
      matchFormat: 3,
      targetScore: { DOUBLES: 11, SINGLES: 11 },
      winningMargin: 2,
    },
    ...overrides,
  };
}

/**
 * Mounts the form at the record route, with its departure guard registered against that route's own record
 * @internal
 * @async
 * @function
 * @param overrides - What the case changes about the league
 * @returns The mounted form and the router it is guarding
 */
async function mountRouted(
  overrides: Partial<IResultFormContext> = {},
  onRecorded?: (canonicalMatchId: string, leagueId: string) => void,
): Promise<{
  router: Router;
  wrapper: VueWrapper;
}> {
  const router: Router = useNuxtApp().$router as Router;

  await router.replace(RECORD_PATH);

  const wrapper: VueWrapper = await mountSuspended(RecordForm, {
    // In the document rather than detached, so what has focus is a question the cases can ask
    attachTo: document.body,
    global: {
      provide: {
        // What a `<RouterView>` provides in the running app, so `onBeforeRouteLeave` registers on the real record
        [matchedRouteKey as unknown as string]: computed(() => router.currentRoute.value.matched[0]),
      },
    },
    props: {
      context: context(overrides),
      leagueId: LEAGUE_ID,
      onRecorded,
      recorderId: ADA,
    },
    route: RECORD_PATH,
  });

  mounted.push(wrapper);

  return { router, wrapper };
}

/**
 * Mounts the form
 * @internal
 * @async
 * @function
 * @param overrides - What the case changes about the league
 * @returns The mounted form
 */
async function mountForm(overrides: Partial<IResultFormContext> = {}): Promise<VueWrapper> {
  return (await mountRouted(overrides)).wrapper;
}

/**
 * What the page does when the form reports a result: goes to it, in the league it was recorded in.
 *
 * The page's own listener, so a case exercises the departure the loop actually makes rather than the emit alone
 * @internal
 * @function
 * @param router - The router the case is watching
 * @returns The listener
 */
function goToResult(router: Router): (canonicalMatchId: string, leagueId: string) => void {
  return (canonicalMatchId: string, leagueId: string): void => {
    void router.push(`/leagues/${leagueId}/games/${canonicalMatchId}`);
  };
}

/**
 * Finds one control by the name the template gives it
 * @internal
 * @function
 * @param wrapper - The mounted form
 * @param name - The test name
 * @returns The element, which may not exist
 */
function at(wrapper: VueWrapper, name: string): DOMWrapper<Element> {
  return wrapper.find(`[data-test="${name}"]`);
}

/**
 * Fills a complete singles result: Ada beats Ben 2-0
 * @internal
 * @async
 * @function
 * @param wrapper - The mounted form
 */
async function fillWin(wrapper: VueWrapper): Promise<void> {
  await at(wrapper, 'seat-B1').setValue(BEN);
  await at(wrapper, 'score-a-0').setValue('11');
  await at(wrapper, 'score-b-0').setValue('4');
  await at(wrapper, 'score-a-1').setValue('11');
  await at(wrapper, 'score-b-1').setValue('6');
}

/**
 * Presses Save and waits for the request it makes to settle
 * @internal
 * @async
 * @function
 * @param wrapper - The mounted form
 */
async function pressSave(wrapper: VueWrapper): Promise<void> {
  await at(wrapper, 'save').trigger('submit');
  await new Promise((resolve: (value: unknown) => void): void => {
    setTimeout(resolve, 0);
  });
  await wrapper.vm.$nextTick();
}

/**
 * Lets a navigation the form guards resolve its guards
 * @internal
 * @async
 * @function
 */
async function settled(): Promise<void> {
  // Twice: a navigation the page starts itself resolves its own guards on the round after the click
  for (let round: number = 0; round < 2; round += 1) {
    await new Promise((resolve: (value: unknown) => void): void => {
      setTimeout(resolve, 0);
    });
    await nextTick();
  }
}

/**
 * Fills a draft and attempts to leave, so the departure question is standing
 * @internal
 * @async
 * @function
 * @param wrapper - The mounted form
 * @param router - The router it is guarding
 * @param to - Where the departure is headed
 */
async function attemptLeave(wrapper: VueWrapper, router: Router, to: string = '/leagues'): Promise<void> {
  await at(wrapper, 'score-a-0').setValue('11');
  await router.push(to);
  await settled();
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    sent = [];
    strays = [];
    answer = answerRecorded;
    welcome.owed = false;
  });

  afterEach((): void => {
    while (mounted.length > 0) {
      mounted.pop()!.unmount();
    }
  });

  it('states the rules the entry will be judged by', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    expect(at(wrapper, 'caption').text()).toBe('Friday Ladder · Best of 3 · Games to 11, win by 2');
  });

  it('offers a format only where the league records more than one', async (): Promise<void> => {
    expect(at(await mountForm(), 'format-SINGLES').exists()).toBe(true);

    const single: VueWrapper = await mountForm({ formats: [GameType.SINGLES] });

    expect(at(single, 'format-SINGLES').exists()).toBe(false);
    expect(at(single, 'format-fixed').text()).toBe('Singles');
  });

  it('seats whoever is recording, and leaves the rest to them', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    expect((at(wrapper, 'seat-A1').element as HTMLSelectElement).value).toBe(ADA);
    // Nobody is in the other seat; the empty option carries no member id
    expect([ADA, BEN]).not.toContain((at(wrapper, 'seat-B1').element as HTMLSelectElement).value);
  });

  it('starts at the fewest games a best of three can take', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    expect(at(wrapper, 'score-a-0').exists()).toBe(true);
    expect(at(wrapper, 'score-a-1').exists()).toBe(true);
    expect(at(wrapper, 'score-a-2').exists()).toBe(false);
  });

  it('grows a row once what is entered leaves the match open', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    await at(wrapper, 'score-a-0').setValue('11');
    await at(wrapper, 'score-b-0').setValue('4');
    await at(wrapper, 'score-a-1').setValue('6');
    await at(wrapper, 'score-b-1').setValue('11');

    expect(at(wrapper, 'score-a-2').exists()).toBe(true);
  });

  it('says where the match stands as somebody types', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    expect(at(wrapper, 'derived-line').text()).toBe('Match not decided yet');

    await fillWin(wrapper);

    expect(at(wrapper, 'derived-line').text()).toBe('Ada win 2-0');
  });

  it('holds a score as typed rather than as a number', async (): Promise<void> => {
    // type="number" would be cast by Vue and a half-typed box would stop being the string it is
    const wrapper: VueWrapper = await mountForm();

    expect(at(wrapper, 'score-a-0').attributes('type')).toBe('text');
    expect(at(wrapper, 'score-a-0').attributes('inputmode')).toBe('numeric');
  });

  it('puts a row’s message under that row', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    await at(wrapper, 'seat-B1').setValue(BEN);
    await at(wrapper, 'score-a-0').setValue('13');
    await at(wrapper, 'score-b-0').setValue('10');

    expect(at(wrapper, 'row-problem-0').text()).toContain('not a finished game in this league');
  });

  it('will not save while anything is refused', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    expect(at(wrapper, 'save').attributes('disabled')).toBeDefined();

    await fillWin(wrapper);

    expect(at(wrapper, 'save').attributes('disabled')).toBeUndefined();
  });

  it('sends the league revision it drew from, and the instant it was given', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ acknowledgement: null, expectedLeagueRevision: 7 });
    expect(sent[0]?.clientOperationId).toEqual(expect.any(String));

    const submission = sent[0]?.submission as { games: unknown[]; playedAt: string };

    expect(submission.games).toHaveLength(2);
    expect(submission.playedAt).toBe('2026-09-20T12:00:00.000Z');
  });

  it('reports the match it created so the page can go to it', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID, LEAGUE_ID]]);
  });

  it('keeps the draft when a duplicate is warned about, and records anyway on the second press', async (): Promise<void> => {
    // Two identical honest matches in one evening are possible, and this is what keeps them possible
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 409);
      answer = answerRecorded;

      return {
        acknowledgement: 'token-1',
        candidates: [{ canonicalMatchId: MATCH_ID, playedAt: WARNED_AT }],
        message: WARNED,
        refusal: 'PROBABLE_DUPLICATE',
      };
    };

    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(at(wrapper, SERVER_MESSAGE).text()).toBe(WARNED);
    expect(at(wrapper, 'duplicates').exists()).toBe(true);
    // The draft is untouched: a refusal never clears it
    expect((at(wrapper, 'score-a-0').element as HTMLInputElement).value).toBe('11');

    await pressSave(wrapper);

    expect(sent).toHaveLength(2);
    expect(sent[0]?.acknowledgement).toBeNull();
    expect(sent[1]?.acknowledgement).toBe('token-1');
    expect(sent[1]?.clientOperationId).toBe(sent[0]?.clientOperationId);
    expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID, LEAGUE_ID]]);
  });

  it('names each match the warning listed by when it was played', async (): Promise<void> => {
    // Two candidates were two links reading the same sentence, which is not a choice between them
    const first: string = WARNED_AT;
    const second: string = '2026-09-20T09:30:00.000Z';

    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 409);

      return {
        acknowledgement: 'token-1',
        candidates: [
          { canonicalMatchId: MATCH_ID, playedAt: first },
          { canonicalMatchId: OTHER_MATCH_ID, playedAt: second },
        ],
        message: WARNED,
        refusal: 'PROBABLE_DUPLICATE',
      };
    };

    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    const links: DOMWrapper<Element>[] = at(wrapper, 'duplicates').findAll('a');

    expect(links).toHaveLength(2);
    expect(links[0]?.text()).toBe(`Result recorded for ${toLocalDateTime(first)}`);
    expect(links[1]?.text()).toBe(`Result recorded for ${toLocalDateTime(second)}`);
  });

  it('redraws the caption to the rules the league moved to', async (): Promise<void> => {
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 409);

      return {
        context: context({
          configurationRevision: 8,
          rules: {
            matchFormat: 5,
            targetScore: { SINGLES: 21 },
            winningMargin: 3,
          },
        }),
        message: 'This league’s rules changed while you were entering this.',
        refusal: 'STALE_LEAGUE_RULES',
      };
    };

    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(at(wrapper, 'caption').text()).toBe('Friday Ladder · Best of 5 · Games to 21, win by 3');
    expect(at(wrapper, SERVER_MESSAGE).text()).toContain('rules changed');
  });

  it('shows a refusal above Save without clearing what was entered', async (): Promise<void> => {
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 422);

      return { message: UNRECORDABLE };
    };

    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(at(wrapper, SERVER_MESSAGE).text()).toBe(UNRECORDABLE);
    expect((at(wrapper, 'score-b-1').element as HTMLInputElement).value).toBe('6');
    expect(wrapper.emitted('recorded')).toBeUndefined();
  });

  it('asks who retired and how many games, and only when one did', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountForm();

    expect(at(wrapper, 'retired-seat').exists()).toBe(false);

    await at(wrapper, 'ending-retired').setValue();

    expect(at(wrapper, 'retired-seat').exists()).toBe(true);
    expect(at(wrapper, 'games-played').exists()).toBe(true);
  });

  it('says which box is which side, on the page and in the accessibility tree', async (): Promise<void> => {
    // One label reading Game 1 around both inputs left nothing saying which side either of them was
    const wrapper: VueWrapper = await mountForm();

    const heads: DOMWrapper<Element>[] = at(wrapper, 'score-heads').findAll('span');

    expect(heads[1]?.text()).toBe('Side A');
    expect(heads[2]?.text()).toBe('Side B');
    expect(at(wrapper, 'score-a-0').attributes(ARIA_LABEL)).toBe('Game 1, Side A');
    expect(at(wrapper, 'score-b-0').attributes(ARIA_LABEL)).toBe('Game 1, Side B');
    expect(at(wrapper, 'score-b-1').attributes(ARIA_LABEL)).toBe('Game 2, Side B');
  });

  it('names the guest field with something that survives being typed in', async (): Promise<void> => {
    // A placeholder is not a label: it goes away at the first keystroke
    const wrapper: VueWrapper = await mountForm();

    await at(wrapper, 'seat-B1').setValue('GUEST');

    expect(at(wrapper, 'guest-B1').attributes(ARIA_LABEL)).toBe('Guest name');
  });

  it('links the result a reused operation id already wrote', async (): Promise<void> => {
    // The refusal tells the person to open the result that exists; without the link it names nothing they can reach
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 409);

      return {
        existing: { canonicalMatchId: MATCH_ID },
        message: CHANGED_BODY,
        refusal: 'OPERATION_BODY_CHANGED',
      };
    };

    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(at(wrapper, 'existing').find('a').attributes('href')).toBe(`/leagues/${LEAGUE_ID}/games/${MATCH_ID}`);
  });

  it('says nothing about a result the refusal did not name', async (): Promise<void> => {
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 409);

      return { message: CHANGED_BODY, refusal: 'OPERATION_BODY_CHANGED' };
    };

    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(at(wrapper, 'existing').exists()).toBe(false);
  });

  describe('a save whose outcome nobody knows', (): void => {
    it('says it is in flight and takes no second press', async (): Promise<void> => {
      let release: () => void = (): void => undefined;

      answer = (): unknown =>
        new Promise((resolve: (value: unknown) => void): void => {
          release = (): void => resolve(answerRecorded());
        });

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await at(wrapper, 'save').trigger('submit');
      await wrapper.vm.$nextTick();

      expect(at(wrapper, 'save').text()).toBe('Recording…');
      expect(at(wrapper, 'save').attributes('disabled')).toBeDefined();

      // A second submit while the first is in flight is the double-click this state exists to refuse
      await at(wrapper, 'save').trigger('submit');
      release();
      await settled();

      expect(sent).toHaveLength(1);
      expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID, LEAGUE_ID]]);
    });

    it('holds the request open rather than calling it a failure', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);

        return { message: 'Pongifi could not record this result right now.' };
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);

      expect(at(wrapper, SERVER_MESSAGE).text()).toBe('Pongifi could not tell whether the result was recorded. Check');
      expect(at(wrapper, 'save').text()).toBe('Check');
      expect(at(wrapper, 'save').attributes('disabled')).toBeUndefined();
      expect((at(wrapper, 'score-a-0').element as HTMLInputElement).value).toBe('11');
      expect(wrapper.emitted('recorded')).toBeUndefined();
    });

    it('checks with the request it already sent, not with what the form is showing now', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);

        return {};
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);

      // Edited between the save and the check. The server keys creation on a digest of the body, so a check
      // rebuilt from this would be a different operation and the save being checked on would stay unresolved
      await at(wrapper, 'score-b-1').setValue('9');
      answer = answerRecorded;
      await pressSave(wrapper);

      expect(sent).toHaveLength(2);
      expect(sent[1]).toEqual(sent[0]);
      expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID, LEAGUE_ID]]);
    });

    it('offers Check again when the check itself goes unanswered', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 500);

        return {};
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);

      expect(sent).toHaveLength(2);
      expect(sent[1]).toEqual(sent[0]);
      expect(at(wrapper, 'save').text()).toBe('Check');
    });

    it('keeps the save outstanding when the check is refused before the receipt is looked for', async (): Promise<void> => {
      // A spent write allowance is read in front of the league's lock, so it says only that the check did not run.
      // Calling it the answer would tell somebody a save that may well have committed did not
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);
        answer = (again: H3Event): unknown => {
          setResponseStatus(again, 429);

          return { message: 'You have made too many changes just now.' };
        };

        return {};
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);

      expect(at(wrapper, SERVER_MESSAGE).text()).toBe(
        'You have made too many changes just now. Your earlier save may still have gone through. Check again.',
      );
      expect(at(wrapper, 'save').text()).toBe('Check');

      // And the check is still the first attempt's request, not a new one
      answer = answerRecorded;
      await pressSave(wrapper);

      expect(sent).toHaveLength(3);
      expect(sent[2]).toEqual(sent[0]);
      expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID, LEAGUE_ID]]);
    });

    it('keeps it outstanding for a malformed-body refusal too, which the shape check answers first', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);
        answer = (again: H3Event): unknown => {
          setResponseStatus(again, 400);

          return { message: 'That request was not in a form this page sends.' };
        };

        return {};
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);

      expect(at(wrapper, SERVER_MESSAGE).text()).toContain('Your earlier save may still have gone through.');
      expect(at(wrapper, 'save').text()).toBe('Check');
    });

    it('leaves a first refusal an ordinary refusal, with nothing outstanding to check on', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 429);

        return { message: 'You have made too many changes just now.' };
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);

      expect(at(wrapper, SERVER_MESSAGE).text()).toBe('You have made too many changes just now.');
      expect(at(wrapper, 'save').text()).toBe('Record result');
    });

    it('checks where its own save went, whatever league the page is showing by then', async (): Promise<void> => {
      // A receipt is keyed by the account, the operation and its id; a check reassembled from the props of a page
      // that has since moved would be asking a league the original operation was never made against
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);

        return {};
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);

      await wrapper.setProps({ leagueId: OTHER_LEAGUE_ID });
      answer = answerRecorded;
      await pressSave(wrapper);

      expect(strays).toHaveLength(0);
      expect(sent).toHaveLength(2);
      expect(sent[1]).toEqual(sent[0]);
    });

    it('takes an answered check as the answer, and goes back to saving', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);
        answer = (again: H3Event): unknown => {
          setResponseStatus(again, 422);

          return { message: UNRECORDABLE };
        };

        return {};
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);

      expect(at(wrapper, SERVER_MESSAGE).text()).toBe(UNRECORDABLE);
      expect(at(wrapper, 'save').text()).toBe('Record result');
      expect((at(wrapper, 'score-b-1').element as HTMLInputElement).value).toBe('6');
    });
  });

  describe('leaving a draft behind', (): void => {
    it('asks the settings editor’s question, and an unanswered one is not permission', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();
      const first: HTMLInputElement = at(wrapper, 'score-a-0').element as HTMLInputElement;

      first.focus();
      await attemptLeave(wrapper, router);

      expect(at(wrapper, 'leave-dialog').attributes('aria-modal')).toBe('true');
      expect(at(wrapper, 'leave-dialog').attributes('role')).toBe('dialog');
      expect(wrapper.text()).toContain(LEAVE_PROMPT);
      expect(at(wrapper, LEAVE).text()).toBe('Leave');
      expect(at(wrapper, STAY).text()).toBe('Stay');
      expect(router.currentRoute.value.path).toBe(RECORD_PATH);

      // The question standing is not an answer to it
      await router.push('/profile');
      await settled();

      expect(router.currentRoute.value.path).toBe(RECORD_PATH);
      expect(wrapper.text()).toContain(LEAVE_PROMPT);

      // Nor does it re-ask: the second attempt leaves the standing question, and where it came from, alone
      await at(wrapper, STAY).trigger('click');
      await settled();

      expect(document.activeElement).toBe(first);
    });

    it('keeps the draft when the answer is Stay, and gives focus back', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();
      const first: HTMLInputElement = at(wrapper, 'score-a-0').element as HTMLInputElement;

      first.focus();
      await attemptLeave(wrapper, router);

      expect(document.activeElement).toBe(at(wrapper, STAY).element);

      await at(wrapper, STAY).trigger('click');
      await settled();

      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
      expect(first.value).toBe('11');
      expect(router.currentRoute.value.path).toBe(RECORD_PATH);
      // Back where the departure was attempted from, rather than at the top of the document
      expect(document.activeElement).toBe(first);
    });

    it('departs only when the answer is Leave', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();

      await attemptLeave(wrapper, router);
      await at(wrapper, LEAVE).trigger('click');

      await vi.waitFor((): void => {
        expect(router.currentRoute.value.path).toBe('/leagues');
      });

      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
    });

    it('keeps the two answers in a cycle of their own', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();

      await attemptLeave(wrapper, router);
      await at(wrapper, STAY).trigger('keydown.tab');

      expect(document.activeElement).toBe(at(wrapper, LEAVE).element);

      await at(wrapper, LEAVE).trigger('keydown.tab', { shiftKey: true });

      expect(document.activeElement).toBe(at(wrapper, STAY).element);
    });

    it('reads Escape as the answer that changes nothing', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();

      await attemptLeave(wrapper, router);
      await at(wrapper, 'leave-dialog').trigger('keydown.esc');
      await settled();

      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
      expect((at(wrapper, 'score-a-0').element as HTMLInputElement).value).toBe('11');
      expect(router.currentRoute.value.path).toBe(RECORD_PATH);
    });

    it('does not ask about a draft nobody has typed in', async (): Promise<void> => {
      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();

      await router.push('/leagues');
      await settled();

      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
      expect(router.currentRoute.value.path).toBe('/leagues');
    });
  });

  describe('reaching the result it recorded', (): void => {
    it('goes to the game without asking about the draft that became it', async (): Promise<void> => {
      // The draft is still dirty the moment a save comes back recorded, and the guard was asking about it: the loop
      // this page exists for ended in Leave without saving? and a navigation the form itself refused
      const router: Router = useNuxtApp().$router as Router;
      const { wrapper }: { wrapper: VueWrapper } = await mountRouted({}, goToResult(router));

      await fillWin(wrapper);
      await pressSave(wrapper);

      await vi.waitFor((): void => {
        expect(router.currentRoute.value.path).toBe(`/leagues/${LEAGUE_ID}/games/${MATCH_ID}`);
      });

      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
    });

    it('goes to the league the attempt was made against, however the page has moved since', async (): Promise<void> => {
      // The request is held whole, so the check went to the right league; the result it recorded is read there too,
      // and the edits made while the outcome was unknown are neither saved nor offered back
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);

        return {};
      };

      const router: Router = useNuxtApp().$router as Router;
      const { wrapper }: { wrapper: VueWrapper } = await mountRouted({}, goToResult(router));

      await fillWin(wrapper);
      await pressSave(wrapper);

      await wrapper.setProps({ leagueId: OTHER_LEAGUE_ID });
      await at(wrapper, 'score-b-1').setValue('9');
      answer = answerRecorded;
      await pressSave(wrapper);

      await vi.waitFor((): void => {
        expect(router.currentRoute.value.path).toBe(`/leagues/${LEAGUE_ID}/games/${MATCH_ID}`);
      });

      expect(strays).toHaveLength(0);
      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
    });
  });

  describe('a refusal about the session rather than the result', (): void => {
    it('leaves for sign-in, carrying the page back with it', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 401);

        return { message: 'Your session has ended.' };
      };

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();

      await fillWin(wrapper);
      await pressSave(wrapper);

      await vi.waitFor((): void => {
        expect(router.currentRoute.value.path).toBe('/sign-in');
      });

      expect(router.currentRoute.value.query.redirect).toBe(RECORD_PATH);
      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
    });

    it('leaves for a welcome step the account still owes', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 403);

        return { message: 'Finish setting up your account first.' };
      };

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();

      await fillWin(wrapper);
      // Owed from here rather than from the start: the record route is gated, and an account owing the step would
      // have been sent to it instead of to this page
      welcome.owed = true;
      await pressSave(wrapper);

      await vi.waitFor((): void => {
        expect(router.currentRoute.value.path).toBe('/welcome');
      });

      expect(router.currentRoute.value.query.redirect).toBe(RECORD_PATH);
      expect(wrapper.text()).not.toContain(LEAVE_PROMPT);
    });

    it('stays where it is for a 403 that owes no welcome step', async (): Promise<void> => {
      // A request from elsewhere, or a role this account does not have, is an ordinary refusal of this write and
      // there is nowhere to send anybody
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 403);

        return { message: 'This came from somewhere Pongifi does not accept.' };
      };

      const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountRouted();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await settled();

      expect(router.currentRoute.value.path).toBe(RECORD_PATH);
      expect(at(wrapper, SERVER_MESSAGE).text()).toBe('This came from somewhere Pongifi does not accept.');
    });

    it('keeps an unresolved save unresolved when it is the one that answers this way', async (): Promise<void> => {
      // A 403 is read in front of the league's lock, so it says nothing about the save being checked on, and the
      // page that stays has to still be offering Check
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);
        answer = (again: H3Event): unknown => {
          setResponseStatus(again, 403);

          return { message: 'This came from somewhere Pongifi does not accept.' };
        };

        return {};
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);

      expect(at(wrapper, SERVER_MESSAGE).text()).toContain('Your earlier save may still have gone through.');
      expect(at(wrapper, 'save').text()).toBe('Check');
    });
  });

  describe('the operation a press belongs to', (): void => {
    it('records a deliberate new result under an operation of its own', async (): Promise<void> => {
      // The id a receipt already names can never record anything else, so a second press carrying it met the same
      // conflict for as long as the page stayed open
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 409);
        answer = answerRecorded;

        return {
          existing: { canonicalMatchId: OTHER_MATCH_ID },
          message: CHANGED_BODY,
          refusal: 'OPERATION_BODY_CHANGED',
        };
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);

      await at(wrapper, 'score-b-1').setValue('9');
      await pressSave(wrapper);

      expect(sent).toHaveLength(2);
      expect(sent[1]?.clientOperationId).not.toBe(sent[0]?.clientOperationId);
      expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID, LEAGUE_ID]]);
    });

    it('holds the id through a check, and starts a new one only once the check is answered', async (): Promise<void> => {
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 503);
        answer = (again: H3Event): unknown => {
          setResponseStatus(again, 422);

          return { message: UNRECORDABLE };
        };

        return {};
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);

      // The check is the first attempt's own request, id included
      expect(sent[1]?.clientOperationId).toBe(sent[0]?.clientOperationId);

      answer = answerRecorded;
      await at(wrapper, 'score-b-1').setValue('9');
      await pressSave(wrapper);

      expect(sent).toHaveLength(3);
      expect(sent[2]?.clientOperationId).not.toBe(sent[0]?.clientOperationId);
    });

    it('leaves a warning behind once a later refusal answered the operation it belonged to', async (): Promise<void> => {
      // The token and the list belong to the operation the warning was issued about. Held past the refusal that
      // settled that operation, they kept every later press on an id the server had already answered — so a
      // deliberate new result met the same refusal for as long as the page stayed open, under a list of matches
      // that had nothing to do with the message above it
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 409);
        answer = (unanswered: H3Event): unknown => {
          setResponseStatus(unanswered, 503);
          answer = (checked: H3Event): unknown => {
            setResponseStatus(checked, 422);
            answer = answerRecorded;

            return { message: UNRECORDABLE };
          };

          return {};
        };

        return {
          acknowledgement: 'token-1',
          candidates: [{ canonicalMatchId: MATCH_ID, playedAt: WARNED_AT }],
          message: WARNED,
          refusal: 'PROBABLE_DUPLICATE',
        };
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      // The press that answers the warning, which goes unanswered, and then the check that resolves it
      await pressSave(wrapper);
      await pressSave(wrapper);

      // The check is the acknowledged press's own request, so it still carried the token the warning issued
      expect(sent[2]?.acknowledgement).toBe('token-1');
      expect(at(wrapper, SERVER_MESSAGE).text()).toBe(UNRECORDABLE);
      expect(at(wrapper, 'duplicates').exists()).toBe(false);

      await at(wrapper, 'score-b-1').setValue('9');
      await pressSave(wrapper);

      expect(sent).toHaveLength(4);
      expect(sent[3]?.acknowledgement).toBeNull();
      expect(sent[3]?.clientOperationId).not.toBe(sent[0]?.clientOperationId);
      expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID, LEAGUE_ID]]);
    });

    it('leaves it behind for a changed-body refusal too, which is the receipt itself', async (): Promise<void> => {
      // The refusal that names an occupied id is exactly the one a surviving token made unrecoverable: the next
      // press carried the same id again and met the same conflict
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 409);
        answer = (changed: H3Event): unknown => {
          setResponseStatus(changed, 409);
          answer = answerRecorded;

          return {
            existing: { canonicalMatchId: OTHER_MATCH_ID },
            message: CHANGED_BODY,
            refusal: 'OPERATION_BODY_CHANGED',
          };
        };

        return {
          acknowledgement: 'token-1',
          candidates: [{ canonicalMatchId: MATCH_ID, playedAt: WARNED_AT }],
          message: WARNED,
          refusal: 'PROBABLE_DUPLICATE',
        };
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);

      expect(at(wrapper, 'duplicates').exists()).toBe(false);
      expect(at(wrapper, 'existing').exists()).toBe(true);

      await at(wrapper, 'score-b-1').setValue('9');
      await pressSave(wrapper);

      expect(sent).toHaveLength(3);
      expect(sent[2]?.acknowledgement).toBeNull();
      expect(sent[2]?.clientOperationId).not.toBe(sent[0]?.clientOperationId);
    });

    it('answers the warning it was just given on the id that warning was about', async (): Promise<void> => {
      // The other side of the same rule: a refusal read before the receipt settles nothing, so the press that
      // answers a warning through one still continues the operation the warning named
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 409);
        answer = (limited: H3Event): unknown => {
          setResponseStatus(limited, 429);
          answer = answerRecorded;

          return { message: 'Too many saves.' };
        };

        return {
          acknowledgement: 'token-1',
          candidates: [{ canonicalMatchId: MATCH_ID, playedAt: WARNED_AT }],
          message: WARNED,
          refusal: 'PROBABLE_DUPLICATE',
        };
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);
      await pressSave(wrapper);

      expect(sent).toHaveLength(3);
      expect(sent[2]?.acknowledgement).toBe('token-1');
      expect(sent[2]?.clientOperationId).toBe(sent[0]?.clientOperationId);
    });

    it('starts nothing by itself, and nothing until the next press', async (): Promise<void> => {
      // Rotating when the refusal arrived would leave the page holding an operation nobody had asked for
      answer = (event: H3Event): unknown => {
        setResponseStatus(event, 422);

        return { message: UNRECORDABLE };
      };

      const wrapper: VueWrapper = await mountForm();

      await fillWin(wrapper);
      await pressSave(wrapper);
      await settled();

      expect(sent).toHaveLength(1);
      expect(at(wrapper, 'save').text()).toBe('Record result');
    });
  });
});
