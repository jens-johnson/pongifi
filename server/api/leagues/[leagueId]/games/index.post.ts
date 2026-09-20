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

import type { LeagueRole } from '#shared/domain';
import { isUuid } from '#shared/leagues';
import type { IRecordRequestBody, IResultFormContext, TRequestValidation } from '#shared/results';
import { normalizeSubmission, ResultOperation, validateRecordBody } from '#shared/results';
import { useResultTransaction } from '#utils/db';
import { runUpstream } from '#utils/http';
import { readViewerRole } from '#utils/leagues';
import type { IResultCurrentState, IResultEffect, IResultRefusalResponse, TResultOutcome } from '#utils/results';
import { answerResultRefusal, recordResult, ResultRefusal } from '#utils/results';
import type { IDuplicateCandidate, IOperationReceipt } from '#utils/results/queries';
import { readDuplicateCandidates, readFormContext, readOperationReceipt } from '#utils/results/queries';
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

/**
 * What a conflict hands the page to recover with.
 *
 * A name tells the page which conflict it met; it does not tell it what to draw. Stale rules need the rules that are
 * current now, or the caption cannot redraw and Save cannot be re-enabled against something the person has seen. A
 * reused key with a changed body needs the match that already exists, or "open the result that exists" links
 * nowhere. Both reads are authorized by the caller already having been admitted to this league
 * @internal
 * @async
 * @function
 * @param refusal - Why the service refused
 * @param leagueId - The league, already authorized for this caller
 * @param userId - The account from the verified session
 * @param receipt - What this operation had already written, when it had
 * @returns The fields to add to the conflict, which is nothing for a conflict that needs none
 */
async function recoveryFor(
  refusal: ResultRefusal,
  leagueId: string,
  userId: string,
  receipt: IOperationReceipt | null,
): Promise<Record<string, unknown>> {
  if (refusal === ResultRefusal.STALE_LEAGUE_RULES) {
    const context: IResultFormContext | null = await readFormContext(leagueId, userId);

    return context ? { context } : {};
  }

  if (refusal === ResultRefusal.OPERATION_BODY_CHANGED && receipt) {
    return { existing: { canonicalMatchId: receipt.canonicalMatchId } };
  }

  return {};
}

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

    // League access before anything is read about the league. A match id and a play time are private data, and the
    // duplicate warning below would otherwise answer with both to anybody who guessed a league id and posted a
    // matching scoreline — a session is authentication, not access
    const role: LeagueRole | null = await runUpstream(readViewerRole(leagueId, user.id), UPSTREAM_MESSAGE);

    if (!role) {
      throw createError({ statusCode: 404, statusMessage: NOT_FOUND });
    }

    // A save whose response was lost has already created its match, so the identical retry now matches its own
    // creation. Warning about that would hide the receipt the service is holding for exactly this case, so only an
    // operation that has never committed is fresh enough to warn about
    const receipt: IOperationReceipt | null = await runUpstream(
      readOperationReceipt(user.id, ResultOperation.CREATE, clientOperationId),
      UPSTREAM_MESSAGE,
    );

    if (!receipt) {
      const candidates: IDuplicateCandidate[] = await runUpstream(
        readDuplicateCandidates(leagueId, user.id, submission),
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
      return {
        ...answerResultRefusal(event, outcome.refusal, null),
        ...(await recoveryFor(outcome.refusal, leagueId, user.id, receipt)),
      };
    }

    setResponseStatus(event, outcome.replayed ? 200 : 201);

    return {
      current: outcome.current,
      effect: outcome.value,
      replayed: outcome.replayed,
    };
  },
);
