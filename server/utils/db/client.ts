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
 * ████████████████████████████████████████████ #server/utils/db/client.ts █████████████████████████████████████████████
 *
 * The Neon Postgres client: a lazily built, per-instance Drizzle handle over Neon's HTTP driver.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import type { TDatabase } from './types';

/**
 * The memoized database handle; Fluid Compute reuses function instances, so the client is built once per instance
 * rather than once per request
 * @internal
 * @constant
 */
let database: TDatabase | undefined;

/**
 * Returns the Drizzle handle for this league's Neon database, building it on first use. The connection string is read
 * through Nuxt's runtime config (server-only) rather than `process.env`, and must be the pooled Neon URL: Vercel
 * functions are short-lived, so a long-lived pool would strand connections
 * @public
 * @function
 * @throws Error when DATABASE_URL is absent from the environment
 * @returns The Drizzle database handle
 */
export function useDatabase(): TDatabase {
  if (database) {
    return database;
  }

  const { databaseUrl } = useRuntimeConfig();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured; run `vercel env pull .env.local` or set it locally.');
  }

  database = drizzle(neon(databaseUrl));

  return database;
}
