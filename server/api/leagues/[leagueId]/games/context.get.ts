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
 * ████████████████████████████████ #server/api/leagues/[leagueId]/games/context.get.ts ████████████████████████████████
 *
 * The rules, roster and database clock a Record form opens with.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/leagues/:leagueId/games/context. Session required; active membership required. 404 for an unknown league, a
 * malformed id and a non-member alike.
 *
 * `?amend=<gameId>` answers the same shape for a correction instead of an entry: the rules, the format and the entry
 * window come from that match's own frozen snapshots rather than from the league, and the answer carries the disputed
 * revision the form opens on. 404 for a match this caller may not read, exactly as the result page answers.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getQuery, getRouterParam, type H3Event } from 'h3';

import type { LeagueRole } from '#shared/domain';
import { isUuid } from '#shared/leagues';
import type { IResultFormContext } from '#shared/results';
import { useResultTransaction } from '#utils/db';
import { runUpstream } from '#utils/http';
import { readViewerRole } from '#utils/leagues';
import { resolveMatchRoute } from '#utils/results';
import { readAmendContext, readFormContext } from '#utils/results/queries';

/**
 * What a caller who may not see this league is told, which is what a caller who asked for a league that does not
 * exist is told: one answer for both, so the page cannot be used to learn which leagues are real
 * @internal
 * @constant
 */
const NOT_FOUND: string = 'That league could not be found.';

/**
 * What a caller is told when the read itself could not run
 * @internal
 * @constant
 */
const UPSTREAM_MESSAGE: string = 'Pongifi could not load this league right now.';

export default defineEventHandler(async (event: H3Event): Promise<IResultFormContext> => {
  // A league's own rules and roster, and the clock a form will be initialized from
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  const { user } = await requireUserSession(event);
  const leagueId: string = getRouterParam(event, 'leagueId') ?? '';

  // Shape first, so a malformed id is the same 404 as an unknown one rather than a cast error from the database
  if (!isUuid(leagueId)) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  const amend: unknown = getQuery(event).amend;
  const context: IResultFormContext | null = await (amend === undefined
    ? runUpstream(readFormContext(leagueId, user.id), UPSTREAM_MESSAGE)
    : readCorrection(leagueId, user.id, amend));

  if (!context) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  return context;
});

/**
 * The context a correction opens on, for a caller who named a game to correct.
 *
 * Access before the path's id is resolved against anything, the same order the result page reads in: whether a game
 * id names a real result is private league data, and a session is authentication rather than access
 * @internal
 * @async
 * @function
 * @param leagueId - The league, already checked to be a UUID
 * @param userId - The account from the verified session
 * @param amend - Whatever the query said, which has not been checked to be an id at all
 * @returns The context, or null when there is nothing here this caller may correct
 */
async function readCorrection(leagueId: string, userId: string, amend: unknown): Promise<IResultFormContext | null> {
  if (!isUuid(amend)) {
    return null;
  }

  const role: LeagueRole | null = await runUpstream(readViewerRole(leagueId, userId), UPSTREAM_MESSAGE);

  if (!role) {
    return null;
  }

  // Every game of a match, and every game a superseded revision left behind, resolves to the match itself, so a
  // correction opened from any of them corrects the same result
  const canonicalMatchId: string | null = await runUpstream(
    useResultTransaction(async (transaction): Promise<string | null> =>
      resolveMatchRoute(transaction, userId, leagueId, amend),
    ),
    UPSTREAM_MESSAGE,
  );

  if (!canonicalMatchId) {
    return null;
  }

  return await runUpstream(readAmendContext(leagueId, canonicalMatchId, role), UPSTREAM_MESSAGE);
}
