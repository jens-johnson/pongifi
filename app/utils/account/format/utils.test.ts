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
 * ████████████████████████████████████████ #utils/account/format/utils.test.ts ████████████████████████████████████████
 *
 * Unit tests for the account display formatters.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { toInitials, toMonthYear, toRoleLabel } from './utils';

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(toInitials), (): void => {
    it('takes the first and last initial of an ordinary name', (): void => {
      expect(toInitials('Maya Rodriguez')).toBe('MR');
    });

    it('skips a middle name rather than crowding the circle', (): void => {
      expect(toInitials('Maya Elena Rodriguez')).toBe('MR');
    });

    it('uses the single initial available from a one-word name', (): void => {
      expect(toInitials('Maya')).toBe('M');
    });

    it('ignores the extra whitespace a pasted name arrives with', (): void => {
      expect(toInitials('  Maya   Rodriguez  ')).toBe('MR');
    });

    it('returns nothing rather than a broken avatar for a name with no letters', (): void => {
      expect(toInitials('   ')).toBe('');
    });

    it('takes whole characters, so an emoji name is not split into a broken pair', (): void => {
      expect(toInitials('🏓')).toBe('🏓');
    });
  });

  describe(symbolName(toMonthYear), (): void => {
    it('renders a timestamp as the month and year', (): void => {
      expect(toMonthYear('2026-09-08T22:10:00.000Z')).toBe('September 2026');
    });

    it('returns nothing for a value that is not a date, rather than rendering Invalid Date', (): void => {
      expect(toMonthYear('not a date')).toBe('');
    });
  });

  describe(symbolName(toRoleLabel), (): void => {
    it('title-cases a schema enum member', (): void => {
      expect(toRoleLabel('COMMISSIONER')).toBe('Commissioner');
      expect(toRoleLabel('PLAYER')).toBe('Player');
    });
  });
});
