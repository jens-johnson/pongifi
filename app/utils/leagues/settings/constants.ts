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
 * ███████████████████████████████████████ #utils/leagues/settings/constants.ts ████████████████████████████████████████
 *
 * The settings page's section order, copy and control choices.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { GameCreator, ResultRecorder } from '#shared/domain';
import { SETTINGS_SECTION_FORBIDDEN_MESSAGE, SETTINGS_STALE_MESSAGE, SettingsSection } from '#shared/leagues';
import { GameType } from '#shared/rules-engine';

import { SettingsSectionAlert } from './enums';
import type { TSettingsControl } from './types';

/**
 * The four sections in the order the page stacks them (page spec, Page Skeleton).
 * @public
 * @constant
 */
export const SETTINGS_SECTION_ORDER: readonly SettingsSection[] = [
  SettingsSection.IDENTITY,
  SettingsSection.FORMATS,
  SettingsSection.RESULTS,
  SettingsSection.RATINGS,
];

/**
 * Each section's heading.
 * @public
 * @constant
 */
export const SETTINGS_SECTION_HEADINGS: Readonly<Record<SettingsSection, string>> = {
  [SettingsSection.FORMATS]: 'Formats and scoring',
  [SettingsSection.IDENTITY]: 'Identity',
  [SettingsSection.RATINGS]: 'Ratings',
  [SettingsSection.RESULTS]: 'Results',
};

/**
 * The caption a section shows to a viewer who may not change it, naming the role that may.
 *
 * Identity names both roles because a manager may save it; every other section is a commissioner's alone, which is the
 * same sentence the server refuses a crafted body with
 * @public
 * @constant
 */
export const SETTINGS_SECTION_READ_ONLY_CAPTIONS: Readonly<Record<SettingsSection, string>> = {
  [SettingsSection.FORMATS]: SETTINGS_SECTION_FORBIDDEN_MESSAGE,
  [SettingsSection.IDENTITY]: 'Only a commissioner or manager can change these.',
  [SettingsSection.RATINGS]: SETTINGS_SECTION_FORBIDDEN_MESSAGE,
  [SettingsSection.RESULTS]: SETTINGS_SECTION_FORBIDDEN_MESSAGE,
};

/**
 * The line each alert shows above a section's controls.
 * @public
 * @constant
 */
export const SETTINGS_ALERT_MESSAGES: Readonly<Record<SettingsSectionAlert, string>> = {
  [SettingsSectionAlert.FORBIDDEN]: SETTINGS_SECTION_FORBIDDEN_MESSAGE,
  [SettingsSectionAlert.RATE_LIMITED]: 'Pongifi could not save these settings. Wait a moment and try again.',
  [SettingsSectionAlert.RECONCILE_FAILED]: 'Pongifi could not check whether these settings were saved.',
  [SettingsSectionAlert.REFUSED]: 'Pongifi could not save these settings. Try again.',
  [SettingsSectionAlert.STALE]: SETTINGS_STALE_MESSAGE,
};

/**
 * The line under the page heading, said once and nowhere else (page spec, Shared Rules).
 * @public
 * @constant
 */
export const SETTINGS_FREEZE_NOTE: string = 'Changes apply to new games. Games already created keep their settings.';

/**
 * The confirmation a saved section shows under its heading.
 * @public
 * @constant
 */
export const SETTINGS_SAVED_MESSAGE: string = 'Saved.';

/**
 * How long the saved confirmation stays up, in milliseconds.
 * @public
 * @constant
 */
export const SETTINGS_SAVED_DURATION_MS: number = 4000;

/**
 * What the router asks before leaving a page with unsaved changes.
 * @public
 * @constant
 */
export const SETTINGS_LEAVE_PROMPT: string = 'Leave without saving?';

/**
 * The choices the Results section's two selects offer, in the order they list them.
 * @public
 * @constant
 */
export const GAME_CREATOR_CHOICES: readonly GameCreator[] = [GameCreator.PLAYER, GameCreator.MANAGER];

/**
 * Who may record a result, in the order the select lists them.
 * @public
 * @constant
 */
export const RESULT_RECORDER_CHOICES: readonly ResultRecorder[] = [ResultRecorder.PARTICIPANTS, ResultRecorder.MANAGER];

/**
 * The labels the two Results selects show; keys are never shown to a person.
 * @public
 * @constant
 */
export const GAME_CREATOR_LABELS: Readonly<Record<GameCreator, string>> = {
  [GameCreator.MANAGER]: 'Managers and commissioners',
  [GameCreator.PLAYER]: 'Any player',
};

/**
 * The labels the who-can-record select shows.
 * @public
 * @constant
 */
export const RESULT_RECORDER_LABELS: Readonly<Record<ResultRecorder, string>> = {
  [ResultRecorder.MANAGER]: 'Managers and commissioners',
  [ResultRecorder.PARTICIPANTS]: 'The players in the game',
};

/**
 * The text a whole number must match before it is read as one.
 *
 * Anything else — an empty field, a fraction, a sign, a thousands separator, whitespace — is handed to the shared
 * validator unparsed, so the message under the field is the field's own rather than a second copy of it
 * @public
 * @constant
 */
export const WHOLE_NUMBER_INPUT_PATTERN: RegExp = /^\d+$/;

/**
 * Each section's controls in the order the page lays them out, with a target score named per format.
 *
 * Read by the read-only rendering and by the stale comparison, so a section reads the same top to bottom whether it
 * has controls or not. It is not the server's field list: that one allowlists a body, this one orders a page
 * @public
 * @constant
 */
export const SETTINGS_SECTION_CONTROL_ORDER: Readonly<Record<SettingsSection, readonly TSettingsControl[]>> = {
  [SettingsSection.FORMATS]: [
    'allowedGameTypes',
    'targetScore.SINGLES',
    'targetScore.DOUBLES',
    'targetScore.CUTTHROAT',
    'winningMargin',
    'matchFormat',
    'serviceInterval',
    'expediteEnabled',
    'cutthroatTimeCap',
    'walkoverGracePeriod',
  ],
  [SettingsSection.IDENTITY]: ['name', 'abbreviation', 'description'],
  [SettingsSection.RATINGS]: ['ratingEnabled', 'provisionalGames'],
  [SettingsSection.RESULTS]: [
    'whoCanCreateGames',
    'whoCanRecordResults',
    'requireConfirmation',
    'resultConfirmationWindow',
    'resultAmendmentWindow',
  ],
};

/**
 * The label above each control, as the page words it.
 * @public
 * @constant
 */
export const SETTINGS_FIELD_LABELS: Readonly<Record<TSettingsControl, string>> = {
  abbreviation: 'Short mark',
  allowedGameTypes: 'Formats',
  cutthroatTimeCap: 'Cutthroat time cap',
  description: 'Description',
  expediteEnabled: 'Expedite system',
  matchFormat: 'Best of',
  name: 'Name',
  provisionalGames: 'Provisional games',
  ratingEnabled: 'Ratings',
  requireConfirmation: 'Results need confirmation',
  resultAmendmentWindow: 'Amendment window',
  resultConfirmationWindow: 'Confirmation window',
  serviceInterval: 'Serve changes every',
  'targetScore.CUTTHROAT': 'Cutthroat to',
  'targetScore.DOUBLES': 'Doubles to',
  'targetScore.SINGLES': 'Singles to',
  walkoverGracePeriod: 'Walkover grace',
  whoCanCreateGames: 'Who can create games',
  whoCanRecordResults: 'Who can record results',
  winningMargin: 'Win by',
};

/**
 * The unit each plain number field is counted in, shown beside the control and in a read-only row.
 * @public
 * @constant
 */
export const SETTINGS_FIELD_UNITS: Readonly<Partial<Record<TSettingsControl, string>>> = {
  cutthroatTimeCap: 'minutes',
  provisionalGames: 'games',
  resultAmendmentWindow: 'hours',
  resultConfirmationWindow: 'hours',
  serviceInterval: 'points',
  walkoverGracePeriod: 'minutes',
  winningMargin: 'points',
};

/**
 * The caption beneath a control whose rule is not obvious from its label.
 * @public
 * @constant
 */
export const SETTINGS_FIELD_CAPTIONS: Readonly<Partial<Record<TSettingsControl, string>>> = {
  provisionalGames: "A player's rating is marked provisional until they have played this many rated games.",
  resultAmendmentWindow: 'How long after a game a result can still be corrected.',
  serviceInterval: 'Once both sides reach one point from the target, service alternates every point.',
};

/**
 * What the confirmation toggle says while it is on.
 * @public
 * @constant
 */
export const SETTINGS_CONFIRMATION_ON_CAPTION: string =
  'The other players confirm a result, or it is accepted automatically after the window below if nobody disputes.';

/**
 * What the ratings toggle says while it is on.
 * @public
 * @constant
 */
export const SETTINGS_RATINGS_ON_CAPTION: string = 'Ratings start with the next game.';

/**
 * What the ratings toggle says while it is off.
 * @public
 * @constant
 */
export const SETTINGS_RATINGS_OFF_CAPTION: string =
  "New games will not change anyone's rating. Ratings already earned stay as they are.";

/**
 * The heading of the sub-group the singles and doubles rules sit in, in a league that also plays cutthroat.
 *
 * Cutthroat rotates service on a lost rally and never consults the interval, and expedite is never legal in it
 * (III.II.IX.III, III.II.IX.XIII), so a mixed league says whose rules these are
 * @public
 * @constant
 */
export const SETTINGS_SINGLES_DOUBLES_HEADING: string = 'Singles and doubles';

/**
 * The formats whose presence shows the singles and doubles sub-group.
 * @public
 * @constant
 */
export const SINGLES_DOUBLES_FORMATS: readonly GameType[] = [GameType.SINGLES, GameType.DOUBLES];

/**
 * The fields the singles and doubles sub-group holds.
 * @public
 * @constant
 */
export const SINGLES_DOUBLES_FIELDS: readonly TSettingsControl[] = [
  'matchFormat',
  'serviceInterval',
  'expediteEnabled',
];
