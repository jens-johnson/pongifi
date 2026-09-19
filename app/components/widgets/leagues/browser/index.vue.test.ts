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
 * ███████████████████████████████ #components/widgets/leagues/browser/index.vue.test.ts ███████████████████████████████
 *
 * Mounted tests for league browsing URL state, rows, clamping and read states.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';
import type { H3Event } from 'h3';
import { getQuery } from 'h3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { Router } from 'vue-router';

import { clearNuxtData, useNuxtApp } from '#app';
import { LeagueRole } from '#shared/domain';
import type { ILeagueMembershipPage } from '#shared/profile';
import { LeagueListPresentation, LeagueMembershipSort } from '#shared/profile';
import { GameType } from '#shared/rules-engine';

import Browser from './index.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The endpoint behavior each mounted case selects.
 * @internal
 * @constant
 */
const endpoint: { read: (event: H3Event) => Promise<ILeagueMembershipPage> } = vi.hoisted(() => ({
  read: (): Promise<ILeagueMembershipPage> => Promise.reject(new Error('unstubbed')),
}));

/**
 * A populated list page with both shared rows.
 * @internal
 * @constant
 */
const PAGE: ILeagueMembershipPage = {
  filteredTotal: 2,
  page: 1,
  pageSize: 20,
  rows: [
    {
      abbreviation: 'WW',
      allowedGameTypes: [GameType.SINGLES, GameType.DOUBLES],
      description: 'Wednesday lunch games for the warehouse crew.',
      gameCount: 12,
      id: 'league-1',
      joinedAt: '2026-02-11T09:30:00.000Z',
      memberCount: 8,
      name: 'Warehouse Wednesdays',
      role: LeagueRole.PLAYER,
    },
    {
      abbreviation: 'CT',
      allowedGameTypes: [GameType.CUTTHROAT],
      description: null,
      gameCount: 1,
      id: 'league-2',
      joinedAt: '2026-01-10T09:30:00.000Z',
      memberCount: 1,
      name: 'Cutthroat Club',
      role: LeagueRole.COMMISSIONER,
    },
  ],
  unfilteredTotal: 2,
};

/**
 * Mounts the browser at one URL after clearing its stable Nuxt data key.
 * @internal
 * @function
 * @param path - The leagues URL and query
 * @returns The mounted browser and its router
 */
async function mountBrowser(path: string = '/leagues'): Promise<{ router: Router; wrapper: VueWrapper }> {
  await clearNuxtData('leagues-browser');

  const url: URL = new URL(path, 'https://pongifi.test');
  const query: Record<string, string> = Object.fromEntries(url.searchParams);
  const router: Router = useNuxtApp().$router as Router;

  const wrapper: VueWrapper = await mountSuspended(Browser, {
    // Mount the isolated widget on the public test route so account middleware
    // cannot redirect before the component reads its query state.
    route: { path: '/', query },
  });

  await flushPromises();
  await nextTick();

  return { router, wrapper };
}

/**
 * Finds a control by the words a person reads on it.
 * @internal
 * @function
 * @param wrapper - The mounted browser
 * @param label - The control label
 * @returns The matching button
 */
function button(wrapper: VueWrapper, label: string): DOMWrapper<HTMLButtonElement> {
  return wrapper
    .findAll('button')
    .find((control: DOMWrapper<Element>): boolean => control.text().trim() === label)! as DOMWrapper<HTMLButtonElement>;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    endpoint.read = (event: H3Event): Promise<ILeagueMembershipPage> => {
      const query: Record<string, unknown> = getQuery(event) as Record<string, unknown>;
      const page: number = typeof query.page === 'string' ? Number(query.page) : 1;

      return Promise.resolve({ ...PAGE, page });
    };
    registerEndpoint('/api/me/leagues', (event: H3Event): Promise<ILeagueMembershipPage> => endpoint.read(event));
  });

  it('restores filters and cards from the URL while rendering every approved row field', async (): Promise<void> => {
    const { wrapper }: { wrapper: VueWrapper } = await mountBrowser(
      `/leagues?format=${GameType.DOUBLES}&role=${LeagueRole.PLAYER}&sort=${LeagueMembershipSort.NAME}&view=${LeagueListPresentation.CARDS}`,
    );

    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe(LeagueRole.PLAYER);
    expect(wrapper.text()).toContain('Warehouse Wednesdays');
    expect(wrapper.text()).toContain('Wednesday lunch games for the warehouse crew.');
    expect(wrapper.text()).toContain('8 members');
    expect(wrapper.text()).toContain('1 member');
    expect(wrapper.text()).toContain('Singles, Doubles');
    expect(wrapper.text()).toContain('12 games');
    expect(wrapper.text()).toContain('1 game');
    expect(button(wrapper, 'Cards').attributes('aria-pressed')).toBe('true');
  });

  it('keeps cards through tablet widths and starts table controls at the desktop breakpoint', async (): Promise<void> => {
    const { wrapper }: { wrapper: VueWrapper } = await mountBrowser();
    const presentation: HTMLFieldSetElement = wrapper.get('fieldset').element as HTMLFieldSetElement;
    const tableContainer: HTMLElement = wrapper.get('table').element.parentElement!;

    expect(presentation.classList).toContain('lg:block');
    expect(presentation.classList).not.toContain('md:block');
    expect(tableContainer.classList).toContain('lg:block');
    expect(tableContainer.classList).not.toContain('md:block');
  });

  it('resets page one on a filter change and preserves the chosen sort and presentation', async (): Promise<void> => {
    const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountBrowser(
      `/leagues?page=2&sort=${LeagueMembershipSort.NAME}&view=${LeagueListPresentation.CARDS}`,
    );

    await wrapper.findAll('select')[0]!.setValue(LeagueRole.MANAGER);

    await vi.waitFor((): void => {
      expect(router.currentRoute.value.query).toMatchObject({
        role: LeagueRole.MANAGER,
        sort: LeagueMembershipSort.NAME,
        view: LeagueListPresentation.CARDS,
      });
      expect(router.currentRoute.value.query.page).toBeUndefined();
    });
  });

  it('restores the prior filter state through browser history', async (): Promise<void> => {
    const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountBrowser(
      `/leagues?sort=${LeagueMembershipSort.NAME}&view=${LeagueListPresentation.CARDS}`,
    );

    await wrapper.findAll('select')[0]!.setValue(LeagueRole.MANAGER);
    await vi.waitFor((): void => {
      expect(router.currentRoute.value.query.role).toBe(LeagueRole.MANAGER);
    });

    router.back();
    await vi.waitFor((): void => {
      expect(router.currentRoute.value.query.role).toBeUndefined();
      expect((wrapper.findAll('select')[0]!.element as HTMLSelectElement).value).toBe('');
      expect(button(wrapper, 'Cards').attributes('aria-pressed')).toBe('true');
    });

    router.forward();
    await vi.waitFor((): void => {
      expect(router.currentRoute.value.query.role).toBe(LeagueRole.MANAGER);
      expect((wrapper.findAll('select')[0]!.element as HTMLSelectElement).value).toBe(LeagueRole.MANAGER);
    });
  });

  it('does not let an obsolete response replace the newest query result', async (): Promise<void> => {
    const observedSearches: string[] = [];

    endpoint.read = async (event: H3Event): Promise<ILeagueMembershipPage> => {
      const search: string = String(getQuery(event).search ?? '');

      observedSearches.push(search);

      if (search === 'slow') {
        await new Promise<void>((resolve: () => void): void => {
          setTimeout(resolve, 40);
        });
      }

      const name: string = search ? `${search[0]!.toUpperCase()}${search.slice(1)} result` : 'Initial result';

      return Promise.resolve({
        ...PAGE,
        filteredTotal: 1,
        rows: [{ ...PAGE.rows[0]!, name }],
      });
    };

    const { router, wrapper }: { router: Router; wrapper: VueWrapper } = await mountBrowser();

    await router.push({ query: { search: 'slow' } });
    await vi.waitFor((): void => {
      expect(observedSearches).toContain('slow');
    });

    await router.push({ query: { search: 'fast' } });
    await vi.waitFor((): void => {
      expect(observedSearches).toContain('fast');
      expect(wrapper.text()).toContain('Fast result');
    });

    await new Promise<void>((resolve: () => void): void => {
      setTimeout(resolve, 50);
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Fast result');
    expect(wrapper.text()).not.toContain('Slow result');
  });

  it('replaces an out-of-range bookmark with the effective page', async (): Promise<void> => {
    endpoint.read = (): Promise<ILeagueMembershipPage> =>
      Promise.resolve({
        ...PAGE,
        filteredTotal: 21,
        page: 2,
      });

    const { router }: { router: Router } = await mountBrowser('/leagues?page=9');

    await vi.waitFor((): void => {
      expect(router.currentRoute.value.query.page).toBe('2');
    });
  });

  it('distinguishes no memberships from a filtered no-match state', async (): Promise<void> => {
    endpoint.read = (): Promise<ILeagueMembershipPage> =>
      Promise.resolve({
        ...PAGE,
        filteredTotal: 0,
        rows: [],
        unfilteredTotal: 0,
      });

    const zero: { wrapper: VueWrapper } = await mountBrowser();

    expect(zero.wrapper.text()).toContain('No leagues yet.');
    expect(zero.wrapper.find('input[type="search"]').exists()).toBe(false);

    endpoint.read = (): Promise<ILeagueMembershipPage> =>
      Promise.resolve({
        ...PAGE,
        filteredTotal: 0,
        rows: [],
        unfilteredTotal: 2,
      });

    const noMatch: { wrapper: VueWrapper } = await mountBrowser('/leagues?search=missing');

    expect(noMatch.wrapper.text()).toContain('No leagues match.');
    expect(noMatch.wrapper.text()).toContain('Clear filters');
    expect(noMatch.wrapper.find('input[type="search"]').exists()).toBe(true);
  });

  it('keeps the toolbar visible but disabled when the read fails', async (): Promise<void> => {
    endpoint.read = (): Promise<ILeagueMembershipPage> => Promise.reject(new Error('database unavailable'));

    const { wrapper }: { wrapper: VueWrapper } = await mountBrowser();

    await vi.waitFor((): void => {
      expect(wrapper.text()).toContain('Could not load your leagues.');
    });
    expect(wrapper.get('input[type="search"]').attributes('disabled')).toBeDefined();
    expect(button(wrapper, 'Retry').exists()).toBe(true);
  });
});
