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
 * █████████████████████████████████████████████████ eslint.config.js ██████████████████████████████████████████████████
 *
 * ESLint flat config for Pongifi: the shared @jens-johnson/style-guide baseline composed under @nuxt/eslint, plus the
 * Nuxt-specific blocks (browser globals, root-file parsing) that only make sense in this repo.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * `pnpm lint:eslint` to check, `pnpm fix:eslint` to auto-fix.
 *
 * ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • https://eslint.nuxt.com/
 *   • https://github.com/jens-johnson/jens-johnson/blob/main/docs/style-guide/conventions/tooling.md
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

// @ts-check

import { createFrameworkEslintConfig } from '@jens-johnson/style-guide/eslint';
import globals from 'globals';

import withNuxt from './.nuxt/eslint.config.mjs';

/**
 * This project's ESLint config: the Nuxt base, then the shared style-guide blocks, then Pongifi overrides
 * @public
 * @default
 * @constant
 */
export default withNuxt(
  ...createFrameworkEslintConfig(
    /**
     * ═══ Ignores (pongifi) ═══════════════════════════════════════════════════════════════════════════════════════════
     *
     * Repo-specific additions to the shared ignore set (the shared config already covers .nuxt/.output/dist/coverage)
     */
    {
      name: 'pongifi/ignores',
      ignores: ['public/**', '.claude/**', 'server/db/migrations/**'],
    },

    /**
     * ═══ Root Config Files ═══════════════════════════════════════════════════════════════════════════════════════════
     *
     * `withNuxt()` scopes the TypeScript parser to `app/**`. Root `.ts/.js` files (`nuxt.config.ts`,
     * `eslint.config.js`, `commitlint.config.js`, etc.) are outside that tsconfig project reference and are silently
     * skipped. Setting `project: false` lets the parser handle them without type-checking, enabling syntax and
     * stylistic rules in the IDE for those files.
     */
    {
      name: 'pongifi/root-files',
      files: ['*.ts', '*.js', '*.mjs', '*.cjs', '*.cts', '*.mts'],
      languageOptions: {
        parserOptions: {
          project: false,
        },
      },
    },

    /**
     * ═══ Browser Globals ═════════════════════════════════════════════════════════════════════════════════════════════
     *
     * The shared config bundles Node + ES2022 globals; a Nuxt app additionally runs in the browser
     */
    {
      name: 'pongifi/globals',
      languageOptions: {
        globals: {
          ...globals.browser,
        },
      },
    },
  ),
);
