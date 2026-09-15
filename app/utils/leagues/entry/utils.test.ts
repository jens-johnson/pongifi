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
 * ████████████████████████████████████████ #utils/leagues/entry/utils.test.ts █████████████████████████████████████████
 *
 * Unit tests for invite parsing, invite links and short mark prefill.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import { buildInviteUrl, deriveAbbreviation, parseInviteInput } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The deployment every pasted link is checked against
 * @internal
 * @constant
 */
const ORIGIN: string = 'https://pongifi.com';

/**
 * A well-formed token, mixed case, carrying both base64url punctuation characters
 * @internal
 * @constant
 */
const TOKEN: string = 'aB3-_'.padEnd(43, 'Q');

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(deriveAbbreviation), (): void => {
    it('takes the first letter or digit of each word, uppercased', (): void => {
      expect(deriveAbbreviation('Friday Ladder')).toBe('FL');
      expect(deriveAbbreviation('  3rd floor  (east) league ')).toBe('3FEL');
    });

    it('stops at eight characters, counted after uppercasing', (): void => {
      expect(deriveAbbreviation('a b c d e f g h i j')).toBe('ABCDEFGH');
      expect(deriveAbbreviation('ß ß ß ß ß')).toBe('SSSSSSSS');
    });

    it('returns nothing for a name with no letters or digits', (): void => {
      expect(deriveAbbreviation('  -- !! ')).toBe('');
    });
  });

  describe(symbolName(parseInviteInput), (): void => {
    it('accepts the bare token and the full same-origin link, preserving case', (): void => {
      expect(parseInviteInput(` ${TOKEN} `, ORIGIN)).toBe(TOKEN);
      expect(parseInviteInput(`${ORIGIN}/invite/${TOKEN}`, ORIGIN)).toBe(TOKEN);
    });

    it('refuses another host, credentials, a query, a fragment and an unexpected path', (): void => {
      expect(parseInviteInput(`https://evil.example/invite/${TOKEN}`, ORIGIN)).toBeNull();
      expect(parseInviteInput(`https://user:pass@pongifi.com/invite/${TOKEN}`, ORIGIN)).toBeNull();
      expect(parseInviteInput(`${ORIGIN}/invite/${TOKEN}?x=1`, ORIGIN)).toBeNull();
      expect(parseInviteInput(`${ORIGIN}/invite/${TOKEN}?`, ORIGIN)).toBeNull();
      expect(parseInviteInput(`${ORIGIN}/invite/${TOKEN}#top`, ORIGIN)).toBeNull();
      expect(parseInviteInput(`${ORIGIN}/join/${TOKEN}`, ORIGIN)).toBeNull();
      expect(parseInviteInput(`${ORIGIN}/invite/${TOKEN}/extra`, ORIGIN)).toBeNull();
      expect(parseInviteInput(`http://pongifi.com/invite/${TOKEN}`, ORIGIN)).toBeNull();
    });

    it('refuses whitespace inside, an empty field, a malformed token and an over-long value', (): void => {
      expect(parseInviteInput(`${TOKEN.slice(0, 20)} ${TOKEN.slice(20)}`, ORIGIN)).toBeNull();
      expect(parseInviteInput('   ', ORIGIN)).toBeNull();
      expect(parseInviteInput(TOKEN.slice(1), ORIGIN)).toBeNull();
      expect(parseInviteInput(`${ORIGIN}/invite/${'x'.repeat(600)}`, ORIGIN)).toBeNull();
    });
  });

  describe(symbolName(buildInviteUrl), (): void => {
    it('joins the origin, the invite path and the token', (): void => {
      expect(buildInviteUrl(ORIGIN, TOKEN)).toBe(`${ORIGIN}/invite/${TOKEN}`);
    });
  });
});
