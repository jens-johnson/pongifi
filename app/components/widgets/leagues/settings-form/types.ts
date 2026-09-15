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
 * ████████████████████████████████ #components/widgets/leagues/settings-form/types.ts █████████████████████████████████
 *
 * Inputs for the league settings editor.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ILeagueConfiguration, ILeagueDetail } from '#shared/leagues';

/**
 * Inputs for the league settings editor.
 * @public
 * @interface
 */
export interface ILeaguesSettingsFormProps {
  /* The league as its members see it, carrying the viewer's role and the revision the page loads at */
  league: ILeagueDetail;
}

/**
 * The part of a rejected `$fetch` the page reads: the body a 409 carried, and the line a definite refusal carried.
 * @public
 * @interface
 */
export interface ISettingsWriteRejection {
  /* The response body: the configuration a stale save answers with, or the line a definite refusal carries */
  data?: unknown;

  /* The status line, read only when the body carried nothing of its own */
  statusMessage?: unknown;
}

/**
 * The part of a refusal body the page shows: the line the server refused with, under either of the two names h3 gives
 * it.
 * @public
 * @interface
 */
export interface ISettingsRefusalBody {
  /* The message h3 puts in the body */
  message?: unknown;

  /* The same line under the name the endpoint threw it with */
  statusMessage?: unknown;
}

/**
 * What the editor tells the page when a save changed something the page itself is drawing.
 * @public
 * @interface
 */
export interface ILeaguesSettingsFormEmits {
  /* The configuration as it is now stored, so the page's own heading reads what was saved */
  saved: [configuration: ILeagueConfiguration];
}
