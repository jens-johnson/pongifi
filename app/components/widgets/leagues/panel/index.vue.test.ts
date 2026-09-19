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
 * ████████████████████████████████ #components/widgets/leagues/panel/index.vue.test.ts ████████████████████████████████
 *
 * Mounted tests for the five-row Home leagues panel and total.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearNuxtData } from '#app';
import { LeagueRole } from '#shared/domain';
import type { ILeagueMembership, ILeagueMembershipPage } from '#shared/profile';
import { GameType } from '#shared/rules-engine';

import Panel from './index.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Builds one compact Home row.
 * @internal
 * @function
 * @param index - The row number
 * @returns A membership row
 */
function membership(index: number): ILeagueMembership {
  return {
    abbreviation: `L${index}`,
    allowedGameTypes: [GameType.SINGLES],
    description: `League ${index} description`,
    gameCount: index,
    id: `league-${index}`,
    joinedAt: '2026-02-11T09:30:00.000Z',
    memberCount: index + 1,
    name: `League ${index}`,
    role: LeagueRole.PLAYER,
  };
}

/**
 * The first five memberships from a six-league account.
 * @internal
 * @constant
 */
const PAGE: ILeagueMembershipPage = {
  filteredTotal: 6,
  page: 1,
  pageSize: 5,
  rows: [1, 2, 3, 4, 5].map((index: number): ILeagueMembership => membership(index)),
  unfilteredTotal: 6,
};

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach(async (): Promise<void> => {
    await clearNuxtData('home-leagues');
    registerEndpoint('/api/me/leagues', (): Promise<ILeagueMembershipPage> => Promise.resolve(PAGE));
  });

  it('caps Home at five richer rows and links through the unfiltered total', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountSuspended(Panel);

    await flushPromises();

    expect(wrapper.text()).toContain('6 leagues');
    expect(wrapper.text()).toContain('Player · 2 members · Singles · Joined February 2026');
    expect(wrapper.text()).toContain('See all 6 leagues');
    expect(wrapper.findAll('a[href^="/leagues/"]')).toHaveLength(5);
  });

  it('uses singular member copy for a one-person league', async (): Promise<void> => {
    registerEndpoint('/api/me/leagues', (): Promise<ILeagueMembershipPage> =>
      Promise.resolve({
        ...PAGE,
        filteredTotal: 1,
        rows: [{ ...membership(0), memberCount: 1 }],
        unfilteredTotal: 1,
      }),
    );

    const wrapper: VueWrapper = await mountSuspended(Panel);

    await flushPromises();

    expect(wrapper.text()).toContain('Player · 1 member · Singles · Joined February 2026');
    expect(wrapper.text()).not.toContain('1 members');
  });
});
