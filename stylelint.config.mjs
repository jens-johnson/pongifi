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
 * ███████████████████████████████████████████████ stylelint.config.mjs ████████████████████████████████████████████████
 *
 * Stylelint config: the shared @jens-johnson/style-guide base (standard + Vue + Tailwind v4 whitelist) plus Pongifi's
 * design-token relaxations.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * `pnpm lint:stylelint` to check, `pnpm fix:stylelint` to autofix.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

export default {
  extends: ['@jens-johnson/style-guide/stylelint'],

  /* pongifi relaxations on top of the shared base; each is a deliberate consequence of the design-token system */
  rules: {
    /* OKLCH is current and well-supported */
    'color-function-notation': null,

    /* Tailwind v4 uses CSS vars heavily; allow them in custom-property names */
    'custom-property-pattern': null,

    /* Tailwind utilities dominate; no need to enforce class naming */
    'selector-class-pattern': null,

    /* Empty `@layer base {}` blocks are fine as scaffolding */
    'block-no-empty': null,

    /* Font family names like Menlo, Consolas are conventionally cased */
    'value-keyword-case': [
      'lower',
      {
        ignoreProperties: ['/font/i', 'font-family'],
        camelCaseSvgKeywords: true,
      },
    ],

    /* OKLCH's third arg is hue in degrees; the spec accepts a bare number */
    'hue-degree-notation': null,

    /* Tokens are grouped by section with blank lines for readability */
    'custom-property-empty-line-before': null,

    /* Tailwind v4's documented syntax is `@import 'tailwindcss';` (no url()) */
    'import-notation': null,
  },

  overrides: [
    /* Inline `style=""` attributes in Vue templates are bare declarations by design; the position rule misreads
       them as declarations outside a rule (stylelint-config-recommended-vue >= 1.6 lints style attributes) */
    {
      files: ['**/*.vue'],
      rules: {
        'no-invalid-position-declaration': null,
      },
    },
  ],
};
