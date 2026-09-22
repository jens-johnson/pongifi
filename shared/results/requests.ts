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
 * ████████████████████████████████████████████ #shared/results/requests.ts ████████████████████████████████████████████
 *
 * The request bodies the result pages send, and the shape checks that refuse anything else.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { isUuid } from '#shared/leagues';

import { MAX_NOTE_LENGTH } from './constants';
import { ResultAction } from './enums';
import type { IResultSubmission } from './types';

/**
 * What a well-formed body that this layer still refuses answers with
 * @public
 */
export interface IRequestValidationFailure {
  /* What to tell the caller */
  message: string;

  /* This body was not usable */
  ok: false;

  /* The status the refusal carries */
  statusCode: number;
}

/**
 * A body this layer accepted, normalized to the shape the service takes
 * @public
 */
export interface IRequestValidationSuccess<TValue> {
  /* The body satisfied every rule this layer checks */
  ok: true;

  /* The normalized request */
  value: TValue;
}

/**
 * The result of validating an untrusted result request body
 * @public
 */
export type TRequestValidation<TValue> = IRequestValidationFailure | IRequestValidationSuccess<TValue>;

/**
 * What a page sends to record a result
 * @public
 */
export interface IRecordRequestBody {
  /**
   * The token a probable-duplicate warning issued, sent back to record anyway. Null when nothing was warned about.
   *
   * Bound to the result that was warned about and the candidates that were shown, so an edited result or a newly
   * appeared candidate earns a fresh warning rather than slipping through on an old answer
   */
  acknowledgement: string | null;

  /* The operation this save belongs to, from first attempt to resolved outcome */
  clientOperationId: string;

  /* The league configuration revision the form rendered from */
  expectedLeagueRevision: number;

  /* The result itself */
  submission: IResultSubmission;
}

/**
 * What a page sends to amend a disputed result
 * @public
 */
export interface IAmendRequestBody {
  /* The operation this save belongs to */
  clientOperationId: string;

  /* The revision the page was showing, which the amendment is judged against */
  expectedRevision: number;

  /* The corrected result */
  submission: IResultSubmission;
}

/**
 * What a page sends to confirm, dispute or void
 * @public
 */
export interface IAnswerRequestBody {
  /* Which answer this is */
  action: ResultAction;

  /* The operation this press belongs to, kept until the outcome is known */
  clientOperationId: string;

  /* The revision the page was showing */
  expectedRevision: number;

  /* The words a dispute carries, or null */
  note: string | null;
}

/**
 * What a body that is not a request at all is answered with
 * @internal
 * @constant
 */
const MALFORMED: IRequestValidationFailure = {
  message: 'That request was not in a form this page sends.',
  ok: false,
  statusCode: 400,
};

/**
 * Whether the body is an object carrying no key this request does not own.
 *
 * An allowlist rather than a check of the keys we read: a body carrying an extra field is a body written by something
 * other than this page, and accepting it quietly would let a later field name mean two things
 * @internal
 * @function
 * @param body - The body as it arrived
 * @param fields - Every key this request owns
 * @returns Whether it is an object of exactly those keys or fewer
 */
function isAllowlistedObject(body: unknown, fields: readonly string[]): body is Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return false;
  }

  return Object.keys(body).every((field: string): boolean => fields.includes(field));
}

/**
 * Whether a value is a revision a server issued: a counter, never something a person types
 * @internal
 * @function
 * @param value - The value as it arrived
 * @returns Whether it is a positive safe integer
 */
function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

/**
 * Whether the value is a submission's shape.
 *
 * Shape only. What the scores, seats and play time may be is `findSubmissionProblem`'s question, and it is asked on
 * the server against the database's clock rather than here: a body that is structurally a submission but states an
 * impossible score is a 422 with a field message, not a 400
 * @internal
 * @function
 * @param value - The value as it arrived
 * @returns Whether it can be read as a submission
 */
function isSubmissionShape(value: unknown): value is IResultSubmission {
  if (!isAllowlistedObject(value, ['ending', 'gameType', 'games', 'playedAt', 'retiredSeat', 'seats'])) {
    return false;
  }

  const { ending, gameType, games, playedAt, seats } = value;

  return (
    typeof ending === 'string' &&
    typeof gameType === 'string' &&
    Array.isArray(games) &&
    Array.isArray(seats) &&
    typeof playedAt === 'string'
  );
}

/**
 * Reads a body recording a result
 * @public
 * @function
 * @param body - The body as it arrived
 * @returns The normalized request, or what to refuse it with
 */
export function validateRecordBody(body: unknown): TRequestValidation<IRecordRequestBody> {
  if (!isAllowlistedObject(body, ['acknowledgement', 'clientOperationId', 'expectedLeagueRevision', 'submission'])) {
    return MALFORMED;
  }

  const { acknowledgement, clientOperationId, expectedLeagueRevision, submission } = body;

  if (
    !isUuid(clientOperationId) ||
    !isRevision(expectedLeagueRevision) ||
    !isSubmissionShape(submission) ||
    (acknowledgement !== undefined && acknowledgement !== null && typeof acknowledgement !== 'string')
  ) {
    return MALFORMED;
  }

  return {
    ok: true,
    value: {
      acknowledgement: typeof acknowledgement === 'string' ? acknowledgement : null,
      clientOperationId,
      expectedLeagueRevision,
      submission,
    },
  };
}

/**
 * Reads a body amending a disputed result
 * @public
 * @function
 * @param body - The body as it arrived
 * @returns The normalized request, or what to refuse it with
 */
export function validateAmendBody(body: unknown): TRequestValidation<IAmendRequestBody> {
  if (!isAllowlistedObject(body, ['clientOperationId', 'expectedRevision', 'submission'])) {
    return MALFORMED;
  }

  const { clientOperationId, expectedRevision, submission } = body;

  if (!isUuid(clientOperationId) || !isRevision(expectedRevision) || !isSubmissionShape(submission)) {
    return MALFORMED;
  }

  return {
    ok: true,
    value: {
      clientOperationId,
      expectedRevision,
      submission,
    },
  };
}

/**
 * Reads a body confirming, disputing or voiding.
 *
 * A note longer than the column holds is a 422 with a field message rather than a 400, so the check here is that the
 * field is a string at all; its length is the service's answer
 * @public
 * @function
 * @param body - The body as it arrived
 * @returns The normalized request, or what to refuse it with
 */
export function validateAnswerBody(body: unknown): TRequestValidation<IAnswerRequestBody> {
  if (!isAllowlistedObject(body, ['action', 'clientOperationId', 'expectedRevision', 'note'])) {
    return MALFORMED;
  }

  const { action, clientOperationId, expectedRevision, note } = body;
  const carried: string | null = note === undefined || note === null ? null : (note as string);

  if (
    !Object.values(ResultAction).includes(action as ResultAction) ||
    !isUuid(clientOperationId) ||
    !isRevision(expectedRevision) ||
    (carried !== null && typeof carried !== 'string')
  ) {
    return MALFORMED;
  }

  return {
    ok: true,
    value: {
      action: action as ResultAction,
      clientOperationId,
      expectedRevision,
      note: carried === null ? null : carried.slice(0, MAX_NOTE_LENGTH + 1),
    },
  };
}
