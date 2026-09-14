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
 * █████████████████████████████████████████ #utils/leagues/settings/types.ts ██████████████████████████████████████████
 *
 * The settings page's per-section draft, state and save-outcome shapes.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { GameCreator, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type { SettingsSection } from '#shared/leagues';
import type { GameType } from '#shared/rules-engine';

import type { SettingsSectionAlert, SettingsSectionPhase } from './enums';

/**
 * The Identity section as it is being edited.
 * @public
 * @interface
 */
export interface IIdentityDraft {
  /* The short mark as typed, uppercased as the create form uppercases it */
  abbreviation: string;

  /* The description as typed */
  description: string;

  /* The name as typed */
  name: string;
}

/**
 * The Formats and scoring section as it is being edited.
 *
 * The plain number fields are held as typed text rather than as numbers, so a fraction, an empty field or a value
 * carrying the thousands separator the message itself prints is refused with that field's message rather than coerced
 * into range on the way in. The selects and toggles hold their own values, since no person types them
 * @public
 * @interface
 */
export interface IFormatsDraft {
  /* The formats currently checked */
  allowedGameTypes: GameType[];

  /* Minutes before a cutthroat game is capped, as typed */
  cutthroatTimeCap: string;

  /* Whether the expedite system may be introduced */
  expediteEnabled: boolean;

  /* Best-of-N */
  matchFormat: number;

  /* Points between changes of service, as typed */
  serviceInterval: string;

  /* The score each format is played to, checked or not */
  targetScore: Record<GameType, number>;

  /* Minutes before a walkover, as typed */
  walkoverGracePeriod: string;

  /* The lead required to win, as typed */
  winningMargin: string;
}

/**
 * The Results section as it is being edited.
 * @public
 * @interface
 */
export interface IResultsDraft {
  /* Whether a recorded result needs the other participants to accept it */
  requireConfirmation: boolean;

  /* Hours a result may still be corrected in, as typed */
  resultAmendmentWindow: string;

  /* Hours a result stays unconfirmed, as typed */
  resultConfirmationWindow: string;

  /* Who may create a game */
  whoCanCreateGames: GameCreator;

  /* Who may record a result */
  whoCanRecordResults: ResultRecorder;
}

/**
 * The Ratings section as it is being edited.
 * @public
 * @interface
 */
export interface IRatingsDraft {
  /* Rated games before a rating leaves provisional status, as typed */
  provisionalGames: string;

  /* Whether games in this league move ratings */
  ratingEnabled: boolean;
}

/**
 * Every section of the page as it is being edited.
 * @public
 * @interface
 */
export interface ISettingsDraft {
  /* Formats, target scores, best of, service interval, expedite, the cutthroat cap and the walkover grace */
  FORMATS: IFormatsDraft;

  /* Name, short mark and description */
  IDENTITY: IIdentityDraft;

  /* Whether ratings move, and the provisional game count */
  RATINGS: IRatingsDraft;

  /* Who creates games, who records results, confirmation and the two windows */
  RESULTS: IResultsDraft;
}

/**
 * One section's messages, keyed as the editor addresses its fields.
 *
 * A target score is keyed by its format, `targetScore.SINGLES`, which is the key the collector and the section save
 * both produce
 * @public
 */
export type TSectionFieldErrors = Readonly<Record<string, string>>;

/**
 * A section save the page refuses before sending, with every field's message and the control to put focus on.
 * @public
 * @interface
 */
export interface ISectionValidationFailure {
  /* The field that takes focus: the first one the section lists */
  focus: string;

  /* Every refused field's message */
  errors: TSectionFieldErrors;

  /* The section was not sent */
  ok: false;
}

/**
 * A section save the page will send.
 * @public
 * @interface
 */
export interface ISectionValidationSuccess<TValue> {
  /* The section is ready to send */
  ok: true;

  /* The body to send */
  value: TValue;
}

/**
 * The outcome of validating one section before it is sent.
 * @public
 */
export type TSectionValidationResult<TValue> = ISectionValidationFailure | ISectionValidationSuccess<TValue>;

/**
 * What one settings section is doing and showing.
 * @public
 * @interface
 */
export interface ISectionState {
  /* The alert above the controls, or null */
  alert: SettingsSectionAlert | null;

  /* Whether the Saved line is showing */
  confirmed: boolean;

  /* The messages under the section's fields */
  errors: TSectionFieldErrors;

  /* The server's own line for this refusal, shown instead of the alert's standard copy */
  message: string | null;

  /* Where the section stands */
  phase: SettingsSectionPhase;

  /* The revision this section's baseline was loaded at, which its next Save carries */
  revision: number;
}

/**
 * What a section does with a configuration another section's save returned.
 * @public
 * @interface
 */
export interface ISectionAdoption {
  /* Whether the section takes the returned values as its own baseline and draft */
  adopt: boolean;

  /* The revision the section's next Save carries */
  revision: number;

  /* Whether the section must show the returned values beside its draft before anything else */
  stale: boolean;
}

/**
 * What a section needs to decide how to take a configuration it did not save.
 * @public
 * @interface
 */
export interface ISectionAdoptionInput {
  /* The section's draft as it stands */
  draft: ISettingsDraft;

  /* Whether the person has changed anything in this section */
  dirty: boolean;

  /* The draft the section was loaded with */
  loaded: ISettingsDraft;

  /* The revision this section's next Save carries today */
  revision: number;

  /* The configuration the save returned, as a draft */
  returned: ISettingsDraft;

  /* The revision the returned configuration is at */
  returnedRevision: number;

  /* The section deciding */
  section: SettingsSection;
}

/**
 * One control as a read-only row: the label above it and the value it holds.
 * @public
 * @interface
 */
export interface ISettingsRow {
  /* The control, as the editor addresses it */
  field: string;

  /* The label the page puts above it */
  label: string;

  /* The value as a person reads it */
  value: string;
}

/**
 * Every control the settings page draws, as the editor addresses it.
 *
 * The three profile fields, the formats checkbox group, one target score per format, and every remaining setting under
 * its own name. Derived from the settings shape rather than listed again, so a setting that is renamed stops
 * compiling here
 * @public
 */
export type TSettingsControl =
  'abbreviation' | 'description' | 'name' | `targetScore.${GameType}` | Exclude<keyof TLeagueSettings, 'targetScore'>;
