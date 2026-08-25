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
 * █████████████████████████████████████████████████ vitest.config.ts ██████████████████████████████████████████████████
 *
 * Vitest configuration; in-band unit tests for the rules and rating engines run standalone, without the Nuxt runtime.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * pnpm test (single run) or pnpm test:watch (watch mode).
 *
 * ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • https://vitest.dev/config/
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

/**
 * The Vitest configuration: in-band unit tests run standalone (no Nuxt runtime), so the Nuxt path aliases the pure
 * cores import through are mapped here
 * @public
 * @default
 * @constant
 */
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '#utils': fileURLToPath(new URL('./server/utils', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    /* Never pick up test files inside harness git worktrees under .claude/ (they carry no built .nuxt tsconfig) */
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
