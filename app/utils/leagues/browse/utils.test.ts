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
 * ████████████████████████████████████████ #utils/leagues/browse/utils.test.ts ████████████████████████████████████████
 *
 * Unit tests for league-browsing route state and labels.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { LeagueRole } from '#shared/domain';
import { LeagueListPresentation, LeagueMembershipSort } from '#shared/profile';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import type { ILeagueListRouteState } from './types';
import { normalizeLeagueListRouteState, toGameTypeListLabel, toLeagueListRouteQuery } from './utils';

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(normalizeLeagueListRouteState), (): void => {
    it('restores all meaningful list state from the route query', (): void => {
      expect(
        normalizeLeagueListRouteState({
          format: GameType.DOUBLES,
          page: '3',
          role: LeagueRole.MANAGER,
          search: 'Lunch',
          sort: LeagueMembershipSort.MEMBERS,
          view: LeagueListPresentation.CARDS,
        }),
      ).toEqual({
        format: GameType.DOUBLES,
        page: 3,
        presentation: LeagueListPresentation.CARDS,
        role: LeagueRole.MANAGER,
        search: 'Lunch',
        sort: LeagueMembershipSort.MEMBERS,
      });
    });

    it('falls back to the table and bounded membership defaults for bad bookmarks', (): void => {
      expect(normalizeLeagueListRouteState({ page: '-2', view: 'grid' })).toMatchObject({
        page: 1,
        presentation: LeagueListPresentation.TABLE,
        sort: LeagueMembershipSort.JOINED,
      });
    });
  });

  describe(symbolName(toLeagueListRouteQuery), (): void => {
    it('omits defaults and keeps chosen filters, sort, view and page', (): void => {
      const state: ILeagueListRouteState = {
        format: GameType.CUTTHROAT,
        page: 2,
        presentation: LeagueListPresentation.CARDS,
        role: LeagueRole.COMMISSIONER,
        search: 'Club',
        sort: LeagueMembershipSort.NAME,
      };

      expect(toLeagueListRouteQuery(state)).toEqual({
        format: GameType.CUTTHROAT,
        page: '2',
        role: LeagueRole.COMMISSIONER,
        search: 'Club',
        sort: LeagueMembershipSort.NAME,
        view: LeagueListPresentation.CARDS,
      });
    });
  });

  describe(symbolName(toGameTypeListLabel), (): void => {
    it('renders the selected formats as short display labels', (): void => {
      expect(toGameTypeListLabel([GameType.SINGLES, GameType.CUTTHROAT])).toBe('Singles, Cutthroat');
    });
  });
});
