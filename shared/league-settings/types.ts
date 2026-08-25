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
 * █████████████████████████████████████████ #shared/league-settings/types.ts ██████████████████████████████████████████
 *
 * The shape of a league's settings object and the subset a single game may override.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { EGameCreator, EResultRecorder } from '#shared/domain';
import type { EGameType } from '#shared/rules-engine';

/**
 * The gameplay half of a league's settings; these determine how a game is created and scored (IV.II)
 * @public
 */
export interface ILeagueGameplaySettings {
  /* Which formats the league plays; at least one */
  allowedGameTypes: EGameType[];
  /* The score a game is played to, per game type */
  targetScore: Record<EGameType, number>;
  /* The lead required to win */
  winningMargin: number;
  /* Points between changes of service before deuce */
  serviceInterval: number;
  /* Best-of-N for singles and doubles; cutthroat is always a single game */
  matchFormat: number;
  /* Minutes before a cutthroat game is capped; zero disables the cap */
  cutthroatTimeCap: number;
  /* Whether the expedite system may be introduced */
  expediteEnabled: boolean;
  /* Minutes a player may be late before a walkover is recorded */
  walkoverGracePeriod: number;
}

/**
 * The administration half of a league's settings; these are league-wide by definition and can never be overridden by a
 * single game (IV.III, IV.V)
 * @public
 */
export interface ILeagueAdministrationSettings {
  /* Who may create a game */
  whoCanCreateGames: EGameCreator;
  /* Who may record a result */
  whoCanRecordResults: EResultRecorder;
  /* Hours after completion during which a result may be amended */
  resultAmendmentWindow: number;
  /* Whether games in this league move ratings at all */
  ratingEnabled: boolean;
  /* Rated games a player must complete before their rating leaves provisional status */
  provisionalGames: number;
  /* Whether a recorded result needs the other participants to accept it */
  requireConfirmation: boolean;
  /* Hours a result stays unconfirmed before it is accepted automatically */
  resultConfirmationWindow: number;
}

/**
 * A league's complete settings object. Visibility is deliberately a column on the league rather than a settings field:
 * discovery queries filter on it, and a JSON field cannot be indexed as cheaply
 * @public
 */
export type TLeagueSettings = ILeagueGameplaySettings & ILeagueAdministrationSettings;

/**
 * The subset of settings a single game may override at creation time (IV.V). Nothing administrative appears here, and
 * no override in this list changes who is able to score, so none of them affect rating eligibility
 * @public
 */
export type TGameSettingsOverride = Partial<
  Pick<ILeagueGameplaySettings, 'winningMargin' | 'serviceInterval' | 'matchFormat' | 'cutthroatTimeCap'> & {
    targetScore: number;
  }
>;
