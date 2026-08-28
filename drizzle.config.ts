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
 * █████████████████████████████████████████████████ drizzle.config.ts █████████████████████████████████████████████████
 *
 * Drizzle Kit configuration; generates and applies the SQL migrations checked into server/db/migrations.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * pnpm db:generate to author a migration, pnpm db:migrate to apply one, pnpm db:studio to browse.
 *
 * ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   • https://orm.drizzle.team/docs/drizzle-config-file
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Nuxt, so it never sees the values the dev server loads. Node can read the file itself; in
// CI and on Vercel the variables are already in the environment and there is no file to find. If no local env file
// is found, the platform supplies the variables instead
try {
  process.loadEnvFile('.env');
} catch {} // eslint-disable-line no-empty

/**
 * The Drizzle Kit configuration: schema lives under `server/db/schema`, generated SQL migrations are checked into
 * `server/db/migrations` and applied in CI before a deploy
 * @public
 * @default
 * @constant
 */
export default defineConfig({
  /**
   * Database credentials for pg connection; Migrations run over the direct connection, not the pooler; PgBouncer does
   * not support every DDL statement drizzle-kit issues. Neon injects both, so prefer the unpooled URL and fall back for
   * local setups that only define the one.
   * @see {@link https://orm.drizzle.team/docs/drizzle-config-file#dbcredentials}
   */
  dbCredentials: {
    // Both variables are declared optional in env.d.ts, so the assertion states the real precondition: one of them
    // has to be set for a migration to run at all
    url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!,
  },

  /** The DB dialect to use @see {@link https://orm.drizzle.team/docs/drizzle-config-file#dialect} */
  dialect: 'postgresql',

  /** The output path for migrations @see {@link https://orm.drizzle.team/docs/drizzle-config-file#out} */
  out: './server/db/migrations',

  /** The path to the DB schema @see {@link https://orm.drizzle.team/docs/drizzle-config-file#schema} */
  schema: './server/db/schema/index.ts',

  /** Use strict mode */
  strict: true,

  /**
   * Print all SQL statements during a drizzle-kit push
   * @see {@link https://orm.drizzle.team/docs/drizzle-config-file#verbose}
   */
  verbose: true,
});
