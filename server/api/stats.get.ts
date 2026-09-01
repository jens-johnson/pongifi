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
 * █████████████████████████████████████████████ #server/api/stats.get.ts ██████████████████████████████████████████████
 *
 * Public usage figures for the landing page: games recorded, minutes logged, points scored, and leagues active this
 * week.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GET /api/stats. No authentication. Cached for 60 seconds in Redis, falling through to Postgres when the cache is
 * unavailable, and returning available:false rather than an error when neither can be reached.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { and, countDistinct, eq, gte, sql } from 'drizzle-orm';

import { GameStatus } from '#shared/domain';
import { useCache } from '#utils/cache';
import { useDatabase } from '#utils/db';

import { gameParticipants, games } from '../db/schema';

/**
 * Shape returned to the landing page.
 *
 * `available` is false whenever the figures could not be read at all, which is different from every figure being zero.
 * The first means we do not know, the second means nobody has played yet, and the page treats them differently.
 */
export interface IPublicStats {
  available: boolean;
  gamesRecorded: number;
  leaguesActiveThisWeek: number;
  minutesLogged: number;
  pointsScored: number;
  updatedAt: string;
}

/** Cache key for the aggregate. */
const CACHE_KEY: string = 'stats:public:v1';

/** How long the aggregate is reused before it is recomputed. */
const CACHE_TTL_SECONDS: number = 60;

/** A league counts as active if a game finished inside this window. */
const ACTIVE_WINDOW_DAYS: number = 7;

/**
 * Reads the cached aggregate, returning null when the cache is unreachable.
 *
 * Redis is an optimisation here, not a dependency: a landing page that fell over because a cache was unavailable would
 * be worse than one that queries Postgres a little more often.
 */
const readCache = async (): Promise<IPublicStats | null> => {
  try {
    return (await useCache().get<IPublicStats>(CACHE_KEY)) ?? null;
  } catch {
    return null;
  }
};

/**
 * Writes the aggregate to the cache, ignoring failures for the same reason.
 */
const writeCache = async (stats: IPublicStats): Promise<void> => {
  try {
    await useCache().set(CACHE_KEY, stats, { ex: CACHE_TTL_SECONDS });
  } catch {
    // a cold cache costs one query, not a broken page
  }
};

/**
 * Aggregates the public figures from confirmed, completed games.
 *
 * Only COMPLETE games count. Drafts, abandoned matches and games still awaiting confirmation are deliberately excluded:
 * a number on the landing page should be one nobody would dispute.
 */
const readStats = async (): Promise<IPublicStats> => {
  const database = useDatabase();
  const since: Date = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const completed = eq(games.status, GameStatus.COMPLETE);

  const [totals] = await database
    .select({
      gamesRecorded: sql<number>`count(*)::int`,
      minutesLogged: sql<number>`(coalesce(sum(${games.durationMs}), 0) / 60000)::int`,
    })
    .from(games)
    .where(completed);

  const [points] = await database
    .select({ pointsScored: sql<number>`coalesce(sum(${gameParticipants.finalScore}), 0)::int` })
    .from(gameParticipants)
    .innerJoin(games, eq(gameParticipants.gameId, games.id))
    .where(completed);

  const [active] = await database
    .select({ leaguesActiveThisWeek: countDistinct(games.leagueId) })
    .from(games)
    .where(and(completed, gte(games.endedAt, since)));

  return {
    available: true,
    gamesRecorded: totals?.gamesRecorded ?? 0,
    leaguesActiveThisWeek: active?.leaguesActiveThisWeek ?? 0,
    minutesLogged: totals?.minutesLogged ?? 0,
    pointsScored: points?.pointsScored ?? 0,
    updatedAt: new Date().toISOString(),
  };
};

export default defineEventHandler(async (): Promise<IPublicStats> => {
  const cached: IPublicStats | null = await readCache();

  if (cached !== null) {
    return cached;
  }

  try {
    const stats: IPublicStats = await readStats();

    await writeCache(stats);

    return stats;
  } catch (error) {
    // the landing page renders without these; it must never fail because the database is unreachable
    console.error('[api/stats] unable to read public statistics', error);

    return {
      available: false,
      gamesRecorded: 0,
      leaguesActiveThisWeek: 0,
      minutesLogged: 0,
      pointsScored: 0,
      updatedAt: new Date().toISOString(),
    };
  }
});
