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
 * █████████████████████████████████ #components/widgets/results/record-form/types.ts ██████████████████████████████████
 *
 * What the Record form is given, and what it reports.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IRecordRequestBody, IResultFormContext } from '#shared/results';

/**
 * What the Record form is given
 * @public
 */
export interface IResultsRecordFormProps {
  /* Everything the league says about how this entry will be judged, read from the server */
  context: IResultFormContext;

  /* The league being recorded in, for the request path */
  leagueId: string;

  /* The account recording, who is pre-seated and who may have to be seated at all */
  recorderId: string;
}

/**
 * What the form tells the page
 * @public
 */
export interface IResultsRecordFormEmits {
  /* A result was recorded; the page navigates to it */
  recorded: [canonicalMatchId: string];
}

/**
 * A match this entry was warned about looking like
 * @public
 */
export interface IRecordDuplicate {
  /* The match, which is the page it is read at */
  canonicalMatchId: string;

  /* When it says it was played */
  playedAt: string;
}

/**
 * The result a reused operation id already wrote, when the refusal named one.
 *
 * A receipt is keyed by the account, the operation and its id, so the match behind one can sit in a league this
 * request never mentioned; the server names it only when it belongs here, and the page links only what it was given
 * @public
 */
export interface IRecordExisting {
  /* The match, which is the page it is read at */
  canonicalMatchId: string;
}

/**
 * A save as it was sent, held from the press until its outcome is known.
 *
 * Both halves, because both are keyed. The server keys creation on the account, the operation id and a digest of the
 * body, so a retry that rebuilt its body from whatever the form is showing now is not a retry at all: the same id
 * carrying a different body is a conflict, and the save the person is waiting on stays unresolved. The endpoint is
 * held for the same reason and not reassembled from the props: a check aimed at a league the original operation was
 * never made against would answer about nothing
 * @public
 */
export interface IRecordAttempt {
  /* The body, exactly as it was sent. The acknowledgement travels outside the digest */
  body: IRecordRequestBody;

  /* Where it was sent, whole */
  endpoint: string;
}

/**
 * What a recorded result answers with, as far as this form reads it
 * @public
 */
export interface IRecordedAnswer {
  /* Where the match stands now, which carries the page to go to */
  current: { canonicalMatchId: string };
}

/**
 * A rejection as the fetch layer raises it, carrying whatever the server answered
 * @public
 */
export interface IRecordFailure {
  /* The response body, when there was one */
  data?: Record<string, unknown>;
}
