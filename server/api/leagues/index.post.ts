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
 * █████████████████████████████████████████ #server/api/leagues/index.post.ts █████████████████████████████████████████
 *
 * Creates a private league with the caller as its commissioner, deduplicating retries of one submission.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/leagues
 *
 * ─── AUTH ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Signed-in session with a live account that has finished /welcome
 *
 * ─── BODY ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • name
 *     - Description: league name, trimmed, 1 to 60 characters
 *     - Type: string
 *     - Required: true
 *   • abbreviation
 *     - Description: short mark, uppercased, 1 to 8 characters after uppercasing
 *     - Type: string
 *     - Required: true
 *   • description
 *     - Description: up to 280 characters; empty stores null
 *     - Type: string | null
 *     - Required: false
 *   • allowedGameTypes
 *     - Description: at least one of SINGLES, DOUBLES, CUTTHROAT
 *     - Type: GameType[]
 *     - Required: true
 *   • submissionId
 *     - Description: per-mount form identifier, repeated on every retry from that form
 *     - Type: uuid
 *     - Required: true
 *
 * ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • { leagueId } for the created league, or for the league an earlier attempt of the same submission created
 *
 * ─── THROWS ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • 400 when the body is malformed or carries a field the endpoint does not accept
 *   • 401 when there is no session, or the account no longer exists
 *   • 403 when the request did not come from Pongifi
 *   • 403 when the account still owes /welcome
 *   • 409 when the submission identifier already created a league with different details
 *   • 422 when a field value is unusable
 *   • 429 when the account has spent its write allowance
 *   • 502 when the rate limiter or the database cannot be reached
 *
 * ─── SIDE EFFECTS ────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • Inserts the league, the creator ACTIVE COMMISSIONER membership and the submission record in one statement
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, type H3Event } from 'h3';

import type {
  ICreateLeagueRequest,
  ICreateLeagueResponse,
  INotFoundResponse,
  TBodyValidationResult,
} from '#shared/leagues';
import { validateCreateLeagueBody } from '#shared/leagues';
import { runUpstream } from '#utils/http';
import type { TLeagueOperationResult } from '#utils/leagues';
import { answerRefusal, CREATE_LEAGUE_UPSTREAM_MESSAGE, createLeague } from '#utils/leagues';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

export default defineEventHandler(async (event: H3Event): Promise<ICreateLeagueResponse | INotFoundResponse> => {
  const { user } = await requireUserSession(event);

  // The answer names a private league, so it is as private as the league itself
  setResponseHeader(event, 'Cache-Control', 'private, no-store');

  // Checked before the body is read: a request from elsewhere, or one too many, is refused without being parsed at all
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const body: unknown = await readBody(event);
  const validated: TBodyValidationResult<ICreateLeagueRequest> = validateCreateLeagueBody(body);

  if (!validated.ok) {
    throw createError({ statusCode: validated.statusCode, statusMessage: validated.message });
  }

  const result: TLeagueOperationResult<ICreateLeagueResponse> = await runUpstream(
    createLeague(user.id, validated.value),
    CREATE_LEAGUE_UPSTREAM_MESSAGE,
  );

  return result.ok ? result.value : answerRefusal(event, result.refusal);
});
