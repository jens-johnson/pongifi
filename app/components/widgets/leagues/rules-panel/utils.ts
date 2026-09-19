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
 * █████████████████████████████████ #components/widgets/leagues/rules-panel/utils.ts ██████████████████████████████████
 *
 * The summary line and the labelled rows of a league's rules card.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { TLeagueSettings } from '#shared/league-settings';
import { LEAGUE_GAME_TYPE_ORDER } from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';
import { GAME_TYPE_LABELS } from '~/utils/leagues/display';
import type { TSettingsControl } from '~/utils/leagues/settings';
import {
  GAME_CREATOR_LABELS,
  RESULT_RECORDER_LABELS,
  SETTINGS_FIELD_LABELS,
  SETTINGS_FIELD_UNITS,
  SETTINGS_SINGLES_DOUBLES_HEADING,
} from '~/utils/leagues/settings';

import {
  RULES_BLOCK_CUTTHROAT,
  RULES_BLOCK_FORMATS,
  RULES_BLOCK_ROWS,
  RULES_BLOCK_SINGLES_DOUBLES,
  RULES_CONFIRMATION_SEPARATOR,
  RULES_FORMATS_HEADING,
  RULES_NO_TIME_CAP,
  RULES_OFF,
  RULES_ON,
  RULES_RATINGS_HEADING,
  RULES_RESULTS_HEADING,
  RULES_SCORING_HEADING,
  RULES_SUMMARY_SEPARATOR,
  RULES_TARGET_SCORE_CONTROLS,
} from './constants';
import type { ILeagueRuleBlock, ILeagueRuleGroup, ILeagueRuleRow } from './types';

/**
 * The formats a league plays, in the order every league surface names them.
 * @internal
 * @function
 * @param settings - The league's stored settings
 * @returns The allowed formats
 */
function toAllowedFormats(settings: TLeagueSettings): GameType[] {
  return LEAGUE_GAME_TYPE_ORDER.filter((format: GameType): boolean => settings.allowedGameTypes.includes(format));
}

/**
 * The allowed formats a match format, a service interval and the expedite system apply to.
 *
 * Cutthroat is always a single game, rotates service on a lost rally and is never expedited (III.II.IX.III,
 * III.II.IX.XIII), so none of those three rules is ever shown for it
 * @internal
 * @function
 * @param allowed - The allowed formats
 * @returns Singles and doubles, as allowed
 */
function toPairedFormats(allowed: readonly GameType[]): GameType[] {
  return allowed.filter((format: GameType): boolean => format !== GameType.CUTTHROAT);
}

/**
 * Raises a phrase's first letter, leaving the rest of it as it was written.
 * @internal
 * @function
 * @param text - The phrase
 * @returns The phrase, opening in upper case
 */
function toSentenceCase(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/**
 * Appends the unit the settings page counts a number in, when it counts it in one.
 * @internal
 * @function
 * @param control - The control, as the settings page addresses it
 * @param value - The stored number
 * @returns The value as a person reads it
 */
function withUnit(control: TSettingsControl, value: number): string {
  const unit: string | undefined = SETTINGS_FIELD_UNITS[control];

  return unit === undefined ? String(value) : `${value} ${unit}`;
}

/**
 * Names the allowed formats as a sentence rather than as a list of keys.
 * @internal
 * @function
 * @param allowed - The allowed formats
 * @returns `Singles, doubles and cutthroat`, down to a single named format
 */
function toFormatsValue(allowed: readonly GameType[]): string {
  const names: string[] = allowed.map((format: GameType): string => GAME_TYPE_LABELS[format].toLowerCase());
  const last: string = names.at(-1) ?? '';

  return toSentenceCase(names.length < 2 ? last : `${names.slice(0, -1).join(', ')} and ${last}`);
}

/**
 * The targets phrase of the summary line, naming every allowed format explicitly enough to be unambiguous.
 * @internal
 * @function
 * @param settings - The league's stored settings
 * @param allowed - The allowed formats
 * @returns `Singles and doubles to 11, cutthroat to 7`
 */
function toTargetsPhrase(settings: TLeagueSettings, allowed: readonly GameType[]): string {
  const paired: GameType[] = toPairedFormats(allowed);
  const shared: boolean =
    paired.length === 2 && settings.targetScore[GameType.SINGLES] === settings.targetScore[GameType.DOUBLES];

  // Two formats played to the same score read as one phrase; unequal targets are always named apart
  const phrases: string[] = shared
    ? [`singles and doubles to ${settings.targetScore[GameType.SINGLES]}`]
    : paired.map(
        (format: GameType): string => `${GAME_TYPE_LABELS[format].toLowerCase()} to ${settings.targetScore[format]}`,
      );

  if (allowed.includes(GameType.CUTTHROAT)) {
    phrases.push(`cutthroat to ${settings.targetScore[GameType.CUTTHROAT]}`);
  }

  return toSentenceCase(phrases.join(', '));
}

/**
 * The Formats group: which formats are played, the rules that apply to singles and doubles, and the cutthroat cap.
 * @internal
 * @function
 * @param settings - The league's stored settings
 * @returns The group
 */
function toFormatsGroup(settings: TLeagueSettings): ILeagueRuleGroup {
  const allowed: GameType[] = toAllowedFormats(settings);
  const paired: GameType[] = toPairedFormats(allowed);
  const playsCutthroat: boolean = allowed.includes(GameType.CUTTHROAT);

  const blocks: ILeagueRuleBlock[] = [
    {
      id: RULES_BLOCK_FORMATS,
      label: null,
      rows: [{ label: SETTINGS_FIELD_LABELS.allowedGameTypes, value: toFormatsValue(allowed) }],
    },
  ];

  // A league that also plays cutthroat says whose rules these three are, exactly as the settings form's legend does
  if (paired.length > 0) {
    blocks.push({
      id: RULES_BLOCK_SINGLES_DOUBLES,
      label: playsCutthroat ? SETTINGS_SINGLES_DOUBLES_HEADING : null,
      rows: [
        { label: SETTINGS_FIELD_LABELS.matchFormat, value: String(settings.matchFormat) },
        { label: SETTINGS_FIELD_LABELS.serviceInterval, value: withUnit('serviceInterval', settings.serviceInterval) },
        { label: SETTINGS_FIELD_LABELS.expediteEnabled, value: settings.expediteEnabled ? RULES_ON : RULES_OFF },
      ],
    });
  }

  if (playsCutthroat) {
    blocks.push({
      id: RULES_BLOCK_CUTTHROAT,
      label: null,
      rows: [
        {
          label: SETTINGS_FIELD_LABELS.cutthroatTimeCap,
          value:
            settings.cutthroatTimeCap === 0
              ? RULES_NO_TIME_CAP
              : withUnit('cutthroatTimeCap', settings.cutthroatTimeCap),
        },
      ],
    });
  }

  return { blocks, heading: RULES_FORMATS_HEADING };
}

/**
 * The Scoring group: one target per allowed format, always explicit, then the margin.
 * @internal
 * @function
 * @param settings - The league's stored settings
 * @returns The group
 */
function toScoringGroup(settings: TLeagueSettings): ILeagueRuleGroup {
  const rows: ILeagueRuleRow[] = toAllowedFormats(settings).map((format: GameType): ILeagueRuleRow => ({
    label: SETTINGS_FIELD_LABELS[RULES_TARGET_SCORE_CONTROLS[format]],
    value: String(settings.targetScore[format]),
  }));

  rows.push({
    label: SETTINGS_FIELD_LABELS.winningMargin,
    value: withUnit('winningMargin', settings.winningMargin),
  });

  return {
    blocks: [
      {
        id: RULES_BLOCK_ROWS,
        label: null,
        rows,
      },
    ],
    heading: RULES_SCORING_HEADING,
  };
}

/**
 * The Results group: who plays, who records, and how a recorded result is accepted.
 * @internal
 * @function
 * @param settings - The league's stored settings
 * @returns The group
 */
function toResultsGroup(settings: TLeagueSettings): ILeagueRuleGroup {
  const confirmation: string = settings.requireConfirmation
    ? `${RULES_ON}${RULES_CONFIRMATION_SEPARATOR}${withUnit('resultConfirmationWindow', settings.resultConfirmationWindow)}`
    : RULES_OFF;

  const rows: ILeagueRuleRow[] = [
    {
      label: SETTINGS_FIELD_LABELS.whoCanCreateGames,
      value: GAME_CREATOR_LABELS[settings.whoCanCreateGames],
    },
    {
      label: SETTINGS_FIELD_LABELS.whoCanRecordResults,
      value: RESULT_RECORDER_LABELS[settings.whoCanRecordResults],
    },
    { label: SETTINGS_FIELD_LABELS.requireConfirmation, value: confirmation },
    {
      label: SETTINGS_FIELD_LABELS.resultAmendmentWindow,
      value: withUnit('resultAmendmentWindow', settings.resultAmendmentWindow),
    },
    {
      label: SETTINGS_FIELD_LABELS.walkoverGracePeriod,
      value: withUnit('walkoverGracePeriod', settings.walkoverGracePeriod),
    },
  ];

  return {
    blocks: [
      {
        id: RULES_BLOCK_ROWS,
        label: null,
        rows,
      },
    ],
    heading: RULES_RESULTS_HEADING,
  };
}

/**
 * The Ratings group: whether games are rated, and how long a rating stays provisional when they are.
 * @internal
 * @function
 * @param settings - The league's stored settings
 * @returns The group
 */
function toRatingsGroup(settings: TLeagueSettings): ILeagueRuleGroup {
  const rows: ILeagueRuleRow[] = [
    { label: SETTINGS_FIELD_LABELS.ratingEnabled, value: settings.ratingEnabled ? RULES_ON : RULES_OFF },
  ];

  // The provisional count decides nothing while ratings are off, so a league that does not rate is not told about it
  if (settings.ratingEnabled) {
    rows.push({
      label: SETTINGS_FIELD_LABELS.provisionalGames,
      value: withUnit('provisionalGames', settings.provisionalGames),
    });
  }

  return {
    blocks: [
      {
        id: RULES_BLOCK_ROWS,
        label: null,
        rows,
      },
    ],
    heading: RULES_RATINGS_HEADING,
  };
}

/**
 * The one line the collapsed card always shows, naming every rule that decides how a game is played and accepted.
 *
 * Terse by design: the units belong to the expanded rows. A format that is not allowed is omitted, unequal targets
 * are named apart, and a cutthroat-only league has no match format to name
 * @public
 * @function
 * @param settings - The league's stored settings
 * @returns `Singles and doubles to 11, cutthroat to 7 · win by 2 · best of 1 · results confirmed · ratings on`
 */
export function summarizeLeagueSettings(settings: TLeagueSettings): string {
  const allowed: GameType[] = toAllowedFormats(settings);
  const rules: string[] = [toTargetsPhrase(settings, allowed), `win by ${settings.winningMargin}`];

  if (toPairedFormats(allowed).length > 0) {
    rules.push(`best of ${settings.matchFormat}`);
  }

  rules.push(settings.requireConfirmation ? 'results confirmed' : 'results as recorded');
  rules.push(settings.ratingEnabled ? 'ratings on' : 'ratings off');

  return rules.join(RULES_SUMMARY_SEPARATOR);
}

/**
 * The four groups of labelled rows the expanded card lays out.
 *
 * Labels are the settings page's own, so a commissioner who opens the editor reads the same words there
 * @public
 * @function
 * @param settings - The league's stored settings
 * @returns Formats, Scoring, Results and Ratings, in that order
 */
export function toLeagueRuleGroups(settings: TLeagueSettings): ILeagueRuleGroup[] {
  return [toFormatsGroup(settings), toScoringGroup(settings), toResultsGroup(settings), toRatingsGroup(settings)];
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(summarizeLeagueSettings, {
  name: 'Summarize League Settings',
  description: 'The one line the collapsed rules card always shows.',
});

defineSymbol(toLeagueRuleGroups, {
  name: 'To League Rule Groups',
  description: 'The four groups of labelled rows the expanded rules card lays out.',
});
