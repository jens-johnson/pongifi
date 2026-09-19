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
 * ███████████████████████████████ #components/widgets/leagues/rules-panel/utils.test.ts ███████████████████████████████
 *
 * Unit tests for the rules card's summary line and labelled rows.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import type { TLeagueSettings } from '#shared/league-settings';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import type { ILeagueRuleBlock, ILeagueRuleGroup, ILeagueRuleRow } from './types';
import { summarizeLeagueSettings, toLeagueRuleGroups } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A league that plays cutthroat and nothing else, where every singles and doubles rule is meaningless
 * @internal
 * @constant
 */
const CUTTHROAT_ONLY: TLeagueSettings = { ...STANDARD_LEAGUE_SETTINGS, allowedGameTypes: [GameType.CUTTHROAT] };

/**
 * A league that plays singles and doubles and never cutthroat, where no rule needs to say whose it is
 * @internal
 * @constant
 */
const PAIRED_ONLY: TLeagueSettings = {
  ...STANDARD_LEAGUE_SETTINGS,
  allowedGameTypes: [GameType.SINGLES, GameType.DOUBLES],
};

/**
 * Finds a group by its heading, so a case names the group it means rather than its position
 * @internal
 * @function
 * @param settings - The settings to lay out
 * @param heading - The group's heading
 * @returns The group
 * @throws When the settings lay out no group under that heading
 */
function groupOf(settings: TLeagueSettings, heading: string): ILeagueRuleGroup {
  const group: ILeagueRuleGroup | undefined = toLeagueRuleGroups(settings).find(
    (candidate: ILeagueRuleGroup): boolean => candidate.heading === heading,
  );

  if (!group) {
    throw new Error(`no ${heading} group`);
  }

  return group;
}

/**
 * Every row of a group, flattened out of its blocks
 * @internal
 * @function
 * @param group - The group
 * @returns The rows, in display order
 */
function rowsOf(group: ILeagueRuleGroup): ILeagueRuleRow[] {
  return group.blocks.flatMap((block: ILeagueRuleBlock): ILeagueRuleRow[] => block.rows);
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(summarizeLeagueSettings), (): void => {
    it('names the standard settings in one terse line, with no units', (): void => {
      expect(summarizeLeagueSettings(STANDARD_LEAGUE_SETTINGS)).toBe(
        'Singles and doubles to 11, cutthroat to 7 · win by 2 · best of 1 · results confirmed · ratings on',
      );
    });

    it('names singles and doubles apart when their targets differ', (): void => {
      expect(
        summarizeLeagueSettings({
          ...STANDARD_LEAGUE_SETTINGS,
          targetScore: { ...STANDARD_LEAGUE_SETTINGS.targetScore, [GameType.DOUBLES]: 21 },
        }),
      ).toBe('Singles to 11, doubles to 21, cutthroat to 7 · win by 2 · best of 1 · results confirmed · ratings on');
    });

    it('leaves best of out of a cutthroat-only league, and omits the formats it does not play', (): void => {
      expect(summarizeLeagueSettings(CUTTHROAT_ONLY)).toBe(
        'Cutthroat to 7 · win by 2 · results confirmed · ratings on',
      );
    });

    it('says results as recorded and ratings off when they are', (): void => {
      expect(
        summarizeLeagueSettings({
          ...STANDARD_LEAGUE_SETTINGS,
          ratingEnabled: false,
          requireConfirmation: false,
        }),
      ).toBe('Singles and doubles to 11, cutthroat to 7 · win by 2 · best of 1 · results as recorded · ratings off');
    });
  });

  describe(symbolName(toLeagueRuleGroups), (): void => {
    it('lays out four groups in the order the card draws them', (): void => {
      expect(
        toLeagueRuleGroups(STANDARD_LEAGUE_SETTINGS).map((group: ILeagueRuleGroup): string => group.heading),
      ).toEqual(['Formats', 'Scoring', 'Results', 'Ratings']);
    });

    it('names the allowed formats in one row and labels the singles and doubles rules in a mixed league', (): void => {
      const formats: ILeagueRuleGroup = groupOf(STANDARD_LEAGUE_SETTINGS, 'Formats');

      expect(formats.blocks.map((block: ILeagueRuleBlock): string | null => block.label)).toEqual([
        null,
        'Singles and doubles',
        null,
      ]);
      expect(rowsOf(formats)).toEqual([
        { label: 'Formats', value: 'Singles, doubles and cutthroat' },
        { label: 'Best of', value: '1' },
        { label: 'Serve changes every', value: '2 points' },
        { label: 'Expedite system', value: 'Off' },
        { label: 'Cutthroat time cap', value: '15 minutes' },
      ]);
    });

    it('drops the sub-label when cutthroat is not played', (): void => {
      const formats: ILeagueRuleGroup = groupOf(PAIRED_ONLY, 'Formats');

      expect(formats.blocks.map((block: ILeagueRuleBlock): string | null => block.label)).toEqual([null, null]);
      expect(rowsOf(formats).map((row: ILeagueRuleRow): string => row.label)).toEqual([
        'Formats',
        'Best of',
        'Serve changes every',
        'Expedite system',
      ]);
    });

    it('shows no best-of, service or expedite row anywhere in a cutthroat-only league', (): void => {
      const labels: string[] = toLeagueRuleGroups(CUTTHROAT_ONLY)
        .flatMap(rowsOf)
        .map((row: ILeagueRuleRow): string => row.label);

      expect(labels).not.toContain('Best of');
      expect(labels).not.toContain('Serve changes every');
      expect(labels).not.toContain('Expedite system');
      expect(labels).toContain('Cutthroat time cap');
      expect(rowsOf(groupOf(CUTTHROAT_ONLY, 'Formats'))[0]).toEqual({ label: 'Formats', value: 'Cutthroat' });
    });

    it('reads a time cap of zero as no cap', (): void => {
      expect(rowsOf(groupOf({ ...STANDARD_LEAGUE_SETTINGS, cutthroatTimeCap: 0 }, 'Formats'))).toContainEqual({
        label: 'Cutthroat time cap',
        value: 'No cap',
      });
    });

    it('gives every allowed format its own explicit target, then the margin', (): void => {
      expect(rowsOf(groupOf(STANDARD_LEAGUE_SETTINGS, 'Scoring'))).toEqual([
        { label: 'Singles to', value: '11' },
        { label: 'Doubles to', value: '11' },
        { label: 'Cutthroat to', value: '7' },
        { label: 'Win by', value: '2 points' },
      ]);
    });

    it('carries the confirmation window on the confirmation row, and drops it when confirmation is off', (): void => {
      expect(rowsOf(groupOf(STANDARD_LEAGUE_SETTINGS, 'Results'))).toEqual([
        { label: 'Who can create games', value: 'Any player' },
        { label: 'Who can record results', value: 'The players in the game' },
        { label: 'Results need confirmation', value: 'On · 24 hours' },
        { label: 'Amendment window', value: '48 hours' },
        { label: 'Walkover grace', value: '10 minutes' },
      ]);
      expect(rowsOf(groupOf({ ...STANDARD_LEAGUE_SETTINGS, requireConfirmation: false }, 'Results'))).toContainEqual({
        label: 'Results need confirmation',
        value: 'Off',
      });
    });

    it('names the provisional count only while ratings are on', (): void => {
      expect(rowsOf(groupOf(STANDARD_LEAGUE_SETTINGS, 'Ratings'))).toEqual([
        { label: 'Ratings', value: 'On' },
        { label: 'Provisional games', value: '10 games' },
      ]);
      expect(rowsOf(groupOf({ ...STANDARD_LEAGUE_SETTINGS, ratingEnabled: false }, 'Ratings'))).toEqual([
        { label: 'Ratings', value: 'Off' },
      ]);
    });
  });
});
