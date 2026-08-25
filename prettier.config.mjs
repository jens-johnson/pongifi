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
 * ████████████████████████████████████████████████ prettier.config.mjs ████████████████████████████████████████████████
 *
 * Prettier config: the shared @jens-johnson/style-guide baseline plus the Tailwind class-sorting plugin (a Nuxt +
 * Tailwind repo needs the plugin locally, so the shared JSON is spread rather than referenced).
 *
 * ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • https://github.com/jens-johnson/jens-johnson/blob/main/docs/style-guide/conventions/formatting.md
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import styleGuidePrettierConfig from '@jens-johnson/style-guide/prettier' with { type: 'json' };

/**
 * This project's Prettier config: the shared baseline with Tailwind class sorting layered on
 * @public
 * @default
 * @constant
 */
export default {
  ...styleGuidePrettierConfig,
  plugins: ['prettier-plugin-tailwindcss'],
};
