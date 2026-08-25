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
 * ███████████████████████████████████████████ #server/utils/cache/client.ts ███████████████████████████████████████████
 *
 * The Upstash Redis client: a lazily built, per-instance handle for live game state, fan-out, caches, and rate
 * limiting.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { Redis } from '@upstash/redis';

import type { TCache } from './types';

/**
 * The memoized cache client; built once per function instance rather than once per request
 * @internal
 * @constant
 */
let cache: TCache | undefined;

/**
 * Returns the Upstash Redis client, building it on first use. Credentials are read through Nuxt's runtime config
 * (server-only) rather than `process.env`, so they never reach the client bundle
 * @public
 * @function
 * @throws Error when the Upstash REST credentials are absent from the environment
 * @returns The Upstash Redis client
 */
export function useCache(): TCache {
  if (cache) {
    return cache;
  }

  const { upstashRedisRestUrl, upstashRedisRestToken } = useRuntimeConfig();

  if (!upstashRedisRestUrl || !upstashRedisRestToken) {
    throw new Error('Upstash Redis credentials are not configured; run `vercel env pull .env.local`.');
  }

  cache = new Redis({ url: upstashRedisRestUrl, token: upstashRedisRestToken });

  return cache;
}
