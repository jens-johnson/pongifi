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
 * ███████████████████████████████████ #composables/use-account-read-state/index.ts ████████████████████████████████████
 *
 * Tracks a private account read and leaves for sign-in when its session ends.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/* ─── Imports ────────────────────────────────────────────────────────────────────────────────────────────────────── */

import type { ComputedRef } from 'vue';

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

  const state: ComputedRef<AccountReadState> = computed((): AccountReadState => resolveAccountReadState(read()));

  watch(
    state,
    (current: AccountReadState): void => {
      if (current !== AccountReadState.UNAUTHORIZED) {
        return;
      }

      // Replace rather than push: a page the session can no longer reach should not sit in history behind sign-in
      void navigateTo(buildGatedReturnPath(SIGN_IN_ROUTE, route.fullPath), { replace: true });
    },
    { immediate: true },
  );

  return state;
}
