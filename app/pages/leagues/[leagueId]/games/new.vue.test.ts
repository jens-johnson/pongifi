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
 * ██████████████████████████████████ #pages/leagues/[leagueId]/games/new.vue.test.ts ██████████████████████████████████
 *
 * Mounted tests for the Record page: which context it opens on, and where a correction nobody may make goes.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import type { H3Event } from 'h3';
import { defineEventHandler, getQuery } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';
import type { Router } from 'vue-router';
import { matchedRouteKey } from 'vue-router';

import type { IResultAmendment, IResultFormContext } from '#shared/results';
import { ResultEnding, Seat } from '#shared/results';
import { GameType } from '#shared/rules-engine';

import NewPage from './new.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The league the path names
 * @internal
 * @constant
 */
const LEAGUE_ID: string = 'b5e2d1ef-0000-4000-8000-000000000002';

/**
 * The match a correction is opened on
 * @internal
 * @constant
 */
const MATCH_ID: string = 'd7a4f3b1-0000-4000-8000-000000000004';

/**
 * Who is signed in
 * @internal
 * @constant
 */
const ADA: string = 'a4f1c0de-0000-4000-8000-000000000001';

/**
 * The page's own route
 * @internal
 * @constant
 */
const PATH: string = `/leagues/${LEAGUE_ID}/games/new`;

/**
 * Where a correction nobody may make sends them
 * @internal
 * @constant
 */
const GAME_PATH: string = `/leagues/${LEAGUE_ID}/games/${MATCH_ID}`;

/**
 * What the form asks before a departure would take the draft with it
 * @internal
 * @constant
 */
const LEAVE_PROMPT: string = 'Leave without saving?';

/**
 * What the dispute a correction answers said, which is how a case tells one correction's form from another's
 * @internal
 * @constant
 */
const DISPUTE_NOTE: string = 'Game three was 11-9 my way.';

mockNuxtImport('useUserSession', () => (): Record<string, unknown> => ({
  fetch: async (): Promise<void> => undefined,
  loggedIn: computed((): boolean => true),
  session: { value: {} },
  user: computed(() => ({ id: ADA, needsWelcome: false })),
}));

/**
 * What the context read answers next, set per case
 * @internal
 */
let answer: IResultFormContext;

/**
 * What the read answers for a particular correction, where one case needs two of them told apart
 * @internal
 */
let answers: Record<string, IResultFormContext> = {};

/**
 * Every query the page asked the context read with
 * @internal
 */
let asked: string[] = [];

registerEndpoint(`/api/leagues/${LEAGUE_ID}/games/context`, {
  handler: defineEventHandler((event: H3Event): unknown => {
    const amend: string = String(getQuery(event).amend ?? '');

    asked.push(amend);

    return answers[amend] ?? answer;
  }),
  method: 'GET',
});

/**
 * The correction a case opens the page on
 * @internal
 * @function
 * @returns The amendment block
 */
function amendment(): IResultAmendment {
  return {
    canonicalMatchId: MATCH_ID,
    dispute: {
      at: '2026-09-19T20:00:00.000Z',
      by: {
        displayName: 'Ben',
        guest: false,
        id: 'ben',
        member: true,
        removed: false,
      },
      note: DISPUTE_NOTE,
      redacted: false,
    },
    expectedRevision: 1,
    submission: {
      ending: ResultEnding.COMPLETED,
      gameType: GameType.SINGLES,
      games: [
        {
          a: 11,
          b: 4,
          gameNumber: 1,
        },
      ],
      playedAt: '2026-09-19T18:00:00.000Z',
      retiredSeat: null,
      seats: [
        {
          guestName: null,
          seat: Seat.A1,
          userId: ADA,
        },
        {
          guestName: 'Priyanka',
          seat: Seat.B1,
          userId: null,
        },
      ],
    },
  };
}

/**
 * The context the read answers with
 * @internal
 * @function
 * @param overrides - What the case changes
 * @returns The context
 */
function context(overrides: Partial<IResultFormContext> = {}): IResultFormContext {
  return {
    amendment: null,
    authority: {
      may: true,
      mustPlay: false,
      who: 'a commissioner or manager',
    },
    configurationRevision: 7,
    earliest: '2026-09-18T12:00:00.000Z',
    formats: [GameType.SINGLES],
    leagueName: 'Friday Ladder',
    now: '2026-09-20T12:00:00.000Z',
    roster: [{ displayName: 'Ada', id: ADA }],
    rules: {
      matchFormat: 1,
      targetScore: { SINGLES: 11 },
      winningMargin: 2,
    },
    windowHours: 48,
    ...overrides,
  };
}

/**
 * Every page a case mounted, unmounted afterwards
 * @internal
 * @constant
 */
const mounted: VueWrapper[] = [];

/**
 * Mounts the page at a route
 * @internal
 * @async
 * @function
 * @param query - What follows the path
 * @returns The mounted page and the router under it
 */
async function mountPage(query: string = ''): Promise<{ router: Router; wrapper: VueWrapper }> {
  const router: Router = useNuxtApp().$router as Router;
  const route: string = `${PATH}${query}`;

  clearNuxtData();
  await router.replace(route);

  const wrapper: VueWrapper = await mountSuspended(NewPage, {
    // In the document rather than detached, because the departure question moves focus into itself
    attachTo: document.body,
    global: {
      // What a `<RouterView>` provides in the running app, so the form's guards register on the real record and a
      // query change reaches them as the update it is
      provide: {
        [matchedRouteKey as unknown as string]: computed(() => router.currentRoute.value.matched[0]),
      },
    },
    route,
  });

  mounted.push(wrapper);

  return { router, wrapper };
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    asked = [];
    answers = {};
    answer = context();
  });

  afterEach((): void => {
    while (mounted.length > 0) {
      mounted.pop()!.unmount();
    }
  });

  it('records without asking about any result', async (): Promise<void> => {
    const { wrapper }: { wrapper: VueWrapper } = await mountPage();

    expect(asked).toEqual(['']);
    expect(wrapper.text()).toContain('Record a result');
    expect(wrapper.text()).not.toContain('Amend a result');
  });

  it('corrects the result the query names, on the form it opens pre-filled', async (): Promise<void> => {
    answer = context({ amendment: amendment() });

    const { wrapper }: { wrapper: VueWrapper } = await mountPage(`?amend=${MATCH_ID}`);

    // The read is asked for the correction rather than for the league's own rules
    expect(asked).toEqual([MATCH_ID]);
    expect(wrapper.text()).toContain('Amend a result');
    expect(wrapper.text()).toContain(DISPUTE_NOTE);
    expect(wrapper.find('[data-test="save"]').text()).toBe('Save amendment');
  });

  it('opens the correction the address changes to, and leaves the first form behind', async (): Promise<void> => {
    // A query change updates this page rather than replacing it, so without an identity of its own it would keep
    // the context and the save target it was opened with while the address named another result entirely
    answers[MATCH_ID] = context({ amendment: amendment() });

    const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountPage();

    expect(wrapper.text()).toContain('Record a result');

    await router.push(`${PATH}?amend=${MATCH_ID}`);
    await vi.waitFor((): void => {
      expect(wrapper.text()).toContain('Amend a result');
    });

    // The read was asked again, for the correction this time
    expect(asked).toEqual(['', MATCH_ID]);
    expect(wrapper.text()).toContain(DISPUTE_NOTE);
    expect(wrapper.find('[data-test="save"]').text()).toBe('Save amendment');
  });

  it('asks before exchanging one correction for another, and opens the second when it is answered', async (): Promise<void> => {
    const other: string = 'f9c6b5d3-0000-4000-8000-000000000006';

    answers[MATCH_ID] = context({ amendment: amendment() });
    answers[other] = context({
      amendment: {
        ...amendment(),
        canonicalMatchId: other,
        dispute: { ...amendment().dispute!, note: 'That was never game four.' },
      },
    });

    const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountPage(`?amend=${MATCH_ID}`);

    // A correction opens pre-filled, so there is work on it from the moment it is drawn
    await router.push(`${PATH}?amend=${other}`);
    await vi.waitFor((): void => {
      expect(wrapper.text()).toContain(LEAVE_PROMPT);
    });

    expect(router.currentRoute.value.query.amend).toBe(MATCH_ID);
    expect(asked).toEqual([MATCH_ID]);

    await wrapper.find('[data-test="leave-confirm"]').trigger('click');
    await vi.waitFor((): void => {
      expect(wrapper.text()).toContain('That was never game four.');
    });

    // The second correction's own context, and nothing carried across from the first
    expect(asked).toEqual([MATCH_ID, other]);
    expect(wrapper.text()).not.toContain(DISPUTE_NOTE);
  });

  it('opens an entry when the address stops naming a correction, carrying nothing across', async (): Promise<void> => {
    answers[MATCH_ID] = context({ amendment: amendment() });

    const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountPage(`?amend=${MATCH_ID}`);

    await router.push(PATH);
    await vi.waitFor((): void => {
      expect(wrapper.text()).toContain(LEAVE_PROMPT);
    });

    await wrapper.find('[data-test="leave-confirm"]').trigger('click');
    await vi.waitFor((): void => {
      expect(wrapper.text()).toContain('Record a result');
    });

    expect(asked).toEqual([MATCH_ID, '']);
    expect(wrapper.find('[data-test="save"]').text()).toBe('Record result');
    // The correction's scores are not an entry's draft
    expect((wrapper.find('[data-test="score-a-0"]').element as HTMLInputElement).value).toBe('');
  });

  it('sends a correction nobody may make to the result, on a later address as much as on the first', async (): Promise<void> => {
    // The page is updated rather than replaced on a query change, so the decision the page opened with would
    // otherwise stand for every correction the address named afterwards
    answers[MATCH_ID] = context({
      amendment: amendment(),
      authority: {
        may: false,
        mustPlay: false,
        who: 'a commissioner or manager',
      },
    });

    const { router }: { router: Router } = await mountPage();

    await router.push(`${PATH}?amend=${MATCH_ID}`);
    await vi.waitFor((): void => {
      expect(router.currentRoute.value.path).toBe(GAME_PATH);
    });
  });

  it('sends a correction nobody may make to the result, which says why', async (): Promise<void> => {
    // Past the bound, on a result nobody disputed, or held by somebody without the role: the page does not explain
    // any of those itself, because the result already states the one that applies
    answer = context({
      amendment: amendment(),
      authority: {
        may: false,
        mustPlay: false,
        who: 'a commissioner or manager',
      },
    });

    const { router }: { router: Router } = await mountPage(`?amend=${MATCH_ID}`);

    expect(router.currentRoute.value.path).toBe(GAME_PATH);
  });
});
