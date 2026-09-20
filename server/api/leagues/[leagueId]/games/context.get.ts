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
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getRouterParam, type H3Event } from 'h3';

import { isUuid } from '#shared/leagues';
import type { IResultFormContext } from '#shared/results';
import { runUpstream } from '#utils/http';
import { readFormContext } from '#utils/results/queries';

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

  const context: IResultFormContext | null = await runUpstream(readFormContext(leagueId, user.id), UPSTREAM_MESSAGE);

  if (!context) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  return context;
});
