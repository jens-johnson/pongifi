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
 * ███████████████████████████████████████████ #server/utils/results/http.ts ███████████████████████████████████████████
 *
 * What a refused result write answers with: the status, the words, and where the match stands now.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { H3Event } from 'h3';
import { createError, setResponseStatus } from 'h3';

import { ResultRefusal } from './enums';
import type { IResultCurrentState } from './types';

/**
 * The status each refusal answers with.
 *
 * The four conflicts the page has to tell apart all carry 409, and are distinguished by the refusal they name rather
 * than by the status: a stale league rule asks the person to read the new rules, a stale result redraws the page, a
 * reused key with a changed body links what already exists, and an answered action is already done. A status alone
 * could not carry that difference, and a page that guessed would guess wrong
 * @public
 * @constant
 */
export const RESULT_REFUSAL_STATUS: Record<ResultRefusal, number> = {
  [ResultRefusal.ALREADY_ANSWERED]: 409,
  [ResultRefusal.FORBIDDEN]: 403,
  [ResultRefusal.INVALID_SUBMISSION]: 422,
  [ResultRefusal.NOT_FOUND]: 404,
  [ResultRefusal.OPERATION_BODY_CHANGED]: 409,
  [ResultRefusal.PROBABLE_DUPLICATE]: 409,
  [ResultRefusal.SEAT_NOT_A_MEMBER]: 422,
  [ResultRefusal.STALE_LEAGUE_RULES]: 409,
  [ResultRefusal.STALE_RESULT]: 409,
  [ResultRefusal.UNPLAYABLE]: 422,
};

/**
 * What each refusal says, in the words the page shows.
 *
 * Written for the person who pressed the button rather than for the log: what happened, and what they can do about
 * it. Nothing here names a table, a revision id or an internal state
 * @public
 * @constant
 */
export const RESULT_REFUSAL_MESSAGE: Record<ResultRefusal, string> = {
  [ResultRefusal.ALREADY_ANSWERED]: 'You have already answered this result.',
  [ResultRefusal.FORBIDDEN]: 'Your role in this league does not allow that.',
  [ResultRefusal.INVALID_SUBMISSION]: 'Some of what was entered cannot be recorded as played.',
  [ResultRefusal.NOT_FOUND]: 'That result could not be found.',
  [ResultRefusal.OPERATION_BODY_CHANGED]:
    'This entry was already recorded with different details. Open the result that exists, or record a new one.',
  [ResultRefusal.PROBABLE_DUPLICATE]: 'This looks like a result already recorded.',
  [ResultRefusal.SEAT_NOT_A_MEMBER]: 'Everyone in the match has to be an active member of this league.',
  [ResultRefusal.STALE_LEAGUE_RULES]:
    'This league’s rules changed while you were entering the result. Check the scores against the rules above.',
  [ResultRefusal.STALE_RESULT]: 'This result changed while you were looking at it.',
  [ResultRefusal.UNPLAYABLE]: 'That score could not have happened under this league’s rules.',
};

/**
 * What a refused write answers with: why, and where the match stands now.
 *
 * The current state travels with every conflict, because every one of them ends with the page redrawing to something
 * it did not know. A refusal that carried only a message would leave the page showing what it had, which is the
 * state that has just been contradicted
 * @public
 */
export interface IResultRefusalResponse {
  /* Where the match stands now, when the refusal knows */
  current: IResultCurrentState | null;

  /* What to tell the person */
  message: string;

  /* Which refusal this is, so the page can tell the conflicts apart */
  refusal: ResultRefusal;

  /* The status this answer carries */
  statusCode: number;
}

/**
 * Answers a refused result write.
 *
 * A conflict is a body rather than a thrown error: the page needs the current state to redraw to, and an H3 error
 * carries a message alone. Everything else is thrown, because there is nothing for the page to render but the
 * message — and a 403 or a 404 must look exactly like every other 403 or 404 in this slice, which is what stops a
 * refusal from telling somebody that a match they may not see exists
 * @public
 * @function
 * @param event - The request being answered
 * @param refusal - Why the service refused it
 * @param current - Where the match stands now, when the caller could read it
 * @throws H3Error for every refusal that is not a conflict
 * @returns The conflict body
 */
export function answerResultRefusal(
  event: H3Event,
  refusal: ResultRefusal,
  current: IResultCurrentState | null = null,
): IResultRefusalResponse {
  const statusCode: number = RESULT_REFUSAL_STATUS[refusal];
  const message: string = RESULT_REFUSAL_MESSAGE[refusal];

  if (statusCode !== 409) {
    throw createError({ statusCode, statusMessage: message });
  }

  setResponseStatus(event, statusCode);

  return {
    current,
    message,
    refusal,
    statusCode,
  };
}
