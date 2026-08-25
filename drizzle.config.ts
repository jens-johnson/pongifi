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

/**
 * The Drizzle Kit configuration: schema lives under `server/db/schema`, generated SQL migrations are checked into
 * `server/db/migrations` and applied in CI before a deploy
 * @public
 * @default
 * @constant
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema/index.ts',
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
