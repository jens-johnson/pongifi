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
 * ████████████████████████████ #server/api/leagues/[leagueId]/games/[gameId]/amend.post.ts ████████████████████████████
 *
 * Corrects a disputed result by appending a revision.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getRouterParam, type H3Event } from 'h3';

import type { LeagueRole } from '#shared/domain';
import { isUuid } from '#shared/leagues';
import type { IAmendRequestBody, TRequestValidation } from '#shared/results';
import { validateAmendBody } from '#shared/results';
import { useResultTransaction } from '#utils/db';
import { runUpstream } from '#utils/http';
import { readViewerRole } from '#utils/leagues';
import type { IResultCurrentState, IResultEffect, IResultRefusalResponse, TResultOutcome } from '#utils/results';
import { amendResult, answerResultRefusal, resolveMatchRoute } from '#utils/results';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

/**
 * What a corrected result replies with: what this save did, and where the match stands now
 * @public
 */
export interface IAmendedResult {
  /* Where the match stands now */
  current: IResultCurrentState;

  /* What this operation did, the first time it ran */
  effect: IResultEffect;

  /* Whether this answer came from a receipt rather than from a write made now */
  replayed: boolean;
}

/**
 * What a caller is told when the result is not theirs to correct, which is what a caller naming one that does not
 * exist is told
 * @internal
 * @constant
 */
const NOT_FOUND: string = 'That result could not be found.';

/**
 * What a caller is told when the write itself could not run
 * @internal
 * @constant
 */
const UPSTREAM_MESSAGE: string = 'Pongifi could not save this correction right now.';

/**
 * The sentinel a transaction returns when the path named no result this caller may correct.
 *
 * A value rather than a throw: the refusal has to be raised after the transaction commits, never from inside it
 * @internal
 * @constant
 */
const UNRESOLVED: unique symbol = Symbol('unresolved');

export default defineEventHandler(async (event: H3Event): Promise<IAmendedResult | IResultRefusalResponse> => {
  // A result is private league data; set before the session check so a 401 carries it too
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

  const { user } = await requireUserSession(event);

  // Before the body is read: a request from elsewhere, or one too many, is refused without being parsed
  assertSameOrigin(event);
  await assertWithinWriteRateLimit(event, user.id);

  const leagueId: string = getRouterParam(event, 'leagueId') ?? '';
  const gameId: string = getRouterParam(event, 'gameId') ?? '';

  if (!isUuid(leagueId) || !isUuid(gameId)) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  const validated: TRequestValidation<IAmendRequestBody> = validateAmendBody(await readBody(event));

  if (!validated.ok) {
    throw createError({ statusCode: validated.statusCode, statusMessage: validated.message });
  }

  const { clientOperationId, expectedRevision, submission } = validated.value;

  // League access before the path's ids are resolved against anything. Whether a game id names a real result is
  // private league data, and a session is authentication rather than access
  const role: LeagueRole | null = await runUpstream(readViewerRole(leagueId, user.id), UPSTREAM_MESSAGE);

  if (!role) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  // Resolved and corrected under one transaction: two would let the match this caller resolved be superseded before
  // the correction landed on it, and each round trip is paid for on every save
  const outcome: TResultOutcome | typeof UNRESOLVED = await runUpstream(
    useResultTransaction(async (transaction): Promise<TResultOutcome | typeof UNRESOLVED> => {
      const canonicalMatchId: string | null = await resolveMatchRoute(transaction, user.id, leagueId, gameId);

      if (!canonicalMatchId) {
        return UNRESOLVED;
      }

      // The submission travels as it arrived: the service normalizes it against the format it froze at recording,
      // and normalizing here first would measure it against the one the body claimed
      return amendResult(transaction, user.id, {
        canonicalMatchId,
        clientOperationId,
        expectedRevision,
        submission,
      });
    }),
    UPSTREAM_MESSAGE,
  );

  if (outcome === UNRESOLVED) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  // Mapped after the transaction committed, never thrown from inside it: a refusal can follow a settlement the same
  // operation performed on its way in, and throwing would roll that settlement back with it
  if (!outcome.ok) {
    return {
      ...answerResultRefusal(event, outcome.refusal, null),
      ...(outcome.details ?? {}),
    };
  }

  setResponseStatus(event, outcome.replayed ? 200 : 201);

  return {
    current: outcome.current,
    effect: outcome.value,
    replayed: outcome.replayed,
  };
});
