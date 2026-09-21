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
 * ████████████████████████████████ #components/widgets/results/match-actions/types.ts █████████████████████████████████
 *
 * What the result actions are given.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IMatchView } from '#shared/results';

/**
 * What the actions need to know: which league they are in, and the match as this viewer reads it
 * @public
 */
export interface IResultsMatchActionsProps {
  /* The league the match belongs to, for the request path */
  leagueId: string;

  /**
   * The match, including this viewer's own permissions.
   *
   * The permissions are the read's, never the component's: the server decides what somebody may do at the moment of
   * the write, and the page must never offer more than the read allowed
   */
  match: IMatchView;
}

/**
 * What the actions tell the page.
 *
 * One event for both outcomes that change what is on screen: an answer that landed, and one refused because the
 * result had already moved. The page re-reads either way
 * @public
 */
export interface IResultsMatchActionsEmits {
  /* The match should be read again */
  resolved: [];
}
