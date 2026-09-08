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
 * █████████████████████████████████████████ #utils/session/gate/utils.test.ts █████████████████████████████████████████
 *
 * Unit tests for the route gating and return-path rules.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import type { ISessionGateInput } from './types';
import { resolveSessionGate } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A signed-out visitor at the landing page, narrowed per case by the helper below
 * @internal
 * @constant
 */
const BASE: ISessionGateInput = {
  fullPath: '/',
  loggedIn: false,
  needsWelcome: false,
  path: '/',
  redirect: undefined,
};

/**
 * Builds a gate input from the base visitor, defaulting fullPath to the path when only a path is given.
 * @internal
 * @function
 * @param overrides - The fields this case cares about
 * @returns A complete gate input
 */
function visitor(overrides: Partial<ISessionGateInput>): ISessionGateInput {
  return {
    ...BASE,
    fullPath: overrides.path ?? BASE.path,
    ...overrides,
  };
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(resolveSessionGate), (): void => {
    it('leaves the public informational pages alone in every session state', (): void => {
      for (const path of ['/about', '/features', '/faq', '/sign-in']) {
        expect(resolveSessionGate(visitor({ path }))).toBeNull();
        expect(
          resolveSessionGate(
            visitor({
              loggedIn: true,
              needsWelcome: true,
              path,
            }),
          ),
        ).toBeNull();
      }
    });

    it('leaves an unknown path alone, so a typo is a 404 rather than a sign-in prompt', (): void => {
      expect(resolveSessionGate(visitor({ path: '/nope' }))).toBeNull();
    });

    it('lets a signed-out visitor see the landing page', (): void => {
      expect(resolveSessionGate(visitor({ path: '/' }))).toBeNull();
    });

    it('sends a signed-out visitor from a private page to sign-in, carrying the path back', (): void => {
      expect(resolveSessionGate(visitor({ path: '/profile' }))).toBe('/sign-in?redirect=%2Fprofile');
    });

    it('carries the query string too, which is what keeps an invite alive through sign-in', (): void => {
      expect(resolveSessionGate(visitor({ fullPath: '/welcome?redirect=/invite/abc', path: '/welcome' }))).toBe(
        '/sign-in?redirect=%2Fwelcome%3Fredirect%3D%2Finvite%2Fabc',
      );
    });

    it('sends an incomplete player from the signed-in home to welcome, carrying the path back', (): void => {
      expect(
        resolveSessionGate(
          visitor({
            loggedIn: true,
            needsWelcome: true,
            path: '/',
          }),
        ),
      ).toBe('/welcome?redirect=%2F');
    });

    it('sends an incomplete player from any other private page to welcome', (): void => {
      expect(
        resolveSessionGate(
          visitor({
            loggedIn: true,
            needsWelcome: true,
            path: '/leagues',
          }),
        ),
      ).toBe('/welcome?redirect=%2Fleagues');
    });

    it('lets an incomplete player stay on the welcome page', (): void => {
      expect(
        resolveSessionGate(
          visitor({
            loggedIn: true,
            needsWelcome: true,
            path: '/welcome',
          }),
        ),
      ).toBeNull();
    });

    it('lets a completed player through to the pages they asked for', (): void => {
      expect(resolveSessionGate(visitor({ loggedIn: true, path: '/' }))).toBeNull();
      expect(resolveSessionGate(visitor({ loggedIn: true, path: '/profile' }))).toBeNull();
      expect(resolveSessionGate(visitor({ loggedIn: true, path: '/leagues' }))).toBeNull();
    });

    it('sends a completed player away from the welcome page rather than showing it twice', (): void => {
      expect(
        resolveSessionGate(
          visitor({
            loggedIn: true,
            path: '/welcome',
            redirect: '/profile',
          }),
        ),
      ).toBe('/profile');
    });

    it('sends a completed player home when the welcome page points back at itself', (): void => {
      expect(
        resolveSessionGate(
          visitor({
            loggedIn: true,
            path: '/welcome',
            redirect: '/welcome',
          }),
        ),
      ).toBe('/');
      expect(resolveSessionGate(visitor({ loggedIn: true, path: '/welcome' }))).toBe('/');
    });

    it('refuses a crafted destination on the way out of the welcome page', (): void => {
      expect(
        resolveSessionGate(
          visitor({
            loggedIn: true,
            path: '/welcome',
            redirect: '//evil.test',
          }),
        ),
      ).toBe('/');
    });
  });
});
