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
 * ███████████████████████████████████████ #utils/leagues/display/utils.test.ts ████████████████████████████████████████
 *
 * Unit tests for the league settings, invite link and member count copy.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import type { IInviteLink } from '#shared/leagues';
import { InviteLinkState } from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import { describeInviteLink, describeLeagueSettings, describeMemberCount, toDayMonthYear } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A usable link the cases vary one field at a time; midday, so the date reads the same in every time zone
 * @internal
 * @constant
 */
const LINK: IInviteLink = {
  expiresAt: '2026-09-17T12:00:00.000Z',
  expiresInDays: 7,
  id: 'id',
  maxUses: 5,
  state: InviteLinkState.USABLE,
  token: 'token',
  useCount: 2,
};

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(toDayMonthYear), (): void => {
    it('writes day, month and year, and nothing for an unusable value', (): void => {
      expect(toDayMonthYear(LINK.expiresAt)).toBe('17 September 2026');
      expect(toDayMonthYear(null)).toBe('');
    });
  });

  describe(symbolName(describeMemberCount), (): void => {
    it('is singular for one person', (): void => {
      expect(describeMemberCount(1)).toBe('1 person plays here.');
      expect(describeMemberCount(4)).toBe('4 people play here.');
    });
  });

  describe(symbolName(describeInviteLink), (): void => {
    it('gives a usable link its expiry and uses', (): void => {
      expect(describeInviteLink(LINK)).toBe('Expires 17 September 2026. Used 2 of 5');
      expect(
        describeInviteLink({
          ...LINK,
          maxUses: null,
          useCount: 3,
        }),
      ).toBe('Expires 17 September 2026. Used 3 times · no limit');
    });

    it('gives each retired link its status line', (): void => {
      expect(
        describeInviteLink({
          ...LINK,
          maxUses: 1,
          state: InviteLinkState.EXHAUSTED,
          useCount: 1,
        }),
      ).toBe('Last link: used 1 of 1');
      expect(describeInviteLink({ ...LINK, state: InviteLinkState.EXPIRED })).toBe(
        'Last link: expired 17 September 2026 · used 2 of 5',
      );
      expect(
        describeInviteLink({
          ...LINK,
          maxUses: null,
          state: InviteLinkState.EXPIRED,
          useCount: 3,
        }),
      ).toBe('Last link: expired 17 September 2026 · used 3 times');
      expect(describeInviteLink({ ...LINK, state: InviteLinkState.REVOKED })).toBe('Last link: revoked');
    });
  });

  describe(symbolName(describeLeagueSettings), (): void => {
    it('describes the standard settings in the four lines the page shows', (): void => {
      expect(describeLeagueSettings(STANDARD_LEAGUE_SETTINGS)).toEqual([
        'Formats: Singles, Doubles, Cutthroat',
        'Games to 11, cutthroat to 7. Win by 2. Best of 1.',
        'Results: confirmed by the other players, or accepted automatically after 24 hours if nobody disputes.',
        'Ratings: on, provisional for the first 10 games.',
      ]);
    });

    it('names only the formats played, and leaves best-of out of a cutthroat-only league', (): void => {
      const lines: string[] = describeLeagueSettings({
        ...STANDARD_LEAGUE_SETTINGS,
        allowedGameTypes: [GameType.CUTTHROAT],
      });

      expect(lines.slice(0, 2)).toEqual(['Formats: Cutthroat', 'Cutthroat to 7. Win by 2.']);
    });

    it('names each paired format when only one of them is played', (): void => {
      expect(describeLeagueSettings({ ...STANDARD_LEAGUE_SETTINGS, allowedGameTypes: [GameType.DOUBLES] })[1]).toBe(
        'Doubles to 11. Win by 2. Best of 1.',
      );
    });
  });
});
