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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computed } from 'vue';
import type { Router } from 'vue-router';

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
 * Every query the page asked the context read with
 * @internal
 */
let asked: string[] = [];

registerEndpoint(`/api/leagues/${LEAGUE_ID}/games/context`, {
  handler: defineEventHandler((event: H3Event): unknown => {
    asked.push(String(getQuery(event).amend ?? ''));

    return answer;
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
      note: 'Game three was 11-9 my way.',
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

  const wrapper: VueWrapper = await mountSuspended(NewPage, { route });

  mounted.push(wrapper);

  return { router, wrapper };
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    asked = [];
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
    expect(wrapper.text()).toContain('Game three was 11-9 my way.');
    expect(wrapper.find('[data-test="save"]').text()).toBe('Save amendment');
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
