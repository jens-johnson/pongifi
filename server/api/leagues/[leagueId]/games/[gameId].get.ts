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
import { ResultState } from '#shared/results';
import { useResultTransaction } from '#utils/db';
import { runUpstream } from '#utils/http';
import { readViewerRole } from '#utils/leagues';
import { resolveMatchRoute, settleDueResults } from '#utils/results';
import { readClock, readMatchView } from '#utils/results/queries';

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
   * Whether the sweep this read performed could not be completed.
   *
   * Explains an outstanding result rather than defining one: a sweep can fail over results that have nothing to do
   * with the one being read, and that must not make this result sound overdue
   */
  settlementFailed: boolean;

  /**
   * Whether this result is past its own confirmation deadline and still unsettled.
   *
   * Decided by asking the result, never by trusting the sweep's return. Settlement is bounded, so a completed batch
   * is not the same as a league that is caught up: with more overdue results than one batch holds, this result can
   * still be waiting after a sweep that reported success. The page must never render such a result as ordinarily
   * pending, whatever the reason it was not reached
   */
  settlementOutstanding: boolean;
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
  // waiting. A settlement that fails is captured as a flag rather than thrown, so the page still renders
  const settled: boolean = await useResultTransaction(async (transaction): Promise<number> =>
    settleDueResults(transaction, leagueId),
  ).then(
    (): boolean => true,
    (): boolean => false,
  );

  // Read whatever the sweep did or did not manage, and against the database's clock rather than this process's
  const [match, now]: [IMatchView | null, Date | null] = await runUpstream(
    Promise.all([readMatchView(leagueId, canonicalMatchId, user.id, role), readClock(leagueId)]),
    UPSTREAM_MESSAGE,
  );

  if (!match) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  // The result's own deadline decides this, not the sweep's return. `settleDueResults` is bounded, so a resolved
  // sweep means "a batch ran", never "the league is caught up" — with more overdue results than one batch holds,
  // this one can still be due after a sweep that succeeded
  const deadline: number | null = match.confirmationDeadline ? Date.parse(match.confirmationDeadline) : null;

  return {
    canonicalMatchId,
    match,
    settlementFailed: !settled,
    settlementOutstanding:
      match.state === ResultState.UNCONFIRMED && deadline !== null && now !== null && deadline <= now.getTime(),
  };
});
