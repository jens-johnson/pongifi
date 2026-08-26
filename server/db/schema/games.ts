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
 * ████████████████████████████████████████████ #server/db/schema/games.ts █████████████████████████████████████████████
 *
 * Games, the seats in them, and the append-only event log that is the source of truth for how each one went.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import type { IMatchSettings, TMatchEvent } from '#shared/rules-engine';

import {
  confirmationStatusEnum,
  gameEventTypeEnum,
  gameStatusEnum,
  gameTypeEnum,
  participantOutcomeEnum,
  participantSideEnum,
  recordingModeEnum,
} from './enums';
import { leagues } from './leagues';
import { users } from './users';

/**
 * A single game. A best-of-N match is modelled by `matchId` and `gameNumber` rather than a parent table (X.III), so a
 * standalone game simply carries a null `matchId` and match-level aggregates are a group-by rather than a join
 * @public
 * @constant
 */
export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    /* Groups the games of one best-of-N match; null for a standalone game */
    matchId: uuid('match_id'),
    gameNumber: integer('game_number').notNull().default(1),
    type: gameTypeEnum('type').notNull(),
    status: gameStatusEnum('status').notNull().default('DRAFT'),
    /* A second axis entirely from status; together they determine what the game feeds (VIII.VII) */
    confirmationStatus: confirmationStatusEnum('confirmation_status').notNull().default('UNCONFIRMED'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    recordingMode: recordingModeEnum('recording_mode').notNull().default('LIVE'),
    /* The fully resolved settings, frozen at start so the game replays identically forever (IV.I) */
    settingsSnapshot: jsonb('settings_snapshot').$type<IMatchSettings>().notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    /* Exactly one participant holds the recorder role at a time; it may be handed over mid-game (VII.VI) */
    recorderUserId: uuid('recorder_user_id').references(() => users.id),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    /* Incremented by an amendment, which appends a revision rather than mutating the original (III.II.X.IV) */
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /* League history and the activity chart both read a league's games newest first */
    index('games_league_ended_at_idx').on(table.leagueId, table.endedAt),
    index('games_league_status_idx').on(table.leagueId, table.status),
    /* Match-level aggregates group by this */
    index('games_match_idx').on(table.matchId, table.gameNumber),
    /* The confirmation queue and the auto-confirmation sweep both read unconfirmed completions */
    index('games_confirmation_idx').on(table.confirmationStatus, table.endedAt),
    check('games_game_number_positive', sql`${table.gameNumber} >= 1`),
  ],
);

/**
 * A seat in a game. A guest is a row with a null `userId` and a `guestName` (VI.III): a per-game label rather than an
 * identity, with no shell user and no membership to clean up afterwards
 * @public
 * @constant
 */
export const gameParticipants = pgTable(
  'game_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    guestName: text('guest_name'),
    /* A or B for singles and doubles; null for cutthroat, which uses rotationPosition instead */
    side: participantSideEnum('side'),
    teamIndex: integer('team_index'),
    /* The player's place in the cutthroat rotation; null for singles and doubles */
    rotationPosition: integer('rotation_position'),
    /**
     * A denormalized cache written on completion. The score is never authoritative here: it is always reproducible by
     * replaying this game's events through the rules engine (X.II)
     */
    finalScore: integer('final_score'),
    outcome: participantOutcomeEnum('outcome'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    disputedAt: timestamp('disputed_at', { withTimezone: true }),
  },
  (table) => [
    index('game_participants_game_idx').on(table.gameId),
    /* The player page and every head-to-head query read a user's participations */
    index('game_participants_user_idx').on(table.userId),
    check('game_participants_identity', sql`(${table.userId} IS NULL) <> (${table.guestName} IS NULL)`),
  ],
);

/**
 * The append-only event log; the source of truth for everything about how a game went. A game's score is never stored
 * as a mutable counter, which is what makes undo, amendment, and stat backfill cheap rather than painful (VII.III)
 * @public
 * @constant
 */
export const gameEvents = pgTable(
  'game_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    type: gameEventTypeEnum('type').notNull(),
    /**
     * Derived caches, written alongside the event so point-level statistics do not need a replay to attribute a rally.
     * The rules engine remains the authority on who was serving
     */
    servingUserId: uuid('serving_user_id').references(() => users.id),
    scoringUserId: uuid('scoring_user_id').references(() => users.id),
    /**
     * The event's payload, typed in application code as a discriminated union keyed on `type` and validated at the API
     * boundary before anything is written, so the looseness of the column never reaches the domain logic (X.III)
     */
    detail: jsonb('detail').$type<TMatchEvent>(),
    /* Which revision of the event taxonomy this row was written under, so changing the enums needs no backfill */
    detailVersion: integer('detail_version').notNull().default(1),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /* A replay reads a game's events in order, and this is what stops two appends interleaving */
    uniqueIndex('game_events_game_sequence_unique').on(table.gameId, table.sequence),
    check('game_events_sequence_non_negative', sql`${table.sequence} >= 0`),
  ],
);
