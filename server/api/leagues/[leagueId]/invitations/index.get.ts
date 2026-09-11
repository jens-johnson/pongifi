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
 * ██████████████████████████████ #server/api/leagues/[leagueId]/invitations/index.get.ts ██████████████████████████████
 *
 * Returns a league's invite panel state to a current commissioner or manager.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/leagues/:leagueId/invitations
 *
 * ─── AUTH ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Signed-in session; the caller must be an ACTIVE COMMISSIONER or MANAGER, rechecked on every read
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
 *   • IInvitePanel: the current or most recent shareable link, with its token only while usable
 *   • 404 { message, statusCode } when the caller is not an active member
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 401 when there is no session, or the account no longer exists
 *   • 403 when the caller is a player, or the account still owes /welcome
 *   • 502 when the database cannot be reached
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { H3Event } from 'h3';
import { getRouterParam } from 'h3';

import type { IInvitePanel, INotFoundResponse } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import type { TLeagueOperationResult } from '#utils/leagues';
import { answerRefusal, INVITE_LINK_UPSTREAM_MESSAGE, readInvitePanel } from '#utils/leagues';

export default defineEventHandler(async (event: H3Event): Promise<IInvitePanel | INotFoundResponse> => {
  // The panel carries a live token, so the response is private and names no referrer when a link inside it is followed
  // Set before the session check, so a 401 carries it too
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  const { user } = await requireUserSession(event);

  const result: TLeagueOperationResult<IInvitePanel> = await runUpstream(
    readInvitePanel(getRouterParam(event, 'leagueId') ?? '', user.id),
    INVITE_LINK_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
