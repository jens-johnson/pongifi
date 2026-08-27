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
 * █████████████████████████████████████████████████████ env.d.ts ██████████████████████████████████████████████████████
 *
 * Ambient declaration of the environment variables Pongifi reads.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

declare global {
  namespace NodeJS {
    /**
     * The environment variables Pongifi reads, declared so an editor can complete them and so this file serves as the
     * single list of what the application expects. It does not reject a misspelling: `@types/node` gives `ProcessEnv`
     * an index signature, so any string key still type-checks.
     *
     * Every value stays optional. A variable is only present in the environments it was configured for, and the
     * unpooled connection in particular exists on Vercel but not necessarily on a bare machine, so code that requires
     * one still has to say so.
     * @public
     * @interface
     */
    interface ProcessEnv {
      /* Neon Postgres, pooled; what the running application uses */
      DATABASE_URL?: string;

      /* Neon Postgres, direct; what drizzle-kit uses, since PgBouncer rejects some DDL */
      DATABASE_URL_UNPOOLED?: string;

      /* Google OIDC client id, read at request time by nuxt-auth-utils */
      NUXT_OAUTH_GOOGLE_CLIENT_ID?: string;

      /* Google OIDC client secret, read at request time by nuxt-auth-utils */
      NUXT_OAUTH_GOOGLE_CLIENT_SECRET?: string;

      /* The callback URL registered with Google for this environment */
      NUXT_OAUTH_GOOGLE_REDIRECT_URL?: string;

      /* Canonical origin for this environment; exposed to the client through runtimeConfig */
      NUXT_PUBLIC_SITE_URL?: string;

      /* Secret sealing the session cookie; at least 32 characters */
      NUXT_SESSION_PASSWORD?: string;

      /* Upstash Redis REST token; named after the legacy Vercel KV variables the integration creates */
      UPSTASH_REDIS_REST_KV_REST_API_TOKEN?: string;

      /* Upstash Redis REST endpoint; named after the legacy Vercel KV variables the integration creates */
      UPSTASH_REDIS_REST_KV_REST_API_URL?: string;
    }
  }
}

export {};
