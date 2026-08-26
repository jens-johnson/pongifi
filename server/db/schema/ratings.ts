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

import { boolean, doublePrecision, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { ratingScopeEnum } from './enums';
import { games } from './games';
import { leagues } from './leagues';
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
    /* Rated games completed in this scope; a guest game raises games played but writes no snapshot */
    gamesPlayed: integer('games_played').notNull(),
    isProvisional: boolean('is_provisional').notNull(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /* Reading a current rating, and reading a rating history, are the same index walked in opposite directions */
    index('rating_snapshots_current_idx').on(table.leagueId, table.userId, table.scope, table.createdAt),
    /* The leaderboard reads every member's latest snapshot for one scope in one league */
    index('rating_snapshots_leaderboard_idx').on(table.leagueId, table.scope, table.createdAt),
    /* Invalidation walks forward from the amended game */
    index('rating_snapshots_game_idx').on(table.gameId),
  ],
);
