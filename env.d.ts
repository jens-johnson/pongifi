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
     * Loaded by the app and shared projects, which include `../*.d.ts`, and by `tsconfig.tooling.json`, which is what
     * puts the root config files under the compiler at all. Nuxt's generated node project, which checks
     * `nuxt.config.ts`, does not include it; the index signature means the reads there compile regardless.
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

      /* The disposable fixture database the deployed-origin probe measures against, and never the environment's own.
         Absent everywhere but a deployment armed for one measurement, which is what makes that route absent too */
      SPIKE_PROBE_DATABASE_URL?: string;

      /* The league the probe's prepared fixture seats its two accounts in */
      SPIKE_PROBE_LEAGUE_ID?: string;

      /* That league's configuration revision when the fixture was prepared */
      SPIKE_PROBE_LEAGUE_REVISION?: string;

      /* The bearer token the probe requires; without it the route answers as though it does not exist */
      SPIKE_PROBE_SECRET?: string;

      /* The two seated accounts of the probe's fixture, comma separated */
      SPIKE_PROBE_SEATS?: string;

      /* Set by the platform when Vercel's system environment variables are exposed. The invite lookup limiter trusts
         the forwarded client address only when this is present, since off-platform that header is caller-controlled */
      VERCEL?: string;
    }
  }
}

export {};
