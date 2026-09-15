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
 * ███████████████████████████████████ #server/api/invitations/[token]/index.get.ts ████████████████████████████████████
 *
 * Looks an invite token up: an active member is sent to their league, anyone else sees a usable invite summary.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/invitations/:token
 *
 * ─── AUTH ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • None required; a session only decides whether an active member is sent home
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
 *   • { kind: MEMBER, leagueId } for a signed-in active member, whatever state the link is in
 *   • { kind: INVITE, leagueName, inviterName, memberCount } for a usable invite
 *   • 404 { message, statusCode } for an unknown, expired, revoked, exhausted or refused invite, identical in every
 *     case
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 429 when the client address has spent its lookup allowance
 *   • 502 when the rate limiter or the database cannot be reached
 *
 * ─── SIDE EFFECTS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Counts one lookup against the hashed client address
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { H3Event } from 'h3';
import { getRouterParam } from 'h3';

import type { INotFoundResponse, TInviteLookup } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import { assertWithinInviteLookupRateLimit } from '#utils/invite-lookup-limit';
import type { TLeagueOperationResult } from '#utils/leagues';
import { answerRefusal, INVITE_LOOKUP_UPSTREAM_MESSAGE, lookupInvite } from '#utils/leagues';

export default defineEventHandler(async (event: H3Event): Promise<INotFoundResponse | TInviteLookup> => {
  // Set before anything can fail: the request path carries the token, and so does every answer's context
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  // Every lookup is counted, valid token or not, before the database is touched
  await assertWithinInviteLookupRateLimit(event);

  // Signed out is a normal state here; the session only decides whether an active member is sent home
  const { user } = await getUserSession(event);

  const result: TLeagueOperationResult<TInviteLookup> = await runUpstream(
    lookupInvite(getRouterParam(event, 'token') ?? '', user?.id ?? null),
    INVITE_LOOKUP_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
