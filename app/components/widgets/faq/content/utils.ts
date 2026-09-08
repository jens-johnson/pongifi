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
 * █████████████████████████████████████ #components/widgets/faq/content/utils.ts ██████████████████████████████████████
 *
 * Synchronizes FAQ fragment changes through Vue Router.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { Router } from 'vue-router';

import { defineSymbol } from '#shared/utils/symbol';

/**
 * Replaces the current FAQ fragment through Vue Router so its route and browser history stay synchronized.
 * @public
 * @function
 * @param router - The application router
 * @param groupId - Stable fragment identifier of the selected FAQ group
 */
export async function replaceFaqFragment(router: Router, groupId: string): Promise<void> {
  await router.replace({ hash: `#${groupId}` });
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(replaceFaqFragment, {
  name: 'Replace FAQ Fragment',
  description: 'Replaces an FAQ fragment through Vue Router while preserving its navigation state.',
});
