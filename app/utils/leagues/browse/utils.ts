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
 * ██████████████████████████████████████████ #utils/leagues/browse/utils.ts ███████████████████████████████████████████
 *
 * Route-state normalization and labels for league browsing.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ILeagueMembershipQuery } from '#shared/profile';
import { LeagueListPresentation, LeagueMembershipSort, normalizeLeagueMembershipQuery } from '#shared/profile';
import type { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import { GAME_TYPE_LABELS } from '../display';
import type { ILeagueListRouteState } from './types';

/**
 * Normalizes the leagues route query into a bounded list state.
 * @public
 * @function
 * @param input - The untrusted route query
 * @returns The normalized list state
 */
export function normalizeLeagueListRouteState(input: Readonly<Record<string, unknown>>): ILeagueListRouteState {
  const membershipQuery: ILeagueMembershipQuery = normalizeLeagueMembershipQuery(input);
  const view: unknown = Array.isArray(input.view) ? input.view[0] : input.view;

  return {
    format: membershipQuery.format,
    page: membershipQuery.page,
    presentation: view === LeagueListPresentation.CARDS ? LeagueListPresentation.CARDS : LeagueListPresentation.TABLE,
    role: membershipQuery.role,
    search: membershipQuery.search,
    sort: membershipQuery.sort,
  };
}

/**
 * Serializes meaningful list state into a compact route query.
 * @public
 * @function
 * @param state - The normalized list state
 * @returns The query fields that differ from defaults
 */
export function toLeagueListRouteQuery(state: ILeagueListRouteState): Record<string, string> {
  const query: Record<string, string> = {};

  if (state.search) {
    query.search = state.search;
  }

  if (state.role) {
    query.role = state.role;
  }

  if (state.format) {
    query.format = state.format;
  }

  if (state.sort !== LeagueMembershipSort.JOINED) {
    query.sort = state.sort;
  }

  if (state.presentation !== LeagueListPresentation.TABLE) {
    query.view = state.presentation;
  }

  if (state.page > 1) {
    query.page = String(state.page);
  }

  return query;
}

/**
 * Names a league format list in display order.
 * @public
 * @function
 * @param gameTypes - The formats to name
 * @returns The comma-separated labels
 */
export function toGameTypeListLabel(gameTypes: readonly GameType[]): string {
  return gameTypes.map((gameType: GameType): string => GAME_TYPE_LABELS[gameType]).join(', ');
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

defineSymbol(normalizeLeagueListRouteState, {
  name: 'Normalize League List Route State',
  description: 'Normalizes the leagues route query into a bounded list state.',
});

defineSymbol(toLeagueListRouteQuery, {
  name: 'To League List Route Query',
  description: 'Serializes meaningful league-list state into a compact route query.',
});

defineSymbol(toGameTypeListLabel, {
  name: 'To Game Type List Label',
  description: 'Names a league format list in display order.',
});
