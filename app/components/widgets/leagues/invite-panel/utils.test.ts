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
 * ██████████████████████████████ #components/widgets/leagues/invite-panel/utils.test.ts ███████████████████████████████
 *
 * Unit tests for the invite-panel write settler.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';
import { WriteFailure } from '~/utils/leagues/write-failure';

import { INVITE_NOT_LIVE_MESSAGE, INVITE_STALE_MESSAGE, INVITE_UPDATE_FAILED_MESSAGE } from './constants';
import { settleInviteWrite } from './utils';

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(settleInviteWrite), (): void => {
    it('tells a dead link apart from a replaced one, whatever the re-read returned', (): void => {
      expect(settleInviteWrite(WriteFailure.GONE, false)).toBe(INVITE_NOT_LIVE_MESSAGE);
      expect(settleInviteWrite(WriteFailure.GONE, true)).toBe(INVITE_NOT_LIVE_MESSAGE);
      expect(settleInviteWrite(WriteFailure.CONFLICT, false)).toBe(INVITE_STALE_MESSAGE);
      expect(settleInviteWrite(WriteFailure.CONFLICT, true)).toBe(INVITE_STALE_MESSAGE);
    });

    it('never claims a link was replaced when nothing replaced it', (): void => {
      expect(settleInviteWrite(WriteFailure.GONE, false)).not.toBe(INVITE_STALE_MESSAGE);
    });

    it('lets a re-read that found the write speak for itself, and alerts only when it found nothing', (): void => {
      expect(settleInviteWrite(WriteFailure.UNCERTAIN, true)).toBeNull();
      expect(settleInviteWrite(WriteFailure.UNCERTAIN, false)).toBe(INVITE_UPDATE_FAILED_MESSAGE);
      expect(settleInviteWrite(WriteFailure.FORBIDDEN, true)).toBeNull();
      expect(settleInviteWrite(WriteFailure.NOT_FOUND, false)).toBe(INVITE_UPDATE_FAILED_MESSAGE);
    });
  });
});
