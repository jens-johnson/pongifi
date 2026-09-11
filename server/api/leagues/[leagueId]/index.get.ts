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
 * ████████████████████████████████████ #server/api/leagues/[leagueId]/index.get.ts ████████████████████████████████████
 *
 * Returns a league and its active roster to one of its active members.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/leagues/:leagueId
 *
 * ─── AUTH ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Signed-in session; the caller must be an ACTIVE member with a live, welcome-complete account
 *
 * ─── PARAMS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • leagueId
 *     - Description: the league identifier
 *     - Type: uuid
 *     - Required: true
 *
 * ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • ILeagueDetail: name, short mark, description, settings, roster and the caller role; never invitation data
 *   • 404 { message, statusCode } for an unknown league, a malformed id, or a league the caller is not an active member
 *     of, identical in every case
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 401 when there is no session, or the account no longer exists
 *   • 403 when the account still owes /welcome
 *   • 502 when the database cannot be reached
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { H3Event } from 'h3';
import { getRouterParam } from 'h3';

import type { ILeagueDetail, INotFoundResponse } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import type { TLeagueOperationResult } from '#utils/leagues';
import { answerRefusal, READ_LEAGUE_UPSTREAM_MESSAGE, readLeagueDetail } from '#utils/leagues';

export default defineEventHandler(async (event: H3Event): Promise<ILeagueDetail | INotFoundResponse> => {
  const { user } = await requireUserSession(event);

  // Set before anything can fail, so the not-found answer carries the same policy as the league it stands in for
  setResponseHeader(event, 'Cache-Control', 'private, no-store');

  const result: TLeagueOperationResult<ILeagueDetail> = await runUpstream(
    readLeagueDetail(getRouterParam(event, 'leagueId') ?? '', user.id),
    READ_LEAGUE_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
