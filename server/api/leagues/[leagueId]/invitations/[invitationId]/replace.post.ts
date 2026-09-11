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
 * █████████████████████ #server/api/leagues/[leagueId]/invitations/[invitationId]/replace.post.ts █████████████████████
 *
 * Replaces a league's invite link with a new one, only when the named link is still current.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/leagues/:leagueId/invitations/:invitationId/replace
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
 *     - Description: the link the caller believes is current
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
 *
 * ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • IInvitePanel showing the replacement
 *   • 404 { message, statusCode } when the caller is not an active member
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 400 when the body is malformed or carries a field the endpoint does not accept
 *   • 401 when there is no session, or the account no longer exists
 *   • 403 when the request did not come from Pongifi
 *   • 403 when the caller is a player, or the account still owes /welcome
 *   • 409 when the named link was already replaced or revoked
 *   • 429 when the account has spent its write allowance
 *   • 502 when the rate limiter or the database cannot be reached
 *
 * ─── SIDE EFFECTS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Revokes the named link and inserts its replacement in one statement; memberships are untouched
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getRouterParam, type H3Event } from 'h3';

import type { IInviteLinkOptions, IInvitePanel, INotFoundResponse, TBodyValidationResult } from '#shared/leagues';
import { validateReplaceInviteBody } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import type { TLeagueOperationResult } from '#utils/leagues';
import { answerRefusal, INVITE_LINK_UPSTREAM_MESSAGE, replaceInvite } from '#utils/leagues';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

export default defineEventHandler(async (event: H3Event): Promise<IInvitePanel | INotFoundResponse> => {
  const { user } = await requireUserSession(event);

  // The answer carries the replacement's live token
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  // Checked before the body is read: a request from elsewhere, or one too many, is refused without being parsed at all
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const body: unknown = await readBody(event);
  const validated: TBodyValidationResult<IInviteLinkOptions> = validateReplaceInviteBody(body);

  if (!validated.ok) {
    throw createError({ statusCode: validated.statusCode, statusMessage: validated.message });
  }

  const result: TLeagueOperationResult<IInvitePanel> = await runUpstream(
    replaceInvite(
      getRouterParam(event, 'leagueId') ?? '',
      user.id,
      getRouterParam(event, 'invitationId') ?? '',
      validated.value,
    ),
    INVITE_LINK_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
