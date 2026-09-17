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
 * █████████████████████████████ #components/widgets/leagues/rules-panel/index.vue.test.ts █████████████████████████████
 *
 * Mounted component tests for the rules card's disclosure, roles and laid-out rows.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import type { DOMWrapper, VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { LeagueRole } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import { GameType } from '#shared/rules-engine';

import { RULES_DISCLOSURE_REGION_ID } from './constants';
import RulesPanel from './index.vue';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Where the commissioner's action goes
 * @internal
 * @constant
 */
const SETTINGS_ROUTE: string = '/leagues/league-1/settings';

/**
 * Mounts the card as one role reads it
 * @internal
 * @function
 * @param viewerRole - The role
 * @param settings - The settings to describe
 * @returns The mounted card
 */
async function mountCard(
  viewerRole: LeagueRole,
  settings: TLeagueSettings = STANDARD_LEAGUE_SETTINGS,
): Promise<VueWrapper> {
  return mountSuspended(RulesPanel, {
    props: {
      settings,
      settingsRoute: SETTINGS_ROUTE,
      viewerRole,
    },
  });
}

/**
 * The disclosure control
 * @internal
 * @function
 * @param wrapper - The mounted card
 * @returns The control
 */
function disclosure(wrapper: VueWrapper): Omit<DOMWrapper<HTMLButtonElement>, 'exists'> {
  return wrapper.get('button');
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  it('opens closed, with the summary readable either way', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountCard(LeagueRole.COMMISSIONER);

    expect(disclosure(wrapper).attributes('aria-expanded')).toBe('false');
    expect(wrapper.get(`#${RULES_DISCLOSURE_REGION_ID}`).attributes('style')).toBe('display: none;');
    expect(wrapper.text()).toContain(
      'Singles and doubles to 11, cutthroat to 7 · win by 2 · best of 1 · results confirmed · ratings on',
    );
  });

  it('opens and closes on the heading row', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountCard(LeagueRole.COMMISSIONER);

    await disclosure(wrapper).trigger('click');

    expect(disclosure(wrapper).attributes('aria-expanded')).toBe('true');
    expect(wrapper.get(`#${RULES_DISCLOSURE_REGION_ID}`).attributes('style')).toBeUndefined();

    await disclosure(wrapper).trigger('click');

    expect(disclosure(wrapper).attributes('aria-expanded')).toBe('false');
  });

  it('offers Edit settings to a commissioner alone, outside the control that toggles', async (): Promise<void> => {
    const commissioner: VueWrapper = await mountCard(LeagueRole.COMMISSIONER);
    const action: Omit<DOMWrapper<Element>, 'exists'> = commissioner.get(`a[href="${SETTINGS_ROUTE}"]`);

    expect(action.text()).toBe('Edit settings');
    expect(disclosure(commissioner).element.contains(action.element)).toBe(false);

    const manager: VueWrapper = await mountCard(LeagueRole.MANAGER);
    const player: VueWrapper = await mountCard(LeagueRole.PLAYER);

    expect(manager.find('a').exists()).toBe(false);
    expect(player.find('a').exists()).toBe(false);
  });

  it('lays the settings out as labelled rows once it is open', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountCard(LeagueRole.COMMISSIONER);

    await disclosure(wrapper).trigger('click');

    const region: string = wrapper.get(`#${RULES_DISCLOSURE_REGION_ID}`).text();

    expect(region).toContain('Singles and doubles');
    expect(region).toContain('Serve changes every');
    expect(region).toContain('2 points');
    expect(region).toContain('Results need confirmation');
    expect(region).toContain('On · 24 hours');
  });

  it('shows no singles and doubles rules at all in a cutthroat-only league', async (): Promise<void> => {
    const wrapper: VueWrapper = await mountCard(LeagueRole.PLAYER, {
      ...STANDARD_LEAGUE_SETTINGS,
      allowedGameTypes: [GameType.CUTTHROAT],
    });

    await disclosure(wrapper).trigger('click');

    const region: string = wrapper.get(`#${RULES_DISCLOSURE_REGION_ID}`).text();

    expect(region).not.toContain('Best of');
    expect(region).not.toContain('Serve changes every');
    expect(region).not.toContain('Expedite system');
    expect(region).toContain('Cutthroat time cap');
  });
});
