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
 * ██████████████████████████████████████████████ #utils/results/types.ts ██████████████████████████████████████████████
 *
 * What the match page reads.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IMatchView } from '#shared/results';

/**
 * What the match page's read answers with
 * @public
 */
export interface IMatchPageResponse {
  /* The match's own id, which is the page it is read at */
  canonicalMatchId: string;

  /* The match */
  match: IMatchView;

  /* Whether the sweep this read performed could not be completed; explains an outstanding result, never defines one */
  settlementFailed: boolean;

  /**
   * Whether this result is past its own confirmation deadline and still unsettled.
   *
   * Settlement is bounded, so a sweep that succeeded is not a league that is caught up. This is the flag the page
   * branches on; a result that is due must never be rendered as ordinarily pending
   */
  settlementOutstanding: boolean;
}
