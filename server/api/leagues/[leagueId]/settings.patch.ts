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
 * █████████████████████████████████ #server/api/leagues/[leagueId]/settings.patch.ts ██████████████████████████████████ *
 * PATCH /api/leagues/:leagueId/settings
 *
 * ─── AUTH ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Signed-in session; the caller must be an ACTIVE member whose role covers the section, rechecked inside the write
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
 *   • section
 *     - Description: IDENTITY, FORMATS, RESULTS or RATINGS
 *     - Type: string
 *     - Required: true
 *   • revision
 *     - Description: the configuration revision the page loaded at
 *     - Type: number
 *     - Required: true
 *   • …the fields that section owns
 *     - Description: every one of them, including the ones its controls are hiding
 *     - Type: see the section field lists
 *     - Required: true
 *
 * ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • ILeagueConfiguration as persisted, at its new revision
 *   • 404 { message, statusCode } when the caller is not an active member
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 400 when the body is malformed, names no section, or leaves out a field the section owns
 *   • 401 when there is no session, or the account no longer exists
 *   • 403 when the request did not come from Pongifi
 *   • 403 when the caller's role does not cover the section, or the account still owes /welcome
 *   • 409 when the league's configuration moved since the page loaded; nothing is written
 *   • 422 when a submitted value, or the stored configuration it merges into, is outside its limits
 *   • 429 when the account has spent its write allowance
 *   • 502 when the rate limiter or the database cannot be reached
 *
 * ─── SIDE EFFECTS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Writes one section and moves the configuration revision in the same statement, or writes nothing at all
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getRouterParam, type H3Event } from 'h3';

import type {
  ILeagueConfiguration,
  INotFoundResponse,
  ISaveSettingsRequest,
  TBodyValidationResult,
} from '#shared/leagues';
import { validateSaveSettingsBody } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import type { TLeagueOperationResult } from '#utils/leagues';
import { answerRefusal, SAVE_SETTINGS_UPSTREAM_MESSAGE, saveLeagueSettings } from '#utils/leagues';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

export default defineEventHandler(async (event: H3Event): Promise<ILeagueConfiguration | INotFoundResponse> => {
  // The answer carries a league's own configuration
  // Set before the session check, so a 401 carries it too
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  const { user } = await requireUserSession(event);

  // Checked before the body is read: a request from elsewhere, or one too many, is refused without being parsed at all
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const body: unknown = await readBody(event);
  const validated: TBodyValidationResult<ISaveSettingsRequest> = validateSaveSettingsBody(body);

  if (!validated.ok) {
    throw createError({ statusCode: validated.statusCode, statusMessage: validated.message });
  }

  const result: TLeagueOperationResult<ILeagueConfiguration> = await runUpstream(
    saveLeagueSettings(getRouterParam(event, 'leagueId') ?? '', user.id, validated.value),
    SAVE_SETTINGS_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
