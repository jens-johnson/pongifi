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
 * ███████████████████████████████ #components/widgets/leagues/create-form/constants.ts ████████████████████████████████
 *
 * Alert copy and cancel destinations for the create-league form.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { CreateLeagueAlert } from './enums';

/**
 * The text of each alert that has no link in it; the uncertain alert is drawn in the template because it links to the
 * player's leagues.
 * @public
 * @constant
 */
export const CREATE_LEAGUE_ALERT_MESSAGES: Readonly<
  Record<Exclude<CreateLeagueAlert, CreateLeagueAlert.UNCERTAIN>, string>
> = {
  /* A changed replay */
  [CreateLeagueAlert.CONFLICT]: 'Pongifi could not create the league. Check your leagues before trying again.',

  /* The write limiter */
  [CreateLeagueAlert.RATE_LIMITED]: 'Pongifi could not create the league. Wait a moment and try again.',

  /* Any other definite refusal */
  [CreateLeagueAlert.REFUSED]: 'Pongifi could not create the league. Try again.',
};

/**
 * The routes Cancel may return to; anywhere else, Cancel goes home.
 * @public
 * @constant
 */
export const CANCEL_DESTINATIONS: readonly string[] = ['/', '/leagues'];
