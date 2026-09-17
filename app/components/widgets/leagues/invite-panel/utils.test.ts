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
 * Unit tests for the invite-panel write settler, code captions, file names and link key.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import type { IInviteLink } from '#shared/leagues';
import { InviteLinkState } from '#shared/leagues';
import { symbolName } from '#shared/utils/symbol';
import { WriteFailure } from '~/utils/leagues/write-failure';

import { INVITE_NOT_LIVE_MESSAGE, INVITE_STALE_MESSAGE, INVITE_UPDATE_FAILED_MESSAGE } from './constants';
import { settleInviteWrite, toInviteQrCaptions, toInviteQrFileName, toInviteQrLinkKey } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A usable link the caption cases vary one field at a time; midday, so the date reads the same in every time zone
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

/**
 * The league whose name a caption prints
 * @internal
 * @constant
 */
const LEAGUE_NAME: string = 'Office League';

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

  describe(symbolName(toInviteQrCaptions), (): void => {
    it('prints the league and the day the code stops working', (): void => {
      expect(toInviteQrCaptions(LEAGUE_NAME, LINK)).toEqual([LEAGUE_NAME, 'Expires 17 September 2026']);
    });

    it('says nothing about an expiry it cannot read, rather than printing half a line', (): void => {
      expect(toInviteQrCaptions(LEAGUE_NAME, { ...LINK, expiresAt: null })).toEqual([LEAGUE_NAME]);
    });
  });

  describe(symbolName(toInviteQrLinkKey), (): void => {
    it('keys a code to the link it encodes, not to how often it has been used', (): void => {
      expect(toInviteQrLinkKey(LINK)).toBe('id:token');
      expect(toInviteQrLinkKey({ ...LINK, useCount: LINK.useCount + 1 })).toBe('id:token');
      expect(toInviteQrLinkKey({ ...LINK, id: 'successor' })).toBe('successor:token');
      expect(toInviteQrLinkKey({ ...LINK, token: 'fresh' })).toBe('id:fresh');
    });

    it('keys nothing to a link no code could be drawn from', (): void => {
      expect(toInviteQrLinkKey(null)).toBe('');
      expect(toInviteQrLinkKey({ ...LINK, state: InviteLinkState.REVOKED })).toBe('');
      expect(toInviteQrLinkKey({ ...LINK, token: null })).toBe('');
      expect(toInviteQrLinkKey({ ...LINK, token: '' })).toBe('');
    });
  });

  describe(symbolName(toInviteQrFileName), (): void => {
    it('names the file after the short mark', (): void => {
      expect(toInviteQrFileName('OFF')).toBe('OFF-invite.png');
    });

    it('leaves nothing a path could read in the name', (): void => {
      expect(toInviteQrFileName('../OFF')).toBe('OFF-invite.png');
      expect(toInviteQrFileName('A/B')).toBe('A-B-invite.png');
    });

    it('falls back to a plain name when a short mark carries nothing a file name can', (): void => {
      expect(toInviteQrFileName('・・')).toBe('league-invite.png');
    });
  });
});
