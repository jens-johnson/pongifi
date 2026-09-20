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
 * ████████████████████████████████ #server/api/leagues/[leagueId]/games/index.post.ts █████████████████████████████████
 *
 * Records a played match as the league's newest result.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * POST /api/leagues/:leagueId/games. Session, same origin and write allowance required. Body: { clientOperationId,
 * expectedLeagueRevision, submission, acknowledgedDuplicates? }.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, getRouterParam, type H3Event } from 'h3';

import { isUuid } from '#shared/leagues';
import type { IRecordRequestBody, TRequestValidation } from '#shared/results';
import { normalizeSubmission, validateRecordBody } from '#shared/results';
import { useResultTransaction } from '#utils/db';
import { runUpstream } from '#utils/http';
import type { IResultCurrentState, IResultEffect, IResultRefusalResponse, TResultOutcome } from '#utils/results';
import { answerResultRefusal, recordResult } from '#utils/results';
import type { IDuplicateCandidate } from '#utils/results/queries';
import { readDuplicateCandidates } from '#utils/results/queries';
import { assertSameOrigin, assertWithinWriteRateLimit } from '#utils/write-boundary';

/**
 * What a recorded result answers with: what this write did, and where the match stands now.
 *
 * Both, because a replayed save did nothing this time and the page still has to know what exists — the receipt says
 * what the first attempt did, and the current state says what the match is now
 * @public
 */
export interface IRecordedResult {
  /* Where the match stands now */
  current: IResultCurrentState;

  /* What this operation did, the first time it ran */
  effect: IResultEffect;

  /* Whether this answer came from a receipt rather than from a write made now */
  replayed: boolean;
}

/**
 * What the page is told when this looks like a result somebody already recorded.
 *
 * A warning rather than a rule: the person is shown what was found and records anyway if they mean to, which is what
 * keeps two identical honest matches in one evening possible
 * @public
 */
export interface IProbableDuplicateResponse {
  /* The matches that look like this one */
  candidates: IDuplicateCandidate[];

  /* What to tell the person */
  message: string;

  /* Which conflict this is, so the page can tell it from the others that also carry 409 */
  refusal: 'PROBABLE_DUPLICATE';

  /* The status this answer carries */
  statusCode: number;
}

/**
 * What the duplicate warning says
 * @internal
 * @constant
 */
const DUPLICATE_MESSAGE: string = 'This looks like a result already recorded.';

/**
 * What a caller is told when the league is not theirs to record in, which is what a caller naming a league that does
 * not exist is told
 * @internal
 * @constant
 */
const NOT_FOUND: string = 'That league could not be found.';

/**
 * What a caller is told when the write itself could not run
 * @internal
 * @constant
 */
const UPSTREAM_MESSAGE: string = 'Pongifi could not record this result right now.';

export default defineEventHandler(
  async (event: H3Event): Promise<IProbableDuplicateResponse | IResultRefusalResponse | IRecordedResult> => {
    // A result is private league data; set before the session check so a 401 carries it too
    setResponseHeader(event, 'Cache-Control', 'private, no-store');
    setResponseHeader(event, 'Referrer-Policy', 'no-referrer');

    const { user } = await requireUserSession(event);

    // Before the body is read: a request from elsewhere, or one too many, is refused without being parsed
    assertSameOrigin(event);
    await assertWithinWriteRateLimit(event, user.id);

    const leagueId: string = getRouterParam(event, 'leagueId') ?? '';

    if (!isUuid(leagueId)) {
      throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
    }

    const validated: TRequestValidation<IRecordRequestBody> = validateRecordBody(await readBody(event));

    if (!validated.ok) {
      throw createError({ statusCode: validated.statusCode, statusMessage: validated.message });
    }

    const { acknowledgedDuplicates, clientOperationId, expectedLeagueRevision } = validated.value;
    const submission = normalizeSubmission(validated.value.submission);
    const candidates: IDuplicateCandidate[] = await runUpstream(
      readDuplicateCandidates(leagueId, submission),
      UPSTREAM_MESSAGE,
    );
    const unacknowledged: IDuplicateCandidate[] = candidates.filter(
      (candidate: IDuplicateCandidate): boolean => !acknowledgedDuplicates.includes(candidate.canonicalMatchId),
    );

    // Advisory, and answered before the write rather than inside it: the acknowledgement travels beside the result
    // rather than in it, so saying "record it anyway" never counts as a different body under the same operation id
    if (unacknowledged.length > 0) {
      setResponseStatus(event, 409);

      return {
        candidates: unacknowledged,
        message: DUPLICATE_MESSAGE,
        refusal: 'PROBABLE_DUPLICATE',
        statusCode: 409,
      };
    }

    const outcome: TResultOutcome = await runUpstream(
      useResultTransaction(async (transaction): Promise<TResultOutcome> =>
        recordResult(transaction, user.id, {
          clientOperationId,
          expectedLeagueRevision,
          leagueId,
          submission,
        }),
      ),
      UPSTREAM_MESSAGE,
    );

    // The outcome is mapped after the transaction committed, never thrown from inside it: a refusal can follow a
    // settlement the same operation performed on its way in, and throwing would roll that settlement back with it
    if (!outcome.ok) {
      return answerResultRefusal(event, outcome.refusal, null);
    }

    setResponseStatus(event, outcome.replayed ? 200 : 201);

    return {
      current: outcome.current,
      effect: outcome.value,
      replayed: outcome.replayed,
    };
  },
);
