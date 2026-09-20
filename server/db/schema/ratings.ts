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
 * ███████████████████████████████████████████ #server/db/schema/ratings.ts ████████████████████████████████████████████
 *
 * Append-only rating snapshots; a current rating is the latest snapshot for a league, user, and scope.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { boolean, doublePrecision, index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { ratingScopeEnum } from './enums';
import { games } from './games';
import { leagues } from './leagues';
import { ratingGenerations } from './results';
import { users } from './users';

/**
 * An append-only rating record, keyed to the game that caused it. A current rating is the latest snapshot for a given
 * league, user, and scope; there is no mutable rating column anywhere. Amending or voiding a game invalidates every
 * snapshot from that game forward for the affected players, and Pongifi rebuilds them by replaying in chronological
 * order, which is only sound because both engines are pure functions over the event log (VIII.VIII)
 * @public
 * @constant
 */
export const ratingSnapshots = pgTable(
  'rating_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: ratingScopeEnum('scope').notNull(),
    /* Elo deltas are fractional, so the rating is stored at full precision rather than rounded for display */
    rating: doublePrecision('rating').notNull(),
    /**
     * The rating this game moved from, and by how much, both as the engine computed them. Kept rather than derived,
     * because the game page states a change (1200 → 1216 (+16)) and subtracting one snapshot from the one before it
     * would be reading a different generation's arithmetic. Null only on the rows this column was added behind: a
     * snapshot written before generations existed has no recorded before-value to recover
     */
    ratingBefore: doublePrecision('rating_before'),
    delta: doublePrecision('delta'),
    /* Rated games completed in this scope; a guest game raises games played but writes no snapshot */
    gamesPlayed: integer('games_played').notNull(),
    isProvisional: boolean('is_provisional').notNull(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    /**
     * The complete computation this snapshot belongs to. A rating read follows the league's active generation and the
     * replay's own order; it never takes the newest row by insertion time, which is what a half-published rebuild
     * would look like
     */
    ratingGenerationId: uuid('rating_generation_id')
      .notNull()
      .references(() => ratingGenerations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /* One snapshot per player per game per scope within a generation; a retried publication cannot double-write */
    uniqueIndex('rating_snapshots_generation_unique').on(
      table.ratingGenerationId,
      table.gameId,
      table.userId,
      table.scope,
    ),
    /* The leaderboard reads one generation's rows for one scope */
    index('rating_snapshots_generation_idx').on(table.ratingGenerationId, table.scope),
    /* Reading a current rating, and reading a rating history, are the same index walked in opposite directions */
    index('rating_snapshots_current_idx').on(table.leagueId, table.userId, table.scope, table.createdAt),
    /* The leaderboard reads every member's latest snapshot for one scope in one league */
    index('rating_snapshots_leaderboard_idx').on(table.leagueId, table.scope, table.createdAt),
    /* Invalidation walks forward from the amended game */
    index('rating_snapshots_game_idx').on(table.gameId),
  ],
);
