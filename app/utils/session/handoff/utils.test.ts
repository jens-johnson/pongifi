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
 * ███████████████████████████████████████ #utils/session/handoff/utils.test.ts ████████████████████████████████████████
 *
 * Unit tests for the session handoff resolver.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { SessionHandoff } from './enums';
import { resolveSessionHandoff } from './utils';

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(resolveSessionHandoff), (): void => {
    it('navigates on the client once the refreshed session agrees with the write', (): void => {
      expect(resolveSessionHandoff({ needsWelcome: false, refreshed: true })).toBe(SessionHandoff.CLIENT);
    });

    it('hands the destination to the server when the refresh produced no session', (): void => {
      // nuxt-auth-utils reports a failed refresh as an absent session, which the route gate reads as signed out
      expect(resolveSessionHandoff({ needsWelcome: false, refreshed: false })).toBe(SessionHandoff.RELOAD);
    });

    it('hands the destination to the server when the session still asks for the welcome step', (): void => {
      expect(resolveSessionHandoff({ needsWelcome: true, refreshed: true })).toBe(SessionHandoff.RELOAD);
    });

    it('does not read the welcome flag of a session that was never refreshed', (): void => {
      expect(resolveSessionHandoff({ needsWelcome: true, refreshed: false })).toBe(SessionHandoff.RELOAD);
    });
  });
});
