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
 * ████████████████████████████████████████ #utils/account/read-state/utils.ts █████████████████████████████████████████
 *
 * Decides what a page draws for a read of the signed-in player's own data.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import { UNAUTHORIZED_STATUS } from './constants';
import { AccountReadState } from './enums';
import type { IAccountReadStateInput } from './types';

/**
 * Decides what a page should draw for a read of the signed-in player's own data.
 *
 * Unauthorized is separated from every other failure because it is the one the player cannot fix by retrying: their
 * session ended, and the only useful thing a page can do is take them to sign in with their destination attached. A
 * resolved read holding no data is a failure rather than a pending one; there is nothing to draw and no request left
 * to wait for
 * @public
 * @function
 * @param input - The request's status, its error status, and whether it produced data
 * @returns The state the page should render
 */
export function resolveAccountReadState(input: IAccountReadStateInput): AccountReadState {
  if (input.errorStatusCode === UNAUTHORIZED_STATUS) {
    return AccountReadState.UNAUTHORIZED;
  }

  if (input.status === 'error') {
    return AccountReadState.FAILED;
  }

  if (input.status === 'success') {
    return input.hasData ? AccountReadState.READY : AccountReadState.FAILED;
  }

  return AccountReadState.PENDING;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(resolveAccountReadState, {
  name: 'Resolve Account Read State',
  description: "Decides what a page should draw for a read of the signed-in player's own data.",
});
