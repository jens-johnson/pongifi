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
import { normalizeSubmission, validateRecordBody } from '#shared/results';
import { useResultTransaction } from '#utils/db';
import { runUpstream } from '#utils/http';
import { readViewerRole } from '#utils/leagues';
import type { IResultCurrentState, IResultEffect, IResultRefusalResponse, TResultOutcome } from '#utils/results';
import { answerResultRefusal, recordResult, ResultRefusal } from '#utils/results';
import { readFormContext } from '#utils/results/queries';
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
 * The rules a stale-rules conflict has to redraw against.
 *
 * The only recovery the service cannot hand back itself: it refused because the league moved, and what the page
 * needs is where the league is now. Everything else a conflict needs — the candidates it found, the result this
 * operation already wrote — is decided under the lock and travels with the refusal
 * @internal
 * @async
 * @function
 * @param refusal - Why the service refused
 * @param leagueId - The league, already authorized for this caller
 * @param userId - The account from the verified session
 * @returns The context to add, or nothing for a refusal that needs none
 */
async function currentRulesFor(
  refusal: ResultRefusal,
  leagueId: string,
  userId: string,
): Promise<Record<string, unknown>> {
  if (refusal !== ResultRefusal.STALE_LEAGUE_RULES) {
    return {};
  }

  const context: IResultFormContext | null = await readFormContext(leagueId, userId);

  return context ? { context } : {};
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

    const outcome: TResultOutcome = await runUpstream(
      useResultTransaction(async (transaction): Promise<TResultOutcome> =>
        recordResult(transaction, user.id, {
          acknowledgedDuplicates,
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
        // What the refusal decided under the lock, never a snapshot read before it: an overlapping request is
        // exactly what invalidates a candidate list or an existing-result link taken a moment earlier
        ...(outcome.details ?? {}),
        ...(await currentRulesFor(outcome.refusal, leagueId, user.id)),
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
