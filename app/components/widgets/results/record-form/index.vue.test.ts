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
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import type { H3Event } from 'h3';
import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { beforeEach, describe, expect, it } from 'vitest';

import type { IResultFormContext } from '#shared/results';
import { GameType } from '#shared/rules-engine';

import RecordForm from './index.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

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
 * Every body the form sent, in order
 * @internal
 */
let sent: Record<string, unknown>[] = [];

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
 * Mounts the form
 * @internal
 * @async
 * @function
 * @param overrides - What the case changes about the league
 * @returns The mounted form
 */
async function mountForm(overrides: Partial<IResultFormContext> = {}): Promise<VueWrapper> {
  return mountSuspended(RecordForm, {
    props: {
      context: context(overrides),
      leagueId: LEAGUE_ID,
      recorderId: ADA,
    },
  });
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

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    sent = [];
    answer = answerRecorded;
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

    expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID]]);
  });

  it('keeps the draft when a duplicate is warned about, and records anyway on the second press', async (): Promise<void> => {
    // Two identical honest matches in one evening are possible, and this is what keeps them possible
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 409);
      answer = answerRecorded;

      return {
        acknowledgement: 'token-1',
        candidates: [{ canonicalMatchId: MATCH_ID, playedAt: '2026-09-20T11:00:00.000Z' }],
        message: 'This looks like a result already recorded.',
        refusal: 'PROBABLE_DUPLICATE',
      };
    };

    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(at(wrapper, 'server-message').text()).toBe('This looks like a result already recorded.');
    expect(at(wrapper, 'duplicates').exists()).toBe(true);
    // The draft is untouched: a refusal never clears it
    expect((at(wrapper, 'score-a-0').element as HTMLInputElement).value).toBe('11');

    await pressSave(wrapper);

    expect(sent).toHaveLength(2);
    expect(sent[0]?.acknowledgement).toBeNull();
    expect(sent[1]?.acknowledgement).toBe('token-1');
    expect(sent[1]?.clientOperationId).toBe(sent[0]?.clientOperationId);
    expect(wrapper.emitted('recorded')).toEqual([[MATCH_ID]]);
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
    expect(at(wrapper, 'server-message').text()).toContain('rules changed');
  });

  it('shows a refusal above Save without clearing what was entered', async (): Promise<void> => {
    answer = (event: H3Event): unknown => {
      setResponseStatus(event, 422);

      return { message: 'Some of what was entered cannot be recorded as played.' };
    };

    const wrapper: VueWrapper = await mountForm();

    await fillWin(wrapper);
    await pressSave(wrapper);

    expect(at(wrapper, 'server-message').text()).toBe('Some of what was entered cannot be recorded as played.');
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
});
