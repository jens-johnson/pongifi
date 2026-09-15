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
 * ███████████████████████████████████████ #utils/leagues/settings/utils.test.ts ███████████████████████████████████████
 *
 * Unit tests for the league settings page's editor rules.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { GameCreator, ResultRecorder } from '#shared/domain';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import type { ILeagueConfiguration, ISaveSettingsRequest } from '#shared/leagues';
import { SETTINGS_SECTION_FIELDS, SettingsSection } from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import { WriteFailure } from '../write-failure';
import { SETTINGS_SECTION_CONTROL_ORDER } from './constants';
import { SettingsSectionAlert, UncertainReconciliation } from './enums';
import type { ISectionAdoption, ISettingsDraft, ISettingsRow, TSectionValidationResult } from './types';
import {
  buildSectionRequest,
  collectPersistedFaults,
  isFieldVisible,
  isSectionDirty,
  matchesSubmittedSection,
  readWholeNumberInput,
  reconcileUncertainSave,
  resolveSectionAdoption,
  toFieldDisplayValue,
  toPersistedFaultErrors,
  toRefusalAlert,
  toSectionRows,
  toSettingsDraft,
} from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The message the provisional game count's own bounds produce, which the page shows rather than wording it again
 * @internal
 * @constant
 */
const PROVISIONAL_MESSAGE: string = 'Enter a whole number from 1 to 1,000.';

/**
 * A league configuration at its standard settings, which every case varies one field of
 * @internal
 * @constant
 */
const CONFIGURATION: ILeagueConfiguration = {
  abbreviation: 'OFF',
  configurationRevision: 4,
  description: 'Our office squad',
  name: 'Office League',
  settings: STANDARD_LEAGUE_SETTINGS,
};

/**
 * A configuration with some of its stored settings replaced, the way a hand-edited row would arrive
 * @internal
 * @function
 * @param overrides - The stored settings this case changes
 * @returns The configuration
 */
function configurationWith(overrides: Partial<Record<string, unknown>>): ILeagueConfiguration {
  return {
    ...CONFIGURATION,
    settings: { ...STANDARD_LEAGUE_SETTINGS, ...overrides } as ILeagueConfiguration['settings'],
  };
}

/**
 * The page's draft with one section's field replaced
 * @internal
 * @function
 * @param section - The section to change
 * @param overrides - The fields this case changes
 * @returns The draft
 */
function draftWith(section: SettingsSection, overrides: Record<string, unknown>): ISettingsDraft {
  const draft: ISettingsDraft = toSettingsDraft(CONFIGURATION);

  return { ...draft, [section]: { ...draft[section], ...overrides } };
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(readWholeNumberInput), (): void => {
    it('reads a whole number, surrounding space included', (): void => {
      expect(readWholeNumberInput('2')).toBe(2);
      expect(readWholeNumberInput('0')).toBe(0);
      expect(readWholeNumberInput(' 21 ')).toBe(21);
    });

    it('leaves anything else exactly as typed, so the field shows its own message', (): void => {
      // The separator the range message itself prints is the one a person is most likely to type back
      expect(readWholeNumberInput('1,440')).toBe('1,440');
      expect(readWholeNumberInput('')).toBe('');
      expect(readWholeNumberInput('2.5')).toBe('2.5');
      expect(readWholeNumberInput('-1')).toBe('-1');
      expect(readWholeNumberInput('two')).toBe('two');
      expect(readWholeNumberInput('99999999999999999999')).toBe('99999999999999999999');
    });
  });

  describe(symbolName(toSettingsDraft), (): void => {
    it('draws every number as text and an absent description as an empty field', (): void => {
      const draft: ISettingsDraft = toSettingsDraft({ ...CONFIGURATION, description: null });

      expect(draft[SettingsSection.IDENTITY]).toEqual({
        abbreviation: 'OFF',
        description: '',
        name: 'Office League',
      });
      expect(draft[SettingsSection.FORMATS].winningMargin).toBe('2');
      expect(draft[SettingsSection.RATINGS].provisionalGames).toBe('10');
      expect(draft[SettingsSection.RESULTS].resultConfirmationWindow).toBe('24');
    });

    it('copies the formats and the target scores rather than sharing them with the league', (): void => {
      const draft: ISettingsDraft = toSettingsDraft(CONFIGURATION);

      draft[SettingsSection.FORMATS].allowedGameTypes.pop();
      draft[SettingsSection.FORMATS].targetScore[GameType.SINGLES] = 21;

      expect(STANDARD_LEAGUE_SETTINGS.allowedGameTypes).toHaveLength(3);
      expect(STANDARD_LEAGUE_SETTINGS.targetScore[GameType.SINGLES]).toBe(11);
    });
  });

  describe(symbolName(isSectionDirty), (): void => {
    it('finds no change in a freshly loaded page', (): void => {
      const loaded: ISettingsDraft = toSettingsDraft(CONFIGURATION);

      for (const section of Object.values(SettingsSection)) {
        expect(isSectionDirty(section, toSettingsDraft(CONFIGURATION), loaded)).toBe(false);
      }
    });

    it('marks only the section that changed', (): void => {
      const loaded: ISettingsDraft = toSettingsDraft(CONFIGURATION);
      const draft: ISettingsDraft = draftWith(SettingsSection.FORMATS, { winningMargin: '3' });

      expect(isSectionDirty(SettingsSection.FORMATS, draft, loaded)).toBe(true);
      expect(isSectionDirty(SettingsSection.IDENTITY, draft, loaded)).toBe(false);
      expect(isSectionDirty(SettingsSection.RATINGS, draft, loaded)).toBe(false);
      expect(isSectionDirty(SettingsSection.RESULTS, draft, loaded)).toBe(false);
    });

    it('counts a retyped field as a change even when it reads as the same number', (): void => {
      // Save is enabled by what the field shows, so a person is never told a section is clean while it shows 02
      expect(
        isSectionDirty(
          SettingsSection.FORMATS,
          draftWith(SettingsSection.FORMATS, { winningMargin: '02' }),
          toSettingsDraft(CONFIGURATION),
        ),
      ).toBe(true);
    });
  });

  describe(symbolName(buildSectionRequest), (): void => {
    it('sends the Identity section as the create form would store it', (): void => {
      const result: TSectionValidationResult<ISaveSettingsRequest> = buildSectionRequest(
        SettingsSection.IDENTITY,
        draftWith(SettingsSection.IDENTITY, {
          abbreviation: ' off ',
          description: '  ',
          name: '  New name  ',
        }),
        4,
      );

      expect(result).toEqual({
        ok: true,
        value: {
          identity: {
            abbreviation: 'OFF',
            description: null,
            name: 'New name',
          },
          revision: 4,
          section: SettingsSection.IDENTITY,
          settings: {},
        },
      });
    });

    it('refuses an Identity field with the create form message and focuses the first one listed', (): void => {
      expect(
        buildSectionRequest(
          SettingsSection.IDENTITY,
          draftWith(SettingsSection.IDENTITY, { abbreviation: '', name: '' }),
          4,
        ),
      ).toEqual({
        errors: { abbreviation: 'Give the league a short mark.', name: 'Give the league a name.' },
        focus: 'name',
        ok: false,
      });
    });

    it('sends exactly the fields the section owns, hidden ones included', (): void => {
      const result: TSectionValidationResult<ISaveSettingsRequest> = buildSectionRequest(
        SettingsSection.FORMATS,
        draftWith(SettingsSection.FORMATS, { allowedGameTypes: [GameType.SINGLES] }),
        4,
      );

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(Object.keys(result.value.settings).sort()).toEqual(
          [...SETTINGS_SECTION_FIELDS[SettingsSection.FORMATS]].sort(),
        );

        // The cutthroat target and the cap are hidden in a singles-only league and travel unchanged all the same
        expect(result.value.settings.targetScore?.[GameType.CUTTHROAT]).toBe(7);
        expect(result.value.settings.cutthroatTimeCap).toBe(15);
      }
    });

    it('refuses a typed thousands separator rather than reading it as a number', (): void => {
      expect(
        buildSectionRequest(
          SettingsSection.FORMATS,
          draftWith(SettingsSection.FORMATS, { cutthroatTimeCap: '1,440' }),
          4,
        ),
      ).toEqual({
        errors: { cutthroatTimeCap: 'Enter a whole number from 0 to 1,440.' },
        focus: 'cutthroatTimeCap',
        ok: false,
      });
    });

    it('refuses an empty format list before any request, ahead of a numeric fault in the same section', (): void => {
      const result: TSectionValidationResult<ISaveSettingsRequest> = buildSectionRequest(
        SettingsSection.FORMATS,
        draftWith(SettingsSection.FORMATS, { allowedGameTypes: [], winningMargin: '0' }),
        4,
      );

      expect(result).toMatchObject({ focus: 'allowedGameTypes', ok: false });

      if (!result.ok) {
        expect(result.errors.allowedGameTypes).toBe('A league plays at least one format.');
        expect(result.errors.winningMargin).toBe('Enter a whole number from 1 to 21.');
      }
    });

    it('focuses the first control the section lists, not the first that happens to fail', (): void => {
      expect(
        buildSectionRequest(
          SettingsSection.FORMATS,
          draftWith(SettingsSection.FORMATS, { serviceInterval: '0', winningMargin: '0' }),
          4,
        ),
      ).toMatchObject({ focus: 'winningMargin', ok: false });
    });

    it('lets a section save while another section carries a fault', (): void => {
      // The rule the whole-configuration veto broke: a Ratings fault must not stop a Formats save
      const draft: ISettingsDraft = { ...draftWith(SettingsSection.RATINGS, { provisionalGames: '0' }) };

      expect(buildSectionRequest(SettingsSection.FORMATS, draft, 4)).toMatchObject({ ok: true });
      expect(buildSectionRequest(SettingsSection.RATINGS, draft, 4)).toEqual({
        errors: { provisionalGames: PROVISIONAL_MESSAGE },
        focus: 'provisionalGames',
        ok: false,
      });
    });

    it('carries the revision it was given, whichever section is saving', (): void => {
      for (const section of Object.values(SettingsSection)) {
        expect(buildSectionRequest(section, toSettingsDraft(CONFIGURATION), 9)).toMatchObject({
          ok: true,
          value: { revision: 9, section },
        });
      }
    });

    it('sends the Results and Ratings sections as whole numbers, not as text', (): void => {
      const results: TSectionValidationResult<ISaveSettingsRequest> = buildSectionRequest(
        SettingsSection.RESULTS,
        toSettingsDraft(CONFIGURATION),
        4,
      );

      expect(results).toMatchObject({
        ok: true,
        value: {
          settings: {
            requireConfirmation: true,
            resultAmendmentWindow: 48,
            resultConfirmationWindow: 24,
            whoCanCreateGames: GameCreator.PLAYER,
            whoCanRecordResults: ResultRecorder.PARTICIPANTS,
          },
        },
      });

      expect(buildSectionRequest(SettingsSection.RATINGS, toSettingsDraft(CONFIGURATION), 4)).toMatchObject({
        ok: true,
        value: { settings: { provisionalGames: 10, ratingEnabled: true } },
      });
    });
  });

  describe(symbolName(collectPersistedFaults), (): void => {
    it('finds nothing in a league at the standard settings', (): void => {
      expect(collectPersistedFaults(CONFIGURATION.settings)).toEqual([]);
      expect(toPersistedFaultErrors(CONFIGURATION.settings)).toEqual({});
    });

    it('names every stored fault, in the order the page lists its controls', (): void => {
      const faulted: ILeagueConfiguration = configurationWith({ provisionalGames: 0, winningMargin: 0 });

      expect(collectPersistedFaults(faulted.settings)).toEqual(['winningMargin', 'provisionalGames']);
      expect(toPersistedFaultErrors(faulted.settings)).toEqual({
        provisionalGames: PROVISIONAL_MESSAGE,
        winningMargin: 'Enter a whole number from 1 to 21.',
      });
    });

    it('names a fault the page would otherwise be hiding, which is what makes it repairable', (): void => {
      expect(collectPersistedFaults(configurationWith({ provisionalGames: 0, ratingEnabled: false }).settings)).toEqual(
        ['provisionalGames'],
      );
    });
  });

  describe(symbolName(isFieldVisible), (): void => {
    it('draws every control of a league that plays all three formats', (): void => {
      const draft: ISettingsDraft = toSettingsDraft(CONFIGURATION);

      for (const field of SETTINGS_SECTION_CONTROL_ORDER[SettingsSection.FORMATS]) {
        expect(isFieldVisible(field, draft, [])).toBe(true);
      }
    });

    it("hides a format's target score, the cutthroat cap and the singles and doubles rules by the formats played", (): void => {
      const cutthroatOnly: ISettingsDraft = draftWith(SettingsSection.FORMATS, {
        allowedGameTypes: [GameType.CUTTHROAT],
      });

      expect(isFieldVisible('targetScore.SINGLES', cutthroatOnly, [])).toBe(false);
      expect(isFieldVisible('targetScore.CUTTHROAT', cutthroatOnly, [])).toBe(true);
      expect(isFieldVisible('cutthroatTimeCap', cutthroatOnly, [])).toBe(true);

      // The whole sub-group goes, because cutthroat never consults an interval and expedite is not legal in it
      for (const field of ['matchFormat', 'serviceInterval', 'expediteEnabled']) {
        expect(isFieldVisible(field, cutthroatOnly, [])).toBe(false);
      }

      const singlesOnly: ISettingsDraft = draftWith(SettingsSection.FORMATS, {
        allowedGameTypes: [GameType.SINGLES],
      });

      expect(isFieldVisible('cutthroatTimeCap', singlesOnly, [])).toBe(false);
      expect(isFieldVisible('matchFormat', singlesOnly, [])).toBe(true);
    });

    it('hides the confirmation window and the provisional count with their own toggles', (): void => {
      expect(
        isFieldVisible(
          'resultConfirmationWindow',
          draftWith(SettingsSection.RESULTS, { requireConfirmation: false }),
          [],
        ),
      ).toBe(false);
      expect(isFieldVisible('provisionalGames', draftWith(SettingsSection.RATINGS, { ratingEnabled: false }), [])).toBe(
        false,
      );
    });

    it('draws a hidden control anyway when its stored value is the one at fault', (): void => {
      // The rule that makes a stored fault repairable: without it, no section save could ever reach the field
      const ratingsOff: ISettingsDraft = draftWith(SettingsSection.RATINGS, { ratingEnabled: false });

      expect(isFieldVisible('provisionalGames', ratingsOff, [])).toBe(false);
      expect(isFieldVisible('provisionalGames', ratingsOff, ['provisionalGames'])).toBe(true);
    });

    it('keeps a revealed control drawn while a valid replacement is typed but not yet saved', (): void => {
      // The reveal set is read from what is stored, so typing does not make the control disappear before Save
      const corrected: ISettingsDraft = {
        ...draftWith(SettingsSection.RATINGS, { provisionalGames: '10', ratingEnabled: false }),
      };

      expect(isFieldVisible('provisionalGames', corrected, ['provisionalGames'])).toBe(true);
    });
  });

  describe(symbolName(toFieldDisplayValue), (): void => {
    it('reads a value the way a person does, units and all', (): void => {
      const draft: ISettingsDraft = toSettingsDraft(CONFIGURATION);

      expect(toFieldDisplayValue('name', draft)).toBe('Office League');
      expect(toFieldDisplayValue('allowedGameTypes', draft)).toBe('Singles, Doubles, Cutthroat');
      expect(toFieldDisplayValue('targetScore.SINGLES', draft)).toBe('11');
      expect(toFieldDisplayValue('winningMargin', draft)).toBe('2 points');
      expect(toFieldDisplayValue('cutthroatTimeCap', draft)).toBe('15 minutes');
      expect(toFieldDisplayValue('resultConfirmationWindow', draft)).toBe('24 hours');
      expect(toFieldDisplayValue('ratingEnabled', draft)).toBe('On');
      expect(toFieldDisplayValue('whoCanRecordResults', draft)).toBe('The players in the game');
    });

    it('names a cleared description rather than leaving the row blank', (): void => {
      expect(toFieldDisplayValue('description', toSettingsDraft({ ...CONFIGURATION, description: null }))).toBe('None');
    });

    it('shows a stored fault as the value that is stored', (): void => {
      expect(toFieldDisplayValue('winningMargin', toSettingsDraft(configurationWith({ winningMargin: 0 })))).toBe(
        '0 points',
      );
    });
  });

  describe(symbolName(toSectionRows), (): void => {
    it('lists a section top to bottom, leaving out what the league is not playing', (): void => {
      const rows: ISettingsRow[] = toSectionRows(
        SettingsSection.FORMATS,
        draftWith(SettingsSection.FORMATS, { allowedGameTypes: [GameType.CUTTHROAT] }),
        [],
        {},
      );

      expect(rows.map((row: ISettingsRow): string => row.field)).toEqual([
        'allowedGameTypes',
        'targetScore.CUTTHROAT',
        'winningMargin',
        'cutthroatTimeCap',
        'walkoverGracePeriod',
      ]);
      expect(rows[0]).toEqual({
        field: 'allowedGameTypes',
        label: 'Formats',
        message: null,
        value: 'Cutthroat',
      });
    });

    it('puts a revealed fault back into a read-only section, so it is visible to every role', (): void => {
      const rows: ISettingsRow[] = toSectionRows(
        SettingsSection.RATINGS,
        draftWith(SettingsSection.RATINGS, { provisionalGames: '0', ratingEnabled: false }),
        ['provisionalGames'],
        {},
      );

      expect(rows).toEqual([
        {
          field: 'ratingEnabled',
          label: 'Ratings',
          message: null,
          value: 'Off',
        },
        {
          field: 'provisionalGames',
          label: 'Provisional games',
          message: null,
          value: '0 games',
        },
      ]);
    });

    it('carries the message a revealed row is given, so a fault reads as a fault without a control', (): void => {
      const rows: ISettingsRow[] = toSectionRows(
        SettingsSection.RATINGS,
        draftWith(SettingsSection.RATINGS, { provisionalGames: '0', ratingEnabled: false }),
        ['provisionalGames'],
        { provisionalGames: PROVISIONAL_MESSAGE },
      );

      // Only the field the message names takes one; the rest of the section still reads as ordinary values
      expect(rows.map((row: ISettingsRow): [string, string | null] => [row.field, row.message])).toEqual([
        ['ratingEnabled', null],
        ['provisionalGames', PROVISIONAL_MESSAGE],
      ]);
    });
  });

  describe(symbolName(toRefusalAlert), (): void => {
    it('words the refusals a person can act on differently, and every other one the same', (): void => {
      expect(toRefusalAlert(WriteFailure.FORBIDDEN)).toBe(SettingsSectionAlert.FORBIDDEN);
      expect(toRefusalAlert(WriteFailure.RATE_LIMITED)).toBe(SettingsSectionAlert.RATE_LIMITED);

      for (const failure of [WriteFailure.REFUSED, WriteFailure.NOT_FOUND, WriteFailure.GONE]) {
        expect(toRefusalAlert(failure)).toBe(SettingsSectionAlert.REFUSED);
      }
    });
  });

  describe(symbolName(matchesSubmittedSection), (): void => {
    it('reads a stored section as saved when it holds what was sent, text or not', (): void => {
      const request: TSectionValidationResult<ISaveSettingsRequest> = buildSectionRequest(
        SettingsSection.FORMATS,
        draftWith(SettingsSection.FORMATS, { winningMargin: '03' }),
        4,
      );

      expect(request.ok).toBe(true);

      if (request.ok) {
        // Submitted as the number 3 and stored as 3, whatever the field showed
        expect(matchesSubmittedSection(request.value, configurationWith({ winningMargin: 3 }))).toBe(true);
        expect(matchesSubmittedSection(request.value, CONFIGURATION)).toBe(false);
      }
    });

    it('compares every field the Identity section owns', (): void => {
      const request: TSectionValidationResult<ISaveSettingsRequest> = buildSectionRequest(
        SettingsSection.IDENTITY,
        draftWith(SettingsSection.IDENTITY, { description: '' }),
        4,
      );

      expect(request.ok).toBe(true);

      if (request.ok) {
        expect(matchesSubmittedSection(request.value, { ...CONFIGURATION, description: null })).toBe(true);
        expect(matchesSubmittedSection(request.value, CONFIGURATION)).toBe(false);
      }
    });
  });

  describe(symbolName(reconcileUncertainSave), (): void => {
    it('calls a save that is already stored a save, whatever else has moved since', (): void => {
      const request: ISaveSettingsRequest = {
        identity: null,
        revision: 4,
        section: SettingsSection.RATINGS,
        settings: { provisionalGames: 20, ratingEnabled: true },
      };

      expect(
        reconcileUncertainSave(request, { ...configurationWith({ provisionalGames: 20 }), configurationRevision: 9 }),
      ).toBe(UncertainReconciliation.SAVED);
    });

    it('offers the identical request again only while the revision has not moved', (): void => {
      const request: ISaveSettingsRequest = {
        identity: null,
        revision: 4,
        section: SettingsSection.RATINGS,
        settings: { provisionalGames: 20, ratingEnabled: true },
      };

      // The write was lost: nothing was stored and nothing else was written, so the same revision may be sent again
      expect(reconcileUncertainSave(request, CONFIGURATION)).toBe(UncertainReconciliation.RETRY);

      // Something else was written, so the draft is compared before anything is sent
      expect(reconcileUncertainSave(request, { ...CONFIGURATION, configurationRevision: 5 })).toBe(
        UncertainReconciliation.STALE,
      );
    });
  });

  describe(symbolName(resolveSectionAdoption), (): void => {
    it('takes the returned values silently when the section has no draft', (): void => {
      const loaded: ISettingsDraft = toSettingsDraft(CONFIGURATION);
      const adoption: ISectionAdoption = resolveSectionAdoption({
        dirty: false,
        draft: loaded,
        loaded,
        returned: toSettingsDraft({ ...CONFIGURATION, configurationRevision: 5 }),
        returnedRevision: 5,
        revision: 4,
        section: SettingsSection.RATINGS,
      });

      expect(adoption).toEqual({
        adopt: true,
        revision: 5,
        stale: false,
      });
    });

    it('keeps a draft and moves its revision when its own baseline is still current', (): void => {
      const loaded: ISettingsDraft = toSettingsDraft(CONFIGURATION);
      const adoption: ISectionAdoption = resolveSectionAdoption({
        dirty: true,
        draft: draftWith(SettingsSection.RATINGS, { provisionalGames: '20' }),
        loaded,
        returned: loaded,
        returnedRevision: 5,
        revision: 4,
        section: SettingsSection.RATINGS,
      });

      expect(adoption).toEqual({
        adopt: false,
        revision: 5,
        stale: false,
      });
    });

    it('holds a draft at its own revision and calls it stale when the section moved underneath it', (): void => {
      const loaded: ISettingsDraft = toSettingsDraft(CONFIGURATION);
      const adoption: ISectionAdoption = resolveSectionAdoption({
        dirty: true,
        draft: draftWith(SettingsSection.RATINGS, { provisionalGames: '20' }),
        loaded,
        returned: toSettingsDraft(configurationWith({ provisionalGames: 30 })),
        returnedRevision: 5,
        revision: 4,
        section: SettingsSection.RATINGS,
      });

      // Nothing writes during reconciliation, so the draft keeps the revision it would still be saved against
      expect(adoption).toEqual({
        adopt: false,
        revision: 4,
        stale: true,
      });
    });
  });
});
