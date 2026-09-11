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
 * █████████████████████ #server/api/leagues/[leagueId]/invitations/[invitationId]/revoke.post.ts ██████████████████████
 *
 * Revokes a league's invite link by id; repeating it on the same revoked link succeeds.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/leagues/:leagueId/invitations/:invitationId/revoke
 *
 * ─── AUTH ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Signed-in session; the caller must be an ACTIVE COMMISSIONER or MANAGER, rechecked inside the write
 *
 * ─── PARAMS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • leagueId
 *     - Description: the league identifier
 *     - Type: uuid
 *     - Required: true
 *   • invitationId
 *     - Description: the link to revoke
 *     - Type: uuid
 *     - Required: true
 *
 * ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • IInvitePanel after the revoke
 *   • 404 { message, statusCode } when the caller is not an active member
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 401 when there is no session, or the account no longer exists
 *   • 403 when the request did not come from Pongifi, the caller is a player, or the account still owes /welcome
 *   • 409 when the named link is neither pending nor already revoked in this league
 *   • 429 when the account has spent its write allowance
 *   • 502 when the rate limiter or the database cannot be reached
 *
 * ─── SIDE EFFECTS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Marks the link REVOKED; memberships made through it are untouched
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { H3Event } from 'h3';
import { getRouterParam } from 'h3';

import type { IInvitePanel, INotFoundResponse } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import type { TLeagueOperationResult } from '#utils/leagues';
import { answerRefusal, INVITE_LINK_UPSTREAM_MESSAGE, revokeInvite } from '#utils/leagues';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

export default defineEventHandler(async (event: H3Event): Promise<IInvitePanel | INotFoundResponse> => {
  const { user } = await requireUserSession(event);

  // The answer is the panel, which may carry a successor's live token
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  // The link is named by the path, so there is no body to read; the same guards still come first
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const result: TLeagueOperationResult<IInvitePanel> = await runUpstream(
    revokeInvite(getRouterParam(event, 'leagueId') ?? '', user.id, getRouterParam(event, 'invitationId') ?? ''),
    INVITE_LINK_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
