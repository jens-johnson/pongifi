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

import type { GameCreator, ResultRecorder } from '#shared/domain';
import type { GameType } from '#shared/rules-engine';

/**
 * The administration half of a league's settings; these are league-wide by definition and can never be overridden by a
 * single game (IV.III, IV.V)
 * @public
 */
export interface ILeagueAdministrationSettings {
  /* Rated games a player must complete before their rating leaves provisional status */
  provisionalGames: number;

  /* Whether games in this league move ratings at all */
  ratingEnabled: boolean;

  /* Whether a recorded result needs the other participants to accept it */
  requireConfirmation: boolean;

  /* Hours after completion during which a result may be amended */
  resultAmendmentWindow: number;

  /* Hours a result stays unconfirmed before it is accepted automatically */
  resultConfirmationWindow: number;

  /* Who may create a game */
  whoCanCreateGames: GameCreator;

  /* Who may record a result */
  whoCanRecordResults: ResultRecorder;
}

/**
 * The gameplay half of a league's settings; these determine how a game is created and scored (IV.II)
 * @public
 */
export interface ILeagueGameplaySettings {
  /* Which formats the league plays; at least one */
  allowedGameTypes: GameType[];

  /* Minutes before a cutthroat game is capped; zero disables the cap */
  cutthroatTimeCap: number;

  /* Whether the expedite system may be introduced */
  expediteEnabled: boolean;

  /* Best-of-N for singles and doubles; cutthroat is always a single game */
  matchFormat: number;

  /* Points between changes of service before deuce */
  serviceInterval: number;

  /* The score a game is played to, per game type */
  targetScore: Record<GameType, number>;

  /* Minutes a player may be late before a walkover is recorded */
  walkoverGracePeriod: number;

  /* The lead required to win */
  winningMargin: number;
}

/**
 * A league's complete settings object. Visibility is deliberately a column on the league rather than a settings field:
 * discovery queries filter on it, and a JSON field cannot be indexed as cheaply
 * @public
 */
export type TLeagueSettings = ILeagueAdministrationSettings & ILeagueGameplaySettings;

/**
 * The subset of settings a single game may override at creation time (IV.V). Nothing administrative appears here, and
 * no override in this list changes who is able to score, so none of them affect rating eligibility
 * @public
 */
export type TGameSettingsOverride = Partial<
  Pick<ILeagueGameplaySettings, 'cutthroatTimeCap' | 'matchFormat' | 'serviceInterval' | 'winningMargin'> & {
    targetScore: number;
  }
>;
