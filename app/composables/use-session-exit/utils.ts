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
 * ██████████████████████████████████████ #composables/use-session-exit/utils.ts ███████████████████████████████████████
 *
 * The exits a league-entry page takes when a write answers 401 or a welcome-owing 403.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import { defineSymbol } from '#shared/utils/symbol';
import { SIGN_IN_ROUTE, WELCOME_ROUTE } from '~/utils/marketing/routes';
import { buildGatedReturnPath } from '~/utils/session/gate';

import type { ISessionExit } from './types';

/**
 * Builds the exits a league-entry page takes when a write answers 401 or 403.
 *
 * A 401 means the endpoint already cleared the sealed cookie; the client's copy is emptied before navigating, for the
 * same reason `useAccountReadState` does it, or sign-in would bounce the visitor straight back. A 403 from a league
 * write is either a missing role or an account still owing /welcome; only the refreshed session can tell which, and
 * only the second has somewhere to go. Both exits encode the return path with the gate's own builder
 * @public
 * @function
 * @returns The two exits
 */
export function useSessionExit(): ISessionExit {
  const route: ReturnType<typeof useRoute> = useRoute();
  const { fetch: refreshSession, session, user }: ReturnType<typeof useUserSession> = useUserSession();

  return {
    async toSignIn(): Promise<void> {
      session.value = null;

      await navigateTo(buildGatedReturnPath(SIGN_IN_ROUTE, route.fullPath), { replace: true });
    },

    async toWelcomeIfOwed(): Promise<boolean> {
      await refreshSession();

      if (!user.value?.needsWelcome) {
        return false;
      }

      await navigateTo(buildGatedReturnPath(WELCOME_ROUTE, route.fullPath), { replace: true });

      return true;
    },
  };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so a unit suite can title its describe block from the source symbol
defineSymbol(useSessionExit, {
  name: 'Use Session Exit',
  description: 'Builds the exits a league-entry page takes when a write answers 401 or 403.',
});
