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

/**
 * Destinations exposed by the signed-in desktop bar.
 *
 * About and Features leave it and stay reachable at their URLs and in the mobile panel: a signed-in player does not
 * need to be sold the product. No sidebar in this release either, since only two of the mock's seven destinations
 * exist
 * @internal
 * @constant
 */
export const SIGNED_IN_NAV_LINKS: readonly INavigationLink[] = [
  { label: 'Home', to: '/' },
  { label: 'Leagues', to: '/leagues' },
  { label: 'FAQ', to: '/faq' },
];

/**
 * The full set the mobile panel shows a signed-in player, which keeps the marketing pages reachable.
 * @internal
 * @constant
 */
export const SIGNED_IN_PANEL_LINKS: readonly INavigationLink[] = [...SIGNED_IN_NAV_LINKS, ...NAV_LINKS.slice(0, 2)];
