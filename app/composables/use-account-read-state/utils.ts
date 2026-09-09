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
 * ███████████████████████████████████ #composables/use-account-read-state/utils.ts ████████████████████████████████████
 *
 * Tracks a private account read and leaves for sign-in when its session ends.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

import { defineSymbol } from '#shared/utils/symbol';
import { AccountReadState, type IAccountReadStateInput, resolveAccountReadState } from '~/utils/account/read-state';
import { SIGN_IN_ROUTE } from '~/utils/marketing/routes';
import { buildGatedReturnPath } from '~/utils/session/gate';

/**
 * Tracks a read of the signed-in player's own data, and leaves for sign-in when the session behind it ends.
 *
 * Written once because all three private reads answer the same way and the unauthorized case is the one that must not
 * be left to a page to remember: a read that comes back 401 has already had its session cleared by the endpoint, so
 * retrying it forever is the one thing a page must not offer. The redirect is built with the route gate's own builder,
 * so a page and the middleware never disagree about where the visitor was going.
 * @public
 * @function
 * @param read - A getter for the request's status, its error status, and whether it produced data
 * @returns The state the caller should render
 */
export function useAccountReadState(read: () => IAccountReadStateInput): ComputedRef<AccountReadState> {
  const route: ReturnType<typeof useRoute> = useRoute();
  const { session }: ReturnType<typeof useUserSession> = useUserSession();

  const state: ComputedRef<AccountReadState> = computed((): AccountReadState => resolveAccountReadState(read()));

  watch(
    state,
    (current: AccountReadState): void => {
      if (current !== AccountReadState.UNAUTHORIZED) {
        return;
      }

      /* The endpoint cleared the sealed cookie before answering 401, but nothing has told the client that. Assigning
         the session state rather than calling `clear()`: `clear()` awaits a DELETE of a session that is already gone
         and only empties the state once that request resolves, so the one failure mode it adds is the state staying
         populated. This has to be settled before the navigation rather than after it, because the destination reads
         it on arrival — sign-in bounces a visitor it believes is signed in straight back to where they came from, and
         that page reads again, 401s again, and returns here. Left stale, this is a loop rather than a wrong hop.

         Nothing else needs dropping. The gate refuses every private route once this is empty, so a payload cached
         from the ended session has no page left to render it, and signing back in is a document navigation that
         rebuilds the payload from scratch */
      session.value = null;

      // Replace rather than push: a page the session can no longer reach should not sit in history behind sign-in
      void navigateTo(buildGatedReturnPath(SIGN_IN_ROUTE, route.fullPath), { replace: true });
    },
    { immediate: true },
  );

  return state;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(useAccountReadState, {
  name: 'Use Account Read State',
  description: "Tracks a read of the signed-in player's own data, and leaves for sign-in when its session ends.",
});
