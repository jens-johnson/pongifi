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

import type { IResultFormContext } from '#shared/results';

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
