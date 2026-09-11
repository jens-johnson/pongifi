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
 * ██████████████████████████████████ #server/api/invitations/[token]/accept.post.ts ███████████████████████████████████
 *
 * Accepts an invite for the signed-in account, or confirms it is already a member.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/invitations/:token/accept
 *
 * ─── AUTH ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Signed-in session with a live account that has finished /welcome
 *
 * ─── PARAMS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • token
 *     - Description: the 43-character invite token
 *     - Type: string
 *     - Required: true
 *
 * ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • { leagueId } for the league joined, or already an active member of
 *   • 404 { message, statusCode } when the invite cannot admit this account
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 401 when there is no session, or the account no longer exists
 *   • 403 when the request did not come from Pongifi, or the account still owes /welcome
 *   • 429 when the account has spent its write allowance
 *   • 502 when the rate limiter or the database cannot be reached
 *
 * ─── SIDE EFFECTS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Creates or reactivates the membership as an ACTIVE PLAYER and spends exactly one use, together or not at all
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { H3Event } from 'h3';
import { getRouterParam } from 'h3';

import type { IAcceptInviteResponse, INotFoundResponse } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import type { TLeagueOperationResult } from '#utils/leagues';
import { ACCEPT_INVITE_UPSTREAM_MESSAGE, acceptInvite, answerRefusal } from '#utils/leagues';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

export default defineEventHandler(async (event: H3Event): Promise<IAcceptInviteResponse | INotFoundResponse> => {
  // The request path carries the token
  // Set before the session check, so a 401 carries it too
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  const { user } = await requireUserSession(event);

  // The token is in the path, so there is no body to read; the same guards still come first
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const result: TLeagueOperationResult<IAcceptInviteResponse> = await runUpstream(
    acceptInvite(getRouterParam(event, 'token') ?? '', user.id),
    ACCEPT_INVITE_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
