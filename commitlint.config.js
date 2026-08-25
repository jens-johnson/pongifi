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
 * ███████████████████████████████████████████████ commitlint.config.js ████████████████████████████████████████████████
 *
 * The commitlint configuration for this project: the shared @jens-johnson/style-guide factory with Pongifi's scope
 * enum. Runs as a commit-msg hook and enforces `type(scope): subject` (Conventional Commits, lowercase subjects).
 *
 * ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • https://conventionalcommits.org
 *   • https://github.com/jens-johnson/jens-johnson/blob/main/docs/style-guide/conventions/git-workflow.md
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createCommitlintConfig } from '@jens-johnson/style-guide/commitlint';

/**
 * The commitlint configuration for this project
 * @public
 * @default
 * @constant
 */
export default createCommitlintConfig({
  scopes: [
    'api',
    'app',
    'assets',
    'auth',
    'cache',
    'ci',
    'components',
    'composables',
    'config',
    'db',
    'deps',
    'design',
    'docs',
    'eslint',
    'games',
    'layouts',
    'leagues',
    'pages',
    'public',
    'ratings',
    'recording',
    'release',
    'rules',
    'server',
    'seo',
    'shared',
    'stats',
    'styles',
    'tailwind',
    'tests',
    'types',
  ],
});
