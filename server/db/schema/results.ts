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
 * ███████████████████████████████████████████ #server/db/schema/results.ts ████████████████████████████████████████████
 *
 * The result-revision journal, its actions and receipts, and generation-addressed ratings.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { IReconstruction, IResultPolicySnapshot, IResultSubmission } from '#shared/results';
import type { IMatchSettings } from '#shared/rules-engine';

import {
  gameTypeEnum,
  leagueRoleEnum,
  participantSideEnum,
  resultActionEnum,
  resultOperationEnum,
  resultSettleReasonEnum,
  resultStateEnum,
  sideSatisfactionEnum,
} from './enums';
import { games } from './games';
import { leagues } from './leagues';
import { users } from './users';

/**
 * An immutable revision of one recorded result.
 *
 * The journal, not the game rows, is the audit source: a correction appends a revision and leaves every earlier one
 * readable, replayable and addressable, which is what makes a 2-into-3-into-2 game-count change safe. Exactly one
 * revision of a match is current at a time, and the games a revision includes are named explicitly rather than
 * inferred, so a superseded child game can never be mistaken for a live one (contract §3)
 * @public
 * @constant
 */
export const resultRevisions = pgTable(
  'result_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /* The first game of revision 1; the match's stable identity and its canonical route */
    canonicalMatchId: uuid('canonical_match_id').notNull(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    /* True on exactly one revision per match, and null on every other; a partial unique index enforces it */
    isCurrent: boolean('is_current'),
    state: resultStateEnum('state').notNull(),
    /* Frozen at creation and carried unchanged through every amendment, so a correction cannot land on new rules */
    gameType: gameTypeEnum('game_type').notNull(),
    settingsSnapshot: jsonb('settings_snapshot').$type<IMatchSettings>().notNull(),
    policySnapshot: jsonb('policy_snapshot').$type<IResultPolicySnapshot>().notNull(),
    /* The league configuration the snapshots were resolved from, checked in the committing transaction */
    leagueConfigurationRevision: integer('league_configuration_revision').notNull(),
    /* The confirmation protocol this revision was born under; an older revision keeps the rule it was created with */
    confirmationRuleVersion: integer('confirmation_rule_version').notNull().default(1),
    submission: jsonb('submission').$type<IResultSubmission>().notNull(),
    reconstruction: jsonb('reconstruction').$type<IReconstruction>().notNull(),
    reconstructionVersion: integer('reconstruction_version').notNull(),
    /* The digest of the normalized submission; an operation replayed with a different body conflicts on this */
    submissionDigest: text('submission_digest').notNull(),
    playedAt: timestamp('played_at', { withTimezone: true }).notNull(),
    /* Revision 1's play time, which bounds amendment forever; an edited time cannot revive the window */
    originalPlayedAt: timestamp('original_played_at', { withTimezone: true }).notNull(),
    /* Database time at the commit that created this revision, never client time and never the play time */
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
    confirmationDeadline: timestamp('confirmation_deadline', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    settledReason: resultSettleReasonEnum('settled_reason'),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.id),
    /* Who committed this revision when it is an amendment; null on revision 1 */
    editedBy: uuid('edited_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('result_revisions_match_revision_unique').on(table.canonicalMatchId, table.revision),
    /* One current revision per match: the projection every read and count is taken from */
    uniqueIndex('result_revisions_current_unique')
      .on(table.canonicalMatchId)
      .where(sql`${table.isCurrent}`),
    /* The sweep and the on-read settlement both look for due, still-pending revisions in one league */
    index('result_revisions_due_idx').on(table.leagueId, table.state, table.confirmationDeadline),
    check('result_revisions_revision_positive', sql`${table.revision} >= 1`),
    /* A settled revision says why; an unsettled one never claims a reason */
    check('result_revisions_settled_pair', sql`(${table.settledAt} IS NULL) = (${table.settledReason} IS NULL)`),
  ],
);

/**
 * Which game rows belong to a revision.
 *
 * The relation is explicit because a correction can change how many games a match has: the row count of this table is
 * what a revision means by "its games", and a game row belonging to a superseded revision keeps existing without ever
 * being counted again
 * @public
 * @constant
 */
export const resultRevisionGames = pgTable(
  'result_revision_games',
  {
    resultRevisionId: uuid('result_revision_id')
      .notNull()
      .references(() => resultRevisions.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    gameNumber: integer('game_number').notNull(),
  },
  (table) => [
    uniqueIndex('result_revision_games_pk').on(table.resultRevisionId, table.gameId),
    uniqueIndex('result_revision_games_number_unique').on(table.resultRevisionId, table.gameNumber),
    index('result_revision_games_game_idx').on(table.gameId),
    check('result_revision_games_number_positive', sql`${table.gameNumber} >= 1`),
  ],
);

/**
 * The registered participants whose confirmation a revision is waiting on, frozen at submission.
 *
 * Frozen rather than derived, so losing a membership afterwards neither removes an outstanding vote nor early-confirms
 * the result, and so a later amendment's answerer set is its own rather than the first revision's (contract §4)
 * @public
 * @constant
 */
export const resultRequiredAnswerers = pgTable(
  'result_required_answerers',
  {
    resultRevisionId: uuid('result_revision_id')
      .notNull()
      .references(() => resultRevisions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('result_required_answerers_pk').on(table.resultRevisionId, table.userId)],
);

/**
 * One side of a match, as the revision that created it saw the sides, and how that side came to be satisfied.
 *
 * Revision 2.3 of the contract asks each side for one answer rather than each person for a vote, so a side is the unit
 * a settlement counts. The row is frozen with the revision: losing a membership afterwards neither removes a side's
 * requirement nor satisfies it, and a correction writes its own sides rather than inheriting the first revision's.
 *
 * `satisfiedBy` keeps apart three things a reader must never merge: the recorder's own side, which the submission
 * answered; a side with nobody registered on it, which has nobody to ask; and a side an account actually confirmed,
 * which is the only one that carries a confirmer and a time
 * @public
 * @constant
 */
export const resultRevisionSides = pgTable(
  'result_revision_sides',
  {
    resultRevisionId: uuid('result_revision_id')
      .notNull()
      .references(() => resultRevisions.id, { onDelete: 'cascade' }),
    side: participantSideEnum('side').notNull(),
    satisfiedBy: sideSatisfactionEnum('satisfied_by').notNull(),
    /* Who confirmed for this side, and when; both null unless this side was satisfied by an explicit confirmation */
    confirmedByUserId: uuid('confirmed_by_user_id').references(() => users.id),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('result_revision_sides_pk').on(table.resultRevisionId, table.side),
    /* Settlement asks one question of this table: does this revision still have a side that owes an answer */
    index('result_revision_sides_pending_idx').on(table.resultRevisionId, table.satisfiedBy),
    /**
     * A confirmer and a time exist exactly when the side was satisfied by a confirmation, and neither exists
     * otherwise. Stated as a case rather than as an equality between two booleans: `false = false` is satisfied by a
     * pending side carrying half a confirmation, which is audit evidence for something that never happened
     */
    check(
      'result_revision_sides_confirmation_pair',
      sql`CASE WHEN ${table.satisfiedBy} = 'CONFIRMATION'
            THEN ${table.confirmedByUserId} IS NOT NULL AND ${table.confirmedAt} IS NOT NULL
            ELSE ${table.confirmedByUserId} IS NULL AND ${table.confirmedAt} IS NULL
          END`,
    ),
  ],
);

/**
 * Which accounts may answer for one side of one revision, frozen as the revision was born.
 *
 * The set is the side's, not the person's: any one of them satisfies it, and removing one of them leaves the
 * requirement and the rest of the set exactly as they were. A side whose whole set has left waits for the deadline
 * rather than being quietly early-confirmed
 * @public
 * @constant
 */
export const resultSideConfirmers = pgTable(
  'result_side_confirmers',
  {
    resultRevisionId: uuid('result_revision_id')
      .notNull()
      .references(() => resultRevisions.id, { onDelete: 'cascade' }),
    side: participantSideEnum('side').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('result_side_confirmers_pk').on(table.resultRevisionId, table.side, table.userId),
    /* Asked the other way round by an action: which side, if any, is this account eligible to answer for */
    index('result_side_confirmers_user_idx').on(table.resultRevisionId, table.userId),
  ],
);

/**
 * A durable record of one confirm, dispute or void against one revision.
 *
 * An action is bound to the revision it answered, so a confirmation never carries forward onto a correction the person
 * has not seen. At most one effective confirmation per person per revision; a dispute is separate, because a person
 * who confirmed and then noticed the mistake may still dispute while the revision is pending
 * @public
 * @constant
 */
export const resultActions = pgTable(
  'result_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resultRevisionId: uuid('result_revision_id')
      .notNull()
      .references(() => resultRevisions.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    type: resultActionEnum('type').notNull(),
    /**
     * The role the actor held when this action was authorized, kept because the page's Void transition has to say
     * who ruled and under what authority. Null on a row written before the column existed: an unknown historical
     * role stays unknown rather than being inferred from today's membership
     */
    actorRole: leagueRoleEnum('actor_role'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('result_actions_one_per_actor_unique').on(table.resultRevisionId, table.actorUserId, table.type),
    index('result_actions_revision_idx').on(table.resultRevisionId),
  ],
);

/**
 * The free text somebody attached to a dispute, stored apart from every immutable scoring fact.
 *
 * Separate so deletion can redact the words without touching the scores, the ratings or the receipts that prove what
 * happened. Nothing copies this text anywhere else, which is the only way redaction can be complete (contract §7)
 * @public
 * @constant
 */
export const resultDisputeNotes = pgTable(
  'result_dispute_notes',
  {
    resultActionId: uuid('result_action_id')
      .primaryKey()
      .references(() => resultActions.id, { onDelete: 'cascade' }),
    /* Null once redacted; the row stays so history still shows that a note was written and then removed */
    body: text('body'),
    redactedAt: timestamp('redacted_at', { withTimezone: true }),
  },
  (table) => [check('result_dispute_notes_redacted_empty', sql`${table.redactedAt} IS NULL OR ${table.body} IS NULL`)],
);

/**
 * The receipt of one committed write.
 *
 * Keyed by actor, operation type and the client's own operation identifier, so a request whose answer was lost is
 * resolved by replaying the identical action rather than by writing a second one. The digest is what tells an
 * identical retry from a changed body wearing the same key
 * @public
 * @constant
 */
export const resultOperations = pgTable(
  'result_operations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    operation: resultOperationEnum('operation').notNull(),
    /* The identifier the client minted before it sent anything, and reuses for every retry of that action */
    clientOperationId: uuid('client_operation_id').notNull(),
    requestDigest: text('request_digest').notNull(),
    canonicalMatchId: uuid('canonical_match_id').notNull(),
    resultRevisionId: uuid('result_revision_id')
      .notNull()
      .references(() => resultRevisions.id, { onDelete: 'cascade' }),
    /* The effect as it was recorded; replayed back verbatim rather than recomputed against newer state */
    effect: jsonb('effect').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('result_operations_key_unique').on(table.actorUserId, table.operation, table.clientOperationId),
    index('result_operations_match_idx').on(table.canonicalMatchId),
  ],
);

/**
 * One complete, immutable computation of a league's ladder.
 *
 * A generation is published whole or not at all, and the league points at exactly one of them; a reader that followed
 * the newest snapshot by insertion time would see a ladder half-rebuilt. Superseded generations stay as audit history
 * (contract §5)
 * @public
 * @constant
 */
export const ratingGenerations = pgTable(
  'rating_generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
    /* The revision whose transition caused the recomputation; null for a league's first generation */
    causedByRevisionId: uuid('caused_by_revision_id').references(() => resultRevisions.id, { onDelete: 'set null' }),
    /* How many eligible game rows the replay consumed, so a measured budget has its input recorded beside it */
    ratedGameCount: integer('rated_game_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('rating_generations_league_idx').on(table.leagueId, table.createdAt)],
);

/**
 * Which generation a league's ratings are currently read from.
 *
 * A row of its own rather than a column on the league, so publishing a ladder is one small write that cannot touch a
 * league's configuration revision, and so the pointer and the generations it names live in one module. Every rating
 * read joins through this; none of them takes the newest snapshot by insertion time (contract §5)
 * @public
 * @constant
 */
export const activeRatingGenerations = pgTable('active_rating_generations', {
  leagueId: uuid('league_id')
    .primaryKey()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  ratingGenerationId: uuid('rating_generation_id')
    .notNull()
    .references(() => ratingGenerations.id, { onDelete: 'restrict' }),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});
