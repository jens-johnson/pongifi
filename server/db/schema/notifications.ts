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
 * ████████████████████████████████████████ #server/db/schema/notifications.ts █████████████████████████████████████████
 *
 * In-app notifications and the per-user delivery preferences that govern them.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { leagues } from './leagues';
import { users } from './users';

/**
 * An in-app notification. Phase 1 writes only the confirmation requests the recording flow depends on; the full event
 * list in IX.I follows in Phase 2, at which point email delivery joins the in-app centre
 * @public
 * @constant
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /* Null for notifications that are not scoped to one league */
    leagueId: uuid('league_id').references(() => leagues.id, { onDelete: 'cascade' }),
    /**
     * Left as free text rather than an enum: the event list in IX.I is expected to grow through Phase 2, and an
     * unrecognised type degrades to an unrendered row rather than a failed migration
     */
    type: text('type').notNull(),
    payload: jsonb('payload'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /* The notification centre reads one user's unread items newest first */
    index('notifications_user_read_idx').on(table.userId, table.readAt, table.createdAt),
  ],
);

/**
 * A user's delivery preference for one notification type. A row's absence means the default applies, so switching a
 * default does not require touching every user
 * @public
 * @constant
 */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    inApp: boolean('in_app').notNull().default(true),
    email: boolean('email').notNull().default(true),
  },
  (table) => [uniqueIndex('notification_preferences_user_type_unique').on(table.userId, table.type)],
);
