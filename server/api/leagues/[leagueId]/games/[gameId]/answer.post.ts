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
 * ███████████████████████████ #server/api/leagues/[leagueId]/games/[gameId]/answer.post.ts ████████████████████████████
 *
 * Confirms, disputes or voids a recorded result.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getRouterParam, type H3Event } from 'h3';

import type { LeagueRole } from '#shared/domain';
import { isUuid } from '#shared/leagues';
import type { IAnswerRequestBody, TRequestValidation } from '#shared/results';
import { validateAnswerBody } from '#shared/results';
import { useResultTransaction } from '#utils/db';
import { runUpstream } from '#utils/http';
import { readViewerRole } from '#utils/leagues';
import type { IResultCurrentState, IResultEffect, IResultRefusalResponse, TResultOutcome } from '#utils/results';
import { answerResult, answerResultRefusal, resolveMatchRoute } from '#utils/results';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

/**
 * What an answered result replies with: what this press did, and where the match stands now.
 *
 * Both, for the same reason a record does: a replayed press did nothing this time, and the page still has to know
 * what the result is now
 * @public
 */
export interface IAnsweredResult {
  /* Where the match stands now */
  current: IResultCurrentState;

  /* What this operation did, the first time it ran */
  effect: IResultEffect;

  /* Whether this answer came from a receipt rather than from a write made now */
  replayed: boolean;
}

/**
 * What a caller is told when the result is not theirs to answer, which is what a caller naming one that does not
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
const UPSTREAM_MESSAGE: string = 'Pongifi could not save this right now.';

/**
 * The sentinel a transaction returns when the path named no result this caller may answer.
 *
 * A value rather than a throw: the refusal has to be raised after the transaction commits, never from inside it
 * @internal
 * @constant
 */
const UNRESOLVED: unique symbol = Symbol('unresolved');

export default defineEventHandler(async (event: H3Event): Promise<IAnsweredResult | IResultRefusalResponse> => {
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

  const validated: TRequestValidation<IAnswerRequestBody> = validateAnswerBody(await readBody(event));

  if (!validated.ok) {
    throw createError({ statusCode: validated.statusCode, statusMessage: validated.message });
  }

  const { action, clientOperationId, expectedRevision, note } = validated.value;

  // League access before the path's ids are resolved against anything. Whether a game id names a real result is
  // private league data, and a session is authentication rather than access
  const role: LeagueRole | null = await runUpstream(readViewerRole(leagueId, user.id), UPSTREAM_MESSAGE);

  if (!role) {
    throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
  }

  // Resolved and answered under one transaction: two would let the match this caller resolved be superseded before
  // the press landed on it, and each round trip is paid for on every press
  const outcome: TResultOutcome | typeof UNRESOLVED = await runUpstream(
    useResultTransaction(async (transaction): Promise<TResultOutcome | typeof UNRESOLVED> => {
      const canonicalMatchId: string | null = await resolveMatchRoute(transaction, user.id, leagueId, gameId);

      if (!canonicalMatchId) {
        return UNRESOLVED;
      }

      return answerResult(transaction, user.id, {
        action,
        canonicalMatchId,
        clientOperationId,
        expectedRevision,
        note,
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

  return {
    current: outcome.current,
    effect: outcome.value,
    replayed: outcome.replayed,
  };
});
