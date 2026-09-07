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
 * ████████████████████████████████████████ #utils/default-layout/constants.ts █████████████████████████████████████████
 *
 * Routes, storage keys, and navigation links for the default application shell.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the default layout through the sibling barrel.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { INavigationLink } from '~/types/layout';

/**
 * Media query at which the mobile panel is replaced by inline navigation.
 * @internal
 * @constant
 */
export const DESKTOP_QUERY: string = '(min-width: 48rem)';

/**
 * Selector for controls reachable by keyboard inside the mobile panel.
 * @internal
 * @constant
 */
export const FOCUSABLE: string = 'a[href], button:not([disabled])';

/**
 * Marketing routes exposed by desktop and mobile navigation.
 * @internal
 * @constant
 */
export const NAV_LINKS: readonly INavigationLink[] = [
  { label: 'About', to: '/about' },
  { label: 'Features', to: '/features' },
  { label: 'FAQ', to: '/faq' },
];
