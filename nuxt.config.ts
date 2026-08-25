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
 * ██████████████████████████████████████████████████ nuxt.config.ts ███████████████████████████████████████████████████
 *
 * Main Nuxt configuration for Pongifi (pongifi.com).
 *
 * ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • https://nuxt.com/docs/api/configuration/nuxt-config
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';

/**
 * This project's Nuxt configuration
 * @public
 * @default
 */
export default defineNuxtConfig({
  /**
   * The compatibility date for this version of Nuxt
   * @see https://nuxt.com/docs/4.x/api/nuxt-config#compatibilitydate
   */
  compatibilityDate: '2026-08-25',

  /**
   * Runtime config; public values are exposed to the client, private values are server-only. Every secret is read
   * through this object rather than `process.env` scattered through the codebase.
   * @see https://nuxt.com/docs/guide/going-further/runtime-config
   */
  runtimeConfig: {
    /* Neon Postgres pooled connection string; server-only */
    databaseUrl: process.env.DATABASE_URL,

    /* Upstash Redis REST credentials; server-only */
    upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN,

    /**
     * Google OAuth credentials are intentionally NOT mapped here. Mapping them into runtimeConfig bakes the secret
     * values into the build output and only works when the env var is present in the building environment's scope.
     * `nuxt-auth-utils` reads `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` at request time
     * instead, which resolves correctly in every Vercel environment.
     * @see https://github.com/atinux/nuxt-auth-utils#google
     */

    public: {
      /* Canonical site origin per environment; used for OAuth redirects and absolute links */
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },

  /**
   * Auto-import scan directories. Composables and utils follow the barrel-directory convention
   * (`use-x/{index,composable,types}.ts`, `utils/<group>/<name>/{index,...}.ts`), so the default top-level-only
   * scan misses them. The recursive globs register every nested implementation file; barrel `index.ts` files use
   * `export *`, which unimport ignores, so symbols are registered exactly once (from their defining module).
   * @see https://nuxt.com/docs/api/nuxt-config#imports
   */
  imports: {
    dirs: ['composables/**', 'utils/**'],
  },

  /**
   * Nuxt modules. Deliberately no component library: the live recording table view (spec VII.III) is a custom
   * graphic that a component kit would only constrain.
   * @see https://nuxt.com/docs/4.x/api/nuxt-config#modules
   */
  modules: [
    /**
     * The Nuxt ESLint module for linting
     * @see https://eslint.nuxt.com/
     */
    '@nuxt/eslint',

    /**
     * The Nuxt fonts module for vendor font integration
     * @see https://fonts.nuxt.com/
     */
    '@nuxt/fonts',

    /**
     * The Nuxt icon module for iconography
     * @see https://nuxt.com/modules/icon
     */
    '@nuxt/icon',

    /**
     * The Nuxt image module for optimized images
     * @see https://image.nuxt.com/
     */
    '@nuxt/image',

    /**
     * Session + OAuth helpers (Google OIDC login). Provides `useUserSession()` on the client and `setUserSession` /
     * `requireUserSession` + `defineOAuthGoogleEventHandler` on the server.
     * @see https://github.com/atinux/nuxt-auth-utils
     */
    'nuxt-auth-utils',
  ],

  /**
   * Nuxt devtools; browser panel for inspecting components, routes, and modules
   * @see https://devtools.nuxt.com/
   */
  devtools: {
    /* Enable dev tools */
    enabled: true,
  },

  /**
   * TypeScript configuration
   * @see https://nuxt.com/docs/4.x/api/nuxt-config#typescript
   */
  typescript: {
    /* Enable all strict type-checking options */
    strict: true,

    /* Run separately via `pnpm typecheck` to avoid slowing HMR */
    typeCheck: false,

    /* The app project also compiles server handlers (the typed $fetch route map imports them), so the server-side
       #utils alias must resolve here too */
    tsConfig: {
      compilerOptions: {
        paths: {
          '#utils/*': ['../server/utils/*'],
        },
      },
    },
  },

  /**
   * Global CSS entry points; Tailwind v4 CSS-first config lives in main.css
   * @see https://nuxt.com/docs/4.x/api/nuxt-config#css
   */
  css: ['~/assets/css/main.css'],

  /**
   * Vite configuration; Tailwind v4 is a first-class Vite plugin rather than a PostCSS step
   * @see https://tailwindcss.com/docs/installation/using-vite
   */
  vite: {
    plugins: [tailwindcss()],
  },

  /**
   * Nitro server config
   * @see https://nitro.build/config
   */
  nitro: {
    /**
     * The `#utils` alias points at server/utils so server code (and its type imports) can reach util modules without
     * relative-path ladders; values are auto-imported by Nitro, so the alias mostly serves `import type` statements
     */
    alias: {
      '#utils': fileURLToPath(new URL('./server/utils', import.meta.url)),
    },
    typescript: {
      tsConfig: {
        compilerOptions: {
          paths: {
            '#utils/*': ['../server/utils/*'],
          },
        },
      },
    },
  },
});
