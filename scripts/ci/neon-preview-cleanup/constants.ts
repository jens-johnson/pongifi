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
 * ███████████████████████████████████ scripts/ci/neon-preview-cleanup/constants.ts ████████████████████████████████████
 *
 * Safety constants for Neon preview database cleanup.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The Neon management API root.
 * @internal
 * @constant
 */
export const NEON_API_ROOT: string = 'https://console.neon.tech/api/v2';

/**
 * Provider branch identifiers accepted for deletion.
 * @internal
 * @constant
 */
export const NEON_BRANCH_ID_PATTERN: RegExp = /^br-[a-z0-9-]{1,57}$/u;

/**
 * Git branches whose database lifecycle outlives a pull request.
 * @internal
 * @constant
 */
export const PROTECTED_GIT_BRANCHES: ReadonlySet<string> = new Set([
  'dev',
  'development',
  'local',
  'local-development',
  'main',
  'preview',
  'staging',
  'vercel-dev',
]);

/**
 * Git branch prefixes reserved for long-lived or automated branches.
 * @internal
 * @constant
 */
export const PROTECTED_GIT_BRANCH_PREFIXES: readonly string[] = [
  'dev/',
  'development/',
  'local/',
  'local-development/',
  'release-please--branches--',
];
