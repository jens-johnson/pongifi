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

/**
 * The inclusive whole-number range a plain numeric setting is accepted in.
 *
 * Both endpoints are valid values: the editor's controls use them as their `min`/`max`, and the server refuses
 * anything outside them rather than clamping it (numeric contract addendum, 2026-09-14)
 * @public
 * @interface
 */
export interface INumericBounds {
  /* The largest accepted value */
  max: number;

  /* The smallest accepted value */
  min: number;
}

/**
 * The numeric settings validated as an inclusive range rather than as a set of choices.
 *
 * `Extract` rather than a bare union so a name that stops being a setting stops compiling here
 * @public
 */
export type TBoundedSetting = Extract<
  keyof TLeagueSettings,
  | 'cutthroatTimeCap'
  | 'provisionalGames'
  | 'resultAmendmentWindow'
  | 'resultConfirmationWindow'
  | 'serviceInterval'
  | 'walkoverGracePeriod'
  | 'winningMargin'
>;

/**
 * Every numeric setting, bounded or discrete, as the order constant names them.
 * @public
 */
export type TNumericSetting = Extract<keyof TLeagueSettings, 'matchFormat' | 'targetScore'> | TBoundedSetting;

/**
 * A refused settings value, carrying the message the field shows.
 * @public
 * @interface
 */
export interface ISettingValidationFailure {
  /* The message shown beneath the field */
  message: string;

  /* The value did not satisfy the field's rule */
  ok: false;
}

/**
 * An accepted settings value, safe to store as it stands.
 * @public
 * @interface
 */
export interface ISettingValidationSuccess {
  /* The value satisfied the field's rule */
  ok: true;

  /* The whole number to store, unchanged from the input */
  value: number;
}

/**
 * The outcome of validating one numeric setting.
 * @public
 */
export type TSettingValidationResult = ISettingValidationFailure | ISettingValidationSuccess;

/**
 * One numeric setting that does not satisfy its rule, as the settings page addresses it.
 *
 * A target score names its format: `targetScore.SINGLES`
 * @public
 * @interface
 */
export interface ISettingsNumberIssue {
  /* The path of the field that failed, as the editor addresses it */
  field: string;

  /* The message shown beneath that field */
  message: string;
}
