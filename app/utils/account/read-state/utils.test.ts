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
 * ██████████████████████████████████████ #utils/account/read-state/utils.test.ts ██████████████████████████████████████
 *
 * Unit tests for the account read state resolver.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { UNAUTHORIZED_STATUS } from './constants';
import { AccountReadState } from './enums';
import type { IAccountReadStateInput } from './types';
import { resolveAccountReadState } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A read that has not failed and has not answered yet, narrowed per case
 * @internal
 * @constant
 */
const IN_FLIGHT: IAccountReadStateInput = {
  errorStatusCode: null,
  hasData: false,
  status: 'pending',
};

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(resolveAccountReadState), (): void => {
    it('waits while the read is in flight', (): void => {
      expect(resolveAccountReadState(IN_FLIGHT)).toBe(AccountReadState.PENDING);
    });

    it('waits while the read has not started', (): void => {
      expect(resolveAccountReadState({ ...IN_FLIGHT, status: 'idle' })).toBe(AccountReadState.PENDING);
    });

    it('renders the page once the read answers with data', (): void => {
      expect(
        resolveAccountReadState({
          ...IN_FLIGHT,
          hasData: true,
          status: 'success',
        }),
      ).toBe(AccountReadState.READY);
    });

    it('offers a retry when the read fails', (): void => {
      expect(
        resolveAccountReadState({
          errorStatusCode: 502,
          hasData: false,
          status: 'error',
        }),
      ).toBe(AccountReadState.FAILED);
    });

    it('sends the player to sign in when the session behind the read has ended', (): void => {
      expect(
        resolveAccountReadState({
          errorStatusCode: UNAUTHORIZED_STATUS,
          hasData: false,
          status: 'error',
        }),
      ).toBe(AccountReadState.UNAUTHORIZED);
    });

    it('keeps unauthorized separate from a retryable failure, since retrying cannot fix it', (): void => {
      expect(
        resolveAccountReadState({
          errorStatusCode: 500,
          hasData: false,
          status: 'error',
        }),
      ).not.toBe(AccountReadState.UNAUTHORIZED);
    });

    it('treats an unauthorized read as unauthorized even while a retry is in flight', (): void => {
      // status returns to pending during a refresh; the stale data behind it belongs to a session that has ended
      expect(
        resolveAccountReadState({
          errorStatusCode: UNAUTHORIZED_STATUS,
          hasData: true,
          status: 'pending',
        }),
      ).toBe(AccountReadState.UNAUTHORIZED);
    });

    it('fails a resolved read that produced no data, rather than waiting on a request that is over', (): void => {
      expect(resolveAccountReadState({ ...IN_FLIGHT, status: 'success' })).toBe(AccountReadState.FAILED);
    });

    it('renders the page again once a retry succeeds', (): void => {
      const failed: IAccountReadStateInput = {
        errorStatusCode: 502,
        hasData: false,
        status: 'error',
      };

      expect(resolveAccountReadState(failed)).toBe(AccountReadState.FAILED);
      expect(
        resolveAccountReadState({
          ...failed,
          errorStatusCode: null,
          hasData: true,
          status: 'success',
        }),
      ).toBe(AccountReadState.READY);
    });
  });
});
