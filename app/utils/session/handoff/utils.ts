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
 * ██████████████████████████████████████████ #utils/session/handoff/utils.ts ██████████████████████████████████████████
 *
 * Decides how a page leaves for its destination after an accepted write.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import { SessionHandoff } from './enums';
import type { ISessionHandoffInput } from './types';

/**
 * Decides how a page leaves for its destination after a write the server has already accepted.
 *
 * Both failure shapes end in the same place for the same reason: the sealed cookie the server just replaced is
 * authoritative and the client's copy is not, so where they disagree the server is asked to render the destination
 * rather than the router being asked to trust stale state. Neither case is treated as a failed write, because the
 * write already happened
 * @public
 * @function
 * @param input - The refreshed session's state
 * @returns Whether the page may navigate on the client or must hand the destination to the server
 */
export function resolveSessionHandoff(input: ISessionHandoffInput): SessionHandoff {
  if (!input.refreshed) {
    return SessionHandoff.RELOAD;
  }

  // A session still asking for the welcome step would be bounced straight back to it by the route gate
  return input.needsWelcome ? SessionHandoff.RELOAD : SessionHandoff.CLIENT;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(resolveSessionHandoff, {
  name: 'Resolve Session Handoff',
  description: 'Decides how a page leaves for its destination after a write the server has already accepted.',
});
