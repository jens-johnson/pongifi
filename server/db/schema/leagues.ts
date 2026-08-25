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
 * ███████████████████████████████████████████ #server/db/schema/leagues.ts ████████████████████████████████████████████
 *
 * Leagues, the memberships within them, and the invitations into them.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import type { TLeagueSettings } from '#shared/league-settings';

import { invitationStatusEnum, leagueRoleEnum, leagueVisibilityEnum, membershipStatusEnum } from './enums';
import { users } from './users';

/**
 * A group of players who compete against one another
 * @public
 * @constant
 */
export const leagues = pgTable('leagues', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  abbreviation: varchar('abbreviation', { length: 8 }).notNull(),
  description: text('description'),
  heroUrl: text('hero_url'),
  /* A column rather than a settings field, because discovery queries filter on it */
  visibility: leagueVisibilityEnum('visibility').notNull().default('PRIVATE'),
  /* The league-level values from IV.II and IV.III; a game freezes its resolved form at start */
  settings: jsonb('settings').$type<TLeagueSettings>().notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A user's presence in a league. A membership is never deleted when someone leaves; its status changes, so historical
 * results and the ratings they produced stay intact (VI.IV)
 * @public
 * @constant
 */
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: leagueRoleEnum('role').notNull().default('PLAYER'),
    status: membershipStatusEnum('status').notNull().default('ACTIVE'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('memberships_league_user_unique').on(table.leagueId, table.userId),
    /* The leaderboard reads active members of one league; the player's league list reads the other way */
    index('memberships_league_status_idx').on(table.leagueId, table.status),
    index('memberships_user_idx').on(table.userId),
  ],
);

/**
 * An invitation into a league. One table serves all three routes in VI.I: an email invitation carries an address, a
 * shareable link does not, and a join request is an invitation the prospective member creates
 * @public
 * @constant
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    /* Null for a shareable link, which is not addressed to anyone */
    email: text('email'),
    token: text('token').notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /* Null for an unlimited link */
    maxUses: integer('max_uses'),
    useCount: integer('use_count').notNull().default(0),
    status: invitationStatusEnum('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invitations_token_unique').on(table.token),
    index('invitations_league_status_idx').on(table.leagueId, table.status),
  ],
);
