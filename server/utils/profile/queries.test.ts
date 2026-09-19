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
 * ███████████████████████████████████████ #server/utils/profile/queries.test.ts ███████████████████████████████████████
 *
 * Persistence tests for the profile queries, run against a real Postgres.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationStatus, GameStatus, LeagueRole, MembershipStatus } from '#shared/domain';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import type { ILeagueMembershipPage, ILeagueMembershipQuery, IProfile } from '#shared/profile';
import { LeagueMembershipSort, LEAGUES_LIST_PAGE_SIZE } from '#shared/profile';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import { readLeagueMembers } from '../leagues/queries';
import { completeProfile, isActiveAccount, readMemberships, readProfile, updateDisplayName } from './queries';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The handle the mocked database module hands back, swapped for a fresh Postgres before each case
 * @internal
 * @constant
 */
const databaseRef = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('#utils/db', (): Record<string, unknown> => ({ useDatabase: (): unknown => databaseRef.current }));

/**
 * The checked-in migration directory, applied so the queries run against the real schema
 * @internal
 * @constant
 */
const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../../db/migrations', import.meta.url));

/**
 * The signed-in player's address
 * @internal
 * @constant
 */
const PLAYER_EMAIL: string = 'maya@example.com';

/**
 * A second player, present so every scoping assertion has something to wrongly include
 * @internal
 * @constant
 */
const OTHER_EMAIL: string = 'sam@example.com';

/**
 * The name a player renames themselves to
 * @internal
 * @constant
 */
const CHOSEN_NAME: string = 'Maya Topspin';

/**
 * The default full-list query used by persistence cases.
 * @internal
 * @constant
 */
const DEFAULT_QUERY: ILeagueMembershipQuery = {
  format: null,
  page: 1,
  pageSize: LEAGUES_LIST_PAGE_SIZE,
  role: null,
  search: '',
  sort: LeagueMembershipSort.JOINED,
};

/**
 * Optional fixture values for a league and the viewer's membership.
 * @internal
 * @interface
 */
interface ILeagueFixtureOptions {
  /* The league description */
  description?: string | null;

  /* The formats stored in league settings */
  formats?: GameType[];

  /* When the viewer joined */
  joinedAt?: Date;

  /* The viewer's role */
  role?: LeagueRole;

  /* The viewer's membership status */
  status?: MembershipStatus;
}

/**
 * The database under test, rebuilt for every case
 * @internal
 */
let database: ReturnType<typeof drizzle>;

/**
 * Inserts a player and returns their id.
 * @internal
 * @function
 * @param email - The account's address
 * @param displayName - The account's display name
 * @returns The new account's identifier
 */
async function insertUser(email: string, displayName: string): Promise<string> {
  const { rows } = await database.execute<{ id: string }>(
    sql`INSERT INTO "users" ("email", "display_name") VALUES (${email}, ${displayName}) RETURNING "id"`,
  );

  return rows[0]!.id;
}

/**
 * Inserts a league and joins a member to it.
 * @internal
 * @function
 * @param ownerId - The player creating the league
 * @param memberId - The player joining
 * @param name - The league's name
 * @param abbreviation - The league's short form
 * @param options - Optional league and membership fields
 * @returns The new league's identifier
 */
async function insertLeague(
  ownerId: string,
  memberId: string,
  name: string,
  abbreviation: string,
  options: ILeagueFixtureOptions = {},
): Promise<string> {
  const settings = {
    ...STANDARD_LEAGUE_SETTINGS,
    allowedGameTypes: options.formats ?? STANDARD_LEAGUE_SETTINGS.allowedGameTypes,
  };
  const { rows } = await database.execute<{ id: string }>(
    sql`INSERT INTO "leagues" ("name", "abbreviation", "description", "settings", "created_by")
        VALUES (${name}, ${abbreviation}, ${options.description ?? null}, ${JSON.stringify(settings)}::jsonb, ${ownerId})
        RETURNING "id"`,
  );
  const leagueId: string = rows[0]!.id;

  await database.execute(
    sql`INSERT INTO "memberships" ("league_id", "user_id", "role", "status", "joined_at")
        VALUES (
          ${leagueId},
          ${memberId},
          ${options.role ?? LeagueRole.PLAYER},
          ${options.status ?? MembershipStatus.ACTIVE},
          ${options.joinedAt ?? new Date()}
        )`,
  );

  return leagueId;
}

/**
 * Adds another membership to a league for aggregate cases.
 * @internal
 * @function
 * @param leagueId - The league to join
 * @param userId - The player joining
 * @param status - The membership status
 */
async function insertMembership(
  leagueId: string,
  userId: string,
  status: MembershipStatus = MembershipStatus.ACTIVE,
): Promise<void> {
  await database.execute(
    sql`INSERT INTO "memberships" ("league_id", "user_id", "role", "status")
        VALUES (${leagueId}, ${userId}, ${LeagueRole.PLAYER}, ${status})`,
  );
}

/**
 * Adds a game to a league for accepted-result aggregate cases.
 * @internal
 * @function
 * @param leagueId - The league receiving the game
 * @param creatorId - The player who created the game
 * @param status - The game lifecycle status
 * @param confirmationStatus - The result confirmation status
 * @returns The new game's identifier
 */
async function insertGame(
  leagueId: string,
  creatorId: string,
  status: GameStatus,
  confirmationStatus: ConfirmationStatus = ConfirmationStatus.CONFIRMED,
): Promise<string> {
  const { rows } = await database.execute<{ id: string }>(
    sql`INSERT INTO "games" (
          "league_id", "type", "status", "confirmation_status", "settings_snapshot", "created_by"
        )
        VALUES (${leagueId}, ${GameType.SINGLES}, ${status}, ${confirmationStatus}, '{}'::jsonb, ${creatorId})
        RETURNING "id"`,
  );

  return rows[0]!.id;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach(async (): Promise<void> => {
    database = drizzle(new PGlite());
    databaseRef.current = database;

    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  describe(symbolName(readProfile), (): void => {
    it('returns only the allowlisted account fields', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      // A column added to users later must stay invisible until somebody adds it to the allowlist deliberately
      expect(Object.keys((await readProfile(id))!).sort()).toEqual([
        'avatarUrl',
        'createdAt',
        'displayName',
        'email',
        'id',
        'profileCompletedAt',
      ]);
    });

    it('refuses to resolve a soft-deleted account', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW()`);

      expect(await readProfile(id)).toBeNull();
    });
  });

  describe(symbolName(updateDisplayName), (): void => {
    it('saves the name and leaves onboarding state alone', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      expect(await updateDisplayName(id, CHOSEN_NAME)).toMatchObject({
        displayName: CHOSEN_NAME,
        profileCompletedAt: null,
      });
    });

    it('writes nothing to a soft-deleted account, so a stale session cannot edit it', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW()`);

      expect(await updateDisplayName(id, CHOSEN_NAME)).toBeNull();
    });

    it("leaves another player's account untouched", async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const theirs: string = await insertUser(OTHER_EMAIL, 'Sam');

      await updateDisplayName(mine, CHOSEN_NAME);

      const { rows } = await database.execute<{ display_name: string }>(
        sql`SELECT "display_name" FROM "users" WHERE "id" = ${theirs}`,
      );

      expect(rows[0]!.display_name).toBe('Sam');
    });
  });

  describe(symbolName(completeProfile), (): void => {
    it('saves the name and stamps completion in one write', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const profile: IProfile | null = await completeProfile(id, CHOSEN_NAME);

      expect(profile!.displayName).toBe(CHOSEN_NAME);
      expect(profile!.profileCompletedAt).not.toBeNull();
    });

    it('keeps the original stamp when the operation runs twice', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      const first: IProfile | null = await completeProfile(id, CHOSEN_NAME);
      const second: IProfile | null = await completeProfile(id, 'Maya Backhand');

      // The name follows the second write; the completion date must not move
      expect(second!.displayName).toBe('Maya Backhand');
      expect(second!.profileCompletedAt).toBe(first!.profileCompletedAt);
    });
  });

  describe(symbolName(readMemberships), (): void => {
    it('distinguishes no memberships from one matching membership', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      expect(await readMemberships(mine, DEFAULT_QUERY)).toEqual({
        filteredTotal: 0,
        page: 1,
        pageSize: LEAGUES_LIST_PAGE_SIZE,
        rows: [],
        unfilteredTotal: 0,
      });

      await insertLeague(mine, mine, 'Warehouse Wednesdays', 'WW', {
        description: 'Games after the warehouse shift.',
        formats: [GameType.SINGLES],
      });

      const page: ILeagueMembershipPage = await readMemberships(mine, DEFAULT_QUERY);

      expect(page.filteredTotal).toBe(1);
      expect(page.unfilteredTotal).toBe(1);
      expect(page.rows[0]).toMatchObject({
        allowedGameTypes: [GameType.SINGLES],
        description: 'Games after the warehouse shift.',
        gameCount: 0,
        memberCount: 1,
        name: 'Warehouse Wednesdays',
        role: LeagueRole.PLAYER,
      });
    });

    it('filters before the limit, returns both totals and clamps stale pages', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const joinedAt: Date = new Date('2026-01-01T00:00:00.000Z');

      await Promise.all(
        Array.from({ length: 21 }, async (_unused: unknown, index: number): Promise<string> =>
          insertLeague(mine, mine, `League ${String(index + 1).padStart(2, '0')}`, `L${index + 1}`, {
            joinedAt,
            role: index === 20 ? LeagueRole.MANAGER : LeagueRole.PLAYER,
          }),
        ),
      );

      const secondPage: ILeagueMembershipPage = await readMemberships(mine, { ...DEFAULT_QUERY, page: 9 });
      const managers: ILeagueMembershipPage = await readMemberships(mine, {
        ...DEFAULT_QUERY,
        page: 9,
        role: LeagueRole.MANAGER,
      });

      expect(secondPage.page).toBe(2);
      expect(secondPage.rows).toHaveLength(1);
      expect(secondPage.filteredTotal).toBe(21);
      expect(secondPage.unfilteredTotal).toBe(21);
      expect(managers.page).toBe(1);
      expect(managers.rows.map((row): string => row.name)).toEqual(['League 21']);
      expect(managers.filteredTotal).toBe(1);
      expect(managers.unfilteredTotal).toBe(21);
    });

    it('isolates roles, formats and literal wildcard search text', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');

      await insertLeague(mine, mine, 'Ten Percent', '10%', {
        formats: [GameType.CUTTHROAT],
        role: LeagueRole.COMMISSIONER,
      });
      await insertLeague(mine, mine, 'Under_score', 'US', { formats: [GameType.SINGLES] });
      await insertLeague(mine, mine, 'Ordinary League', 'OL', { formats: [GameType.CUTTHROAT] });

      const literalPercent: ILeagueMembershipPage = await readMemberships(mine, {
        ...DEFAULT_QUERY,
        search: '%',
      });
      const literalUnderscore: ILeagueMembershipPage = await readMemberships(mine, {
        ...DEFAULT_QUERY,
        search: '_',
      });
      const cutthroatCommissioners: ILeagueMembershipPage = await readMemberships(mine, {
        ...DEFAULT_QUERY,
        format: GameType.CUTTHROAT,
        role: LeagueRole.COMMISSIONER,
      });

      expect(literalPercent.rows.map((row): string => row.name)).toEqual(['Ten Percent']);
      expect(literalUnderscore.rows.map((row): string => row.name)).toEqual(['Under_score']);
      expect(cutthroatCommissioners.rows.map((row): string => row.name)).toEqual(['Ten Percent']);
    });

    it('keeps all three sorts stable with the league identifier as the final tie break', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const joinedAt: Date = new Date('2026-01-01T00:00:00.000Z');

      await insertLeague(mine, mine, 'Same Name', 'B', { joinedAt });
      await insertLeague(mine, mine, 'Same Name', 'A', { joinedAt });

      const joinedFirst: ILeagueMembershipPage = await readMemberships(mine, DEFAULT_QUERY);
      const joinedAgain: ILeagueMembershipPage = await readMemberships(mine, DEFAULT_QUERY);
      const name: ILeagueMembershipPage = await readMemberships(mine, {
        ...DEFAULT_QUERY,
        sort: LeagueMembershipSort.NAME,
      });
      const members: ILeagueMembershipPage = await readMemberships(mine, {
        ...DEFAULT_QUERY,
        sort: LeagueMembershipSort.MEMBERS,
      });

      expect(joinedFirst.rows.map((row): string => row.id)).toEqual(joinedAgain.rows.map((row): string => row.id));
      expect(name.rows.map((row): string => row.id)).toEqual(joinedFirst.rows.map((row): string => row.id));
      expect(members.rows.map((row): string => row.id)).toEqual(joinedFirst.rows.map((row): string => row.id));
    });

    it('excludes removed and inactive memberships from rows and both totals', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const theirs: string = await insertUser(OTHER_EMAIL, 'Sam');

      await insertLeague(mine, mine, 'Active League', 'AL');
      await insertLeague(mine, mine, 'Left League', 'LL', { status: MembershipStatus.REMOVED });
      await insertLeague(mine, mine, 'Inactive League', 'IL', { status: MembershipStatus.INACTIVE });
      await insertLeague(theirs, theirs, 'Private Elsewhere', 'PE');

      const page: ILeagueMembershipPage = await readMemberships(mine, DEFAULT_QUERY);

      expect(page.rows.map((row): string => row.name)).toEqual(['Active League']);
      expect(page.filteredTotal).toBe(1);
      expect(page.unfilteredTotal).toBe(1);
    });

    it('aggregates active members and accepted games without multiplying either count', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const teammate: string = await insertUser(OTHER_EMAIL, 'Sam');
      const removed: string = await insertUser('left@example.com', 'Lee');
      const leagueId: string = await insertLeague(mine, mine, 'Aggregate League', 'AGG');

      await insertMembership(leagueId, teammate);
      await insertMembership(leagueId, removed, MembershipStatus.REMOVED);
      await insertGame(leagueId, mine, GameStatus.COMPLETE);
      await insertGame(leagueId, mine, GameStatus.RETIRED);

      const page: ILeagueMembershipPage = await readMemberships(mine, DEFAULT_QUERY);

      expect(page.rows[0]).toMatchObject({ gameCount: 2, memberCount: 2 });
    });

    it('matches live rosters and keeps deleted members from changing the member sort', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const liveMember: string = await insertUser(OTHER_EMAIL, 'Sam');
      const deletedMember: string = await insertUser('deleted@example.com', 'Deleted Player');
      const deletedLeagueId: string = await insertLeague(mine, mine, 'Deleted Membership', 'DM');
      const liveLeagueId: string = await insertLeague(mine, mine, 'Live Roster', 'LR');

      await insertMembership(deletedLeagueId, deletedMember);
      await insertMembership(liveLeagueId, liveMember);
      await insertGame(deletedLeagueId, deletedMember, GameStatus.COMPLETE);
      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW() WHERE "id" = ${deletedMember}`);

      const page: ILeagueMembershipPage = await readMemberships(mine, {
        ...DEFAULT_QUERY,
        sort: LeagueMembershipSort.MEMBERS,
      });
      const deletedLeagueRoster = await readLeagueMembers(deletedLeagueId);
      const liveLeagueRoster = await readLeagueMembers(liveLeagueId);

      expect(page.rows.map((row): string => row.name)).toEqual(['Live Roster', 'Deleted Membership']);
      expect(page.rows).toEqual([
        expect.objectContaining({
          gameCount: 0,
          memberCount: liveLeagueRoster.length,
          name: 'Live Roster',
        }),
        expect.objectContaining({
          gameCount: 1,
          memberCount: deletedLeagueRoster.length,
          name: 'Deleted Membership',
        }),
      ]);
      expect(deletedLeagueRoster).toHaveLength(1);
      expect(liveLeagueRoster).toHaveLength(2);
    });

    it('counts only confirmed complete, retired and walkover games, including guest games', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const leagueId: string = await insertLeague(mine, mine, 'Accepted Results', 'AR');
      const completeId: string = await insertGame(leagueId, mine, GameStatus.COMPLETE);

      await insertGame(leagueId, mine, GameStatus.RETIRED);
      await insertGame(leagueId, mine, GameStatus.WALKOVER);
      await insertGame(leagueId, mine, GameStatus.COMPLETE, ConfirmationStatus.UNCONFIRMED);
      await insertGame(leagueId, mine, GameStatus.COMPLETE, ConfirmationStatus.DISPUTED);
      await insertGame(leagueId, mine, GameStatus.ABANDONED);
      await insertGame(leagueId, mine, GameStatus.NO_CONTEST);
      await insertGame(leagueId, mine, GameStatus.VOID);
      await database.execute(
        sql`INSERT INTO "game_participants" ("game_id", "guest_name") VALUES (${completeId}, 'Guest Player')`,
      );

      const page: ILeagueMembershipPage = await readMemberships(mine, DEFAULT_QUERY);

      expect(page.rows[0]!.gameCount).toBe(3);
    });
  });

  describe(symbolName(isActiveAccount), (): void => {
    it('reports a live account as active', async (): Promise<void> => {
      expect(await isActiveAccount(await insertUser(PLAYER_EMAIL, 'Maya'))).toBe(true);
    });

    it('reports a soft-deleted account as inactive, so its sealed session stops resolving', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW() WHERE "id" = ${id}`);

      expect(await isActiveAccount(id)).toBe(false);
    });

    it('reports an identifier naming no account as inactive', async (): Promise<void> => {
      expect(await isActiveAccount('00000000-0000-0000-0000-000000000000')).toBe(false);
    });

    it('answers per account rather than for whoever exists', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const theirs: string = await insertUser(OTHER_EMAIL, 'Sam');

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW() WHERE "id" = ${mine}`);

      expect(await isActiveAccount(mine)).toBe(false);
      expect(await isActiveAccount(theirs)).toBe(true);
    });
  });
});
