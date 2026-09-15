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
 * Vitest configuration; two projects, because a mounted component needs the Nuxt runtime and nothing else does.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * pnpm test (single run) or pnpm test:watch (watch mode).
 *
 * ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • https://vitest.dev/config/
 *   • https://nuxt.com/docs/getting-started/testing#unit-testing
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { fileURLToPath } from 'node:url';

import { defineVitestProject } from '@nuxt/test-utils/config';
import { configDefaults, defineConfig } from 'vitest/config';

/**
 * The Nuxt path aliases the pure cores import through, mapped for the project that runs without the Nuxt runtime
 * @internal
 * @constant
 */
const ALIASES: Readonly<Record<string, string>> = {
  '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
  '#utils': fileURLToPath(new URL('./server/utils', import.meta.url)),
  '~': fileURLToPath(new URL('./app', import.meta.url)),
};

/**
 * Never pick up test files inside harness git worktrees under `.claude/` (they carry no built `.nuxt` tsconfig)
 * @internal
 * @constant
 */
const EXCLUDED: readonly string[] = [...configDefaults.exclude, '**/.claude/**'];

/**
 * A mounted component's suite, named for the single-file component it exercises rather than for a module beside it.
 *
 * The naming is the whole selector: a `*.vue.test.ts` mounts real components and needs Nuxt's auto-imports, its
 * router and its app context, while every other suite is a pure core that must keep running with its own stubs
 * @internal
 * @constant
 */
const COMPONENT_TESTS: string = '**/*.vue.test.ts';

/**
 * The Vitest configuration. The default project runs the in-band unit suites standalone, with no Nuxt runtime to
 * start and no Nuxt transform rewriting the globals those suites stub for themselves; the component project runs the
 * mounted suites in Nuxt's own environment, where `$fetch`, `useRoute` and the router are the real ones
 * @public
 * @default
 * @constant
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: ALIASES },
        test: {
          exclude: [...EXCLUDED, COMPONENT_TESTS],
          name: 'unit',
        },
      },
      await defineVitestProject({
        test: {
          environment: 'nuxt',
          exclude: [...EXCLUDED],
          include: [COMPONENT_TESTS],
          name: 'components',
        },
      }),
    ],
  },
});
