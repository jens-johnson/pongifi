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
 * ███████████████████████████████ #server/api/leagues/[leagueId]/games/[gameId].get.ts ████████████████████████████████
 *
 * One recorded match, as its page reads it, with anything due settled first.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/leagues/:leagueId/games/:gameId. Session and active membership required. Any game of the match resolves to
 * the match. 404 for an unknown league, match or non-member alike.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getRouterParam, type H3Event } from 'h3';

import type { LeagueRole } from '#shared/domain';
import { isUuid } from '#shared/leagues';
import type { IMatchView } from '#shared/results';
import { useResultTransaction } from '#utils/db';
import { runUpstream } from '#utils/http';
import { readViewerRole } from '#utils/leagues';
import { resolveMatchRoute, settleDueResults } from '#utils/results';
import { readMatchView } from '#utils/results/queries';

/**
 * A match as its page reads it, plus what the page has to know about getting there
 * @public
 */
export interface IMatchPageResponse {
  /* The match's own id, when the path named one of its other games; the page redirects to it */
  canonicalMatchId: string;

  /* The match */
  match: IMatchView;

  /**
   * Whether settlement of this league's due results could not be completed.
   *
   * The page needs this rather than an error: a result that is past its deadline and could not be settled is shown
   * with its failure and a retry, never as though it were still waiting for an answer nobody owes
   */
  settlementFailed: boolean;
}

/**
 * What a caller is told when the match is not theirs to read, which is what a caller naming one that does not exist
 * is told
 * @internal
 * @constant
 */
const NOT_FOUND: string = 'That result could not be found.';

/**
 * What a caller is told when the read itself could not run
 * @internal
 * @constant
 */
const UPSTREAM_MESSAGE: string = 'Pongifi could not load this result right now.';

export default defineEventHandler(async (event: H3Event): Promise<IMatchPageResponse> => {
  // A result is private league data
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  const { user } = await requireUserSession(event);
  const leagueId: string = getRouterParam(event, 'leagueId') ?? '';
  const gameId: string = getRouterParam(event, 'gameId') ?? '';

  // Shape first: an id that could never name a game is the same answer as one that does not, and never a cast error
  if (!isUuid(leagueId) || !isUuid(gameId)) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  const role: LeagueRole | null = await runUpstream(readViewerRole(leagueId, user.id), UPSTREAM_MESSAGE);

  if (!role) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  // Every game of a match, and every game a superseded revision left behind, resolves to the match's own page
  const canonicalMatchId: string | null = await runUpstream(
    useResultTransaction(async (transaction): Promise<string | null> =>
      resolveMatchRoute(transaction, user.id, leagueId, gameId),
    ),
    UPSTREAM_MESSAGE,
  );

  if (!canonicalMatchId) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  // Awaited, not fired and forgotten: the page must never render a result that is past its deadline as still
  // waiting. A settlement that fails is shown as a failure rather than swallowed, which is why this is a flag and
  // not a thrown error
  const settled: boolean = await useResultTransaction(async (transaction): Promise<number> =>
    settleDueResults(transaction, leagueId),
  ).then(
    (): boolean => true,
    (): boolean => false,
  );
  const match: IMatchView | null = await runUpstream(
    readMatchView(leagueId, canonicalMatchId, user.id, role),
    UPSTREAM_MESSAGE,
  );

  if (!match) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  return {
    canonicalMatchId,
    match,
    settlementFailed: !settled,
  };
});
