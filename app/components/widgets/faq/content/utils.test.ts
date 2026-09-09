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
 * ███████████████████████████████████ #components/widgets/faq/content/utils.test.ts ███████████████████████████████████
 *
 * Unit suite for the FAQ fragment router integration.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { Router, RouteRecordRaw, RouterHistory } from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';

import { symbolName } from '#shared/utils/symbol';

import { replaceFaqFragment } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The About route used after selecting an FAQ group.
 * @internal
 * @constant
 */
const ABOUT_ROUTE: string = '/about';

/**
 * The FAQ route under test.
 * @internal
 * @constant
 */
const FAQ_ROUTE: string = '/faq';

/**
 * The ratings group selected through the FAQ navigation.
 * @internal
 * @constant
 */
const RATINGS_GROUP_ID: string = 'ratings';

/**
 * The routes needed to exercise FAQ history navigation.
 * @internal
 * @constant
 */
const ROUTES: RouteRecordRaw[] = [
  { component: {}, path: ABOUT_ROUTE },
  { component: {}, path: FAQ_ROUTE },
];

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(replaceFaqFragment), (): void => {
    it('keeps the FAQ fragment synchronized through About, Back, and Forward navigation', async (): Promise<void> => {
      // Start on the FAQ, select the ratings group, and then leave for About
      const history: RouterHistory = createMemoryHistory();
      const router: Router = createRouter({ history, routes: ROUTES });

      await router.push(FAQ_ROUTE);
      await router.isReady();
      await replaceFaqFragment(router, RATINGS_GROUP_ID);
      expect(router.currentRoute.value.fullPath).toBe(`${FAQ_ROUTE}#${RATINGS_GROUP_ID}`);

      await router.push(ABOUT_ROUTE);
      expect(router.currentRoute.value.fullPath).toBe(ABOUT_ROUTE);

      // Back restores the router-owned FAQ entry and its selected fragment
      router.back();
      await vi.waitFor((): void => {
        expect(router.currentRoute.value.fullPath).toBe(`${FAQ_ROUTE}#${RATINGS_GROUP_ID}`);
      });

      // Forward returns to About rather than remaining on a stale FAQ route
      router.forward();
      await vi.waitFor((): void => {
        expect(router.currentRoute.value.fullPath).toBe(ABOUT_ROUTE);
      });
    });
  });
});
