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
 * ███████████████████████████████████████ #utils/sign-in/redirect/utils.test.ts ███████████████████████████████████████
 *
 * Unit suite for the sign-in return-path resolver.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { LEAGUES_ROUTE } from '../../marketing/routes';
import { SIGN_IN_GOOGLE_COMMAND } from './constants';
import { buildGoogleSignInCommand, resolveSignInRedirect } from './utils';

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(buildGoogleSignInCommand), (): void => {
    it('uses the bare Google handler for the default destination', (): void => {
      expect(buildGoogleSignInCommand(undefined)).toBe(SIGN_IN_GOOGLE_COMMAND);
      expect(buildGoogleSignInCommand(LEAGUES_ROUTE)).toBe(SIGN_IN_GOOGLE_COMMAND);
    });

    it('carries an encoded same-origin return path to the Google handler', (): void => {
      expect(buildGoogleSignInCommand('/leagues/ashfield?tab=standings')).toBe(
        '/auth/google?redirect=%2Fleagues%2Fashfield%3Ftab%3Dstandings',
      );
    });

    it('drops an unsafe return path instead of carrying an open redirect', (): void => {
      expect(buildGoogleSignInCommand('https://evil.test')).toBe(SIGN_IN_GOOGLE_COMMAND);
    });
  });

  describe(symbolName(resolveSignInRedirect), (): void => {
    it('keeps a same-origin path, which is the whole point of carrying one', (): void => {
      expect(resolveSignInRedirect('/leagues/ashfield')).toBe('/leagues/ashfield');
    });

    it('keeps the query and fragment on a path it accepts', (): void => {
      expect(resolveSignInRedirect('/leagues?season=autumn#standings')).toBe('/leagues?season=autumn#standings');
    });

    it('falls back when there is no value to resolve', (): void => {
      expect(resolveSignInRedirect(undefined)).toBe(LEAGUES_ROUTE);
      expect(resolveSignInRedirect(null)).toBe(LEAGUES_ROUTE);
      expect(resolveSignInRedirect('')).toBe(LEAGUES_ROUTE);
    });

    /**
     * Vue Router hands back an array when a key is repeated, and a check written for strings quietly does the wrong
     * thing with one
     */
    it('falls back on a repeated query key, which arrives as an array', (): void => {
      expect(resolveSignInRedirect(['/leagues', 'https://evil.test'])).toBe(LEAGUES_ROUTE);
    });

    it('rejects an absolute URL, which would leave the site entirely', (): void => {
      expect(resolveSignInRedirect('https://evil.test/leagues')).toBe(LEAGUES_ROUTE);
      expect(resolveSignInRedirect('javascript:alert(1)')).toBe(LEAGUES_ROUTE);
    });

    /**
     * The one that a naive `startsWith('/')` check lets through: the browser reads `//evil.test` as a
     * protocol-relative URL and leaves the origin, so the prefix test passes while the visitor still ends up
     * somewhere else
     */
    it('rejects a protocol-relative URL despite its leading slash', (): void => {
      expect(resolveSignInRedirect('//evil.test/leagues')).toBe(LEAGUES_ROUTE);
    });

    it('rejects the backslash spelling of the same trick', (): void => {
      expect(resolveSignInRedirect('/\\evil.test/leagues')).toBe(LEAGUES_ROUTE);
    });

    it('rejects a relative path, which would resolve against wherever it is used', (): void => {
      expect(resolveSignInRedirect('leagues')).toBe(LEAGUES_ROUTE);
    });

    it('rejects control characters, which can hide a second target from a line-oriented check', (): void => {
      expect(resolveSignInRedirect('/leagues\nLocation: https://evil.test')).toBe(LEAGUES_ROUTE);
      expect(resolveSignInRedirect(`/leagues${String.fromCharCode(0)}`)).toBe(LEAGUES_ROUTE);
    });
  });
});
