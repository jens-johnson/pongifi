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
 * █████████████████████████████ #server/api/leagues/[leagueId]/invitations/index.post.ts ██████████████████████████████
 *
 * Creates a league's shareable invite link, or returns the usable one that already exists.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/leagues/:leagueId/invitations
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
 *
 * ─── BODY ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • expiresInDays
 *     - Description: 1, 7 or 30
 *     - Type: number
 *     - Required: true
 *   • maxUses
 *     - Description: positive integer, or null for no limit
 *     - Type: number | null
 *     - Required: false
 *   • previousId
 *     - Description: the last link the panel saw, or null when it has seen none
 *     - Type: uuid | null
 *     - Required: false
 *
 * ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • IInvitePanel showing the new link, or the usable link that already existed
 *   • 404 { message, statusCode } when the caller is not an active member
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 400 when the body is malformed or carries a field the endpoint does not accept
 *   • 401 when there is no session, or the account no longer exists
 *   • 403 when the request did not come from Pongifi
 *   • 403 when the caller is a player, or the account still owes /welcome
 *   • 409 when the panel named a link that is no longer the latest
 *   • 429 when the account has spent its write allowance
 *   • 502 when the rate limiter or the database cannot be reached
 *
 * ─── SIDE EFFECTS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Retires an expired or exhausted predecessor and inserts its successor in one statement
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getRouterParam, type H3Event } from 'h3';

import type { IInvitePanel, IIssueInviteRequest, INotFoundResponse, TBodyValidationResult } from '#shared/leagues';
import { validateIssueInviteBody } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import type { TLeagueOperationResult } from '#utils/leagues';
import { answerRefusal, INVITE_LINK_UPSTREAM_MESSAGE, issueInvite } from '#utils/leagues';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

export default defineEventHandler(async (event: H3Event): Promise<IInvitePanel | INotFoundResponse> => {
  // The answer carries the live token
  // Set before the session check, so a 401 carries it too
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  const { user } = await requireUserSession(event);

  // Checked before the body is read: a request from elsewhere, or one too many, is refused without being parsed at all
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const body: unknown = await readBody(event);
  const validated: TBodyValidationResult<IIssueInviteRequest> = validateIssueInviteBody(body);

  if (!validated.ok) {
    throw createError({ statusCode: validated.statusCode, statusMessage: validated.message });
  }

  const result: TLeagueOperationResult<IInvitePanel> = await runUpstream(
    issueInvite(getRouterParam(event, 'leagueId') ?? '', user.id, validated.value),
    INVITE_LINK_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
