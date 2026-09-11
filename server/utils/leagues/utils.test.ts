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
 * ████████████████████████████████████████ #server/utils/leagues/utils.test.ts ████████████████████████████████████████
 *
 * Unit tests for the league-entry operations, run against the real migrations on PGlite.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { H3Error, H3Event } from 'h3';
import type { Mock } from 'vitest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { LeagueRole } from '#shared/domain';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import type { ICreateLeagueRequest, IInviteLink, IInvitePanel, ILeagueDetail } from '#shared/leagues';
import { InviteLinkState, InviteLookupKind } from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import { CREATION_REQUEST_CONSTRAINT, SHARED_INVITE_CONSTRAINT } from './constants';
import { LeagueRefusal } from './enums';
import type { IInviteLinkRow, TLeagueOperationResult } from './types';
import {
  acceptInvite,
  answerRefusal,
  createLeague,
  digestCreateLeagueRequest,
  generateInviteToken,
  issueInvite,
  isUniqueViolation,
  lookupInvite,
  readInvitePanel,
  readLeagueDetail,
  replaceInvite,
  revokeInvite,
  toInviteLink,
} from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The handle the mocked database module hands back.
 * @internal
 * @constant
 */
const databaseRef = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('#utils/db', (): Record<string, unknown> => ({ useDatabase: (): unknown => databaseRef.current }));

/**
 * The session boundary `answerRefusal` clears for a vanished account, stubbed as the auto-imported global.
 * @internal
 * @constant
 */
const clearUserSessionMock: Mock<(event: H3Event) => Promise<void>> = vi.fn(async (): Promise<void> => {});

vi.stubGlobal('clearUserSession', clearUserSessionMock);

/**
 * The checked-in migration directory, applied so every statement runs against the real schema
 * @internal
 * @constant
 */
const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../../db/migrations', import.meta.url));

/**
 * A league identifier no league has
 * @internal
 * @constant
 */
const UNKNOWN_LEAGUE_ID: string = '00000000-0000-4000-8000-000000000000';

/**
 * A well-formed token no invitation carries
 * @internal
 * @constant
 */
const UNKNOWN_TOKEN: string = 'A'.repeat(43);

/**
 * The options a link is issued with unless a case needs others
 * @internal
 * @constant
 */
const WEEK_NO_LIMIT: { expiresInDays: number; maxUses: number | null } = { expiresInDays: 7, maxUses: null };

/**
 * The PGlite instance under the handle, kept so it can be closed after the suite
 * @internal
 */
let client: PGlite;

/**
 * The database under test, migrated once and emptied before every case
 * @internal
 */
let database: ReturnType<typeof drizzle>;

/**
 * Inserts an account.
 * @internal
 * @function
 * @param displayName - The account's display name, also used to derive its address
 * @param options - Whether the account has finished /welcome and whether it is soft-deleted
 * @returns The new account's identifier
 */
async function insertUser(
  displayName: string,
  options: { complete?: boolean; deleted?: boolean } = {},
): Promise<string> {
  const { complete = true, deleted = false }: { complete?: boolean; deleted?: boolean } = options;
  const { rows } = await database.execute<{ id: string }>(sql`
    INSERT INTO "users" ("email", "display_name", "profile_completed_at", "deleted_at")
    VALUES (${`${displayName.toLowerCase()}@example.com`}, ${displayName},
            ${complete ? sql`now()` : sql`NULL`}, ${deleted ? sql`now()` : sql`NULL`})
    RETURNING "id"`);

  return rows[0]!.id;
}

/**
 * Builds a create request with a fresh submission identifier.
 * @internal
 * @function
 * @param overrides - Fields the case changes
 * @returns The request
 */
function buildRequest(overrides: Partial<ICreateLeagueRequest> = {}): ICreateLeagueRequest {
  return {
    abbreviation: 'FRI',
    allowedGameTypes: [GameType.SINGLES, GameType.DOUBLES, GameType.CUTTHROAT],
    description: 'Our office squad',
    name: 'Friday Ladder',
    submissionId: crypto.randomUUID(),
    ...overrides,
  };
}

/**
 * Unwraps a result the case expects to succeed.
 * @internal
 * @function
 * @param result - The operation's result
 * @throws When the operation refused, naming the refusal
 * @returns The success value
 */
function valueOf<TValue>(result: TLeagueOperationResult<TValue>): TValue {
  if (!result.ok) {
    throw new Error(`Expected success, got ${result.refusal}.`);
  }

  return result.value;
}

/**
 * Creates a league owned by a fresh commissioner.
 * @internal
 * @function
 * @param commissionerName - The commissioner's display name, distinct per league a case seeds
 * @returns The league and its commissioner
 */
async function seedLeague(
  commissionerName: string = 'Commissioner',
): Promise<{ commissionerId: string; leagueId: string }> {
  const commissionerId: string = await insertUser(commissionerName);
  const { leagueId } = valueOf(await createLeague(commissionerId, buildRequest()));

  return { commissionerId, leagueId };
}

/**
 * Adds a membership directly, for the states the app has no action for yet.
 * @internal
 * @function
 * @param leagueId - The league
 * @param userId - The member
 * @param role - Their role
 * @param status - Their membership status
 */
async function insertMembership(
  leagueId: string,
  userId: string,
  role: string = 'PLAYER',
  status: string = 'ACTIVE',
): Promise<void> {
  await database.execute(sql`
    INSERT INTO "memberships" ("league_id", "user_id", "role", "status", "joined_at", "left_at")
    VALUES (${leagueId}, ${userId}, ${role}::league_role, ${status}::membership_status,
            now() - interval '30 days', ${status === 'INACTIVE' ? sql`now() - interval '1 day'` : sql`NULL`})`);
}

/**
 * Issues a link as the commissioner and returns it.
 * @internal
 * @function
 * @param leagueId - The league
 * @param commissionerId - Its commissioner
 * @param maxUses - The use limit
 * @returns The usable link
 */
async function seedLink(leagueId: string, commissionerId: string, maxUses: number | null = null): Promise<IInviteLink> {
  const panel: IInvitePanel = valueOf(
    await issueInvite(leagueId, commissionerId, {
      expiresInDays: 7,
      maxUses,
      previousId: null,
    }),
  );

  return panel.link!;
}

/**
 * Reads one column of one invitation back.
 * @internal
 * @function
 * @param id - The invitation
 * @returns Its stored status and use count
 */
async function readInvitation(id: string): Promise<{ status: string; use_count: number }> {
  const { rows } = await database.execute<{ status: string; use_count: number }>(
    sql`SELECT "status", "use_count" FROM "invitations" WHERE "id" = ${id}`,
  );

  return rows[0]!;
}

/**
 * Reads a membership back.
 * @internal
 * @function
 * @param leagueId - The league
 * @param userId - The member
 * @returns The row's role, status, join date and leave date, or undefined when there is none
 */
async function readMembership(
  leagueId: string,
  userId: string,
): Promise<{ joined_at: Date; left_at: Date | null; role: string; status: string } | undefined> {
  const { rows } = await database.execute<{ joined_at: Date; left_at: Date | null; role: string; status: string }>(
    sql`SELECT "role", "status", "joined_at", "left_at" FROM "memberships"
         WHERE "league_id" = ${leagueId} AND "user_id" = ${userId}`,
  );

  return rows[0];
}

/**
 * Counts the rows of one table.
 * @internal
 * @function
 * @param table - The table name
 * @returns The row count
 */
async function countRows(table: string): Promise<number> {
  const { rows } = await database.execute<{ count: number }>(
    sql.raw(`SELECT count(*)::int AS "count" FROM "${table}"`),
  );

  return rows[0]!.count;
}

/**
 * Moves an invitation's expiry into the past.
 * @internal
 * @function
 * @param id - The invitation
 */
async function expireInvitation(id: string): Promise<void> {
  await database.execute(sql`UPDATE "invitations" SET "expires_at" = now() - interval '1 second' WHERE "id" = ${id}`);
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeAll(async (): Promise<void> => {
    client = new PGlite();
    database = drizzle(client);
    databaseRef.current = database;

    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  beforeEach(async (): Promise<void> => {
    clearUserSessionMock.mockClear();

    // Emptied rather than rebuilt: the migrations are the slow part, and every case seeds what it needs
    await database.execute(
      sql`TRUNCATE "league_creation_requests", "invitations", "memberships", "leagues", "users" CASCADE`,
    );
  });

  afterAll(async (): Promise<void> => {
    await client.close();
  });

  describe(symbolName(generateInviteToken), (): void => {
    it('produces a 43-character base64url token that differs on every call', (): void => {
      const tokens: string[] = [generateInviteToken(), generateInviteToken()];

      expect(tokens.every((token: string): boolean => /^[\w-]{43}$/.test(token))).toBe(true);
      expect(tokens[0]).not.toBe(tokens[1]);
    });
  });

  describe(symbolName(digestCreateLeagueRequest), (): void => {
    it('ignores the submission identifier and changes with any field', (): void => {
      const request: ICreateLeagueRequest = buildRequest();

      expect(digestCreateLeagueRequest({ ...request, submissionId: crypto.randomUUID() })).toBe(
        digestCreateLeagueRequest(request),
      );
      expect(digestCreateLeagueRequest({ ...request, name: 'Monday Ladder' })).not.toBe(
        digestCreateLeagueRequest(request),
      );
      expect(digestCreateLeagueRequest({ ...request, allowedGameTypes: [GameType.SINGLES] })).not.toBe(
        digestCreateLeagueRequest(request),
      );
    });
  });

  describe(symbolName(isUniqueViolation), (): void => {
    it('recognizes the named constraint on a real driver error and nothing broader', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const { rows } = await database.execute<{ submission_id: string }>(
        sql`SELECT "submission_id" FROM "league_creation_requests"`,
      );
      let thrown: unknown;

      // A duplicate submission record, exactly what an identical racing submission meets
      try {
        await database.execute(sql`
          INSERT INTO "league_creation_requests" ("created_by", "submission_id", "payload_digest", "league_id")
          VALUES (${commissionerId}, ${rows[0]!.submission_id}, 'digest', ${leagueId})`);
      } catch (error: unknown) {
        thrown = error;
      }

      expect(isUniqueViolation(thrown, CREATION_REQUEST_CONSTRAINT)).toBe(true);
      expect(isUniqueViolation(thrown, SHARED_INVITE_CONSTRAINT)).toBe(false);
      expect(isUniqueViolation(new Error('unrelated'), CREATION_REQUEST_CONSTRAINT)).toBe(false);
    });
  });

  describe(symbolName(toInviteLink), (): void => {
    /**
     * A usable row the cases vary one field at a time.
     * @internal
     * @constant
     */
    const usable: IInviteLinkRow = {
      expired: false,
      expiresAt: new Date('2026-09-17T12:00:00.000Z'),
      expiresInDays: 7,
      id: 'id',
      maxUses: 5,
      status: 'PENDING',
      token: 'token',
      useCount: 2,
    };

    it('carries the token only while the link is usable', (): void => {
      expect(toInviteLink(usable)).toMatchObject({ state: InviteLinkState.USABLE, token: 'token' });
      expect(toInviteLink({ ...usable, expired: true })).toMatchObject({ state: InviteLinkState.EXPIRED, token: null });
    });

    it('reads a link out of both uses and time as exhausted', (): void => {
      expect(
        toInviteLink({
          ...usable,
          expired: true,
          useCount: 5,
        }).state,
      ).toBe(InviteLinkState.EXHAUSTED);
    });

    it('reads stored retirements as they were recorded', (): void => {
      expect(toInviteLink({ ...usable, status: 'REVOKED' }).state).toBe(InviteLinkState.REVOKED);
      expect(toInviteLink({ ...usable, status: 'EXPIRED' }).state).toBe(InviteLinkState.EXPIRED);
    });
  });

  describe(symbolName(createLeague), (): void => {
    it('writes the league, the commissioner membership and the standard settings with the chosen formats', async (): Promise<void> => {
      const creatorId: string = await insertUser('Maya');
      const { leagueId } = valueOf(
        await createLeague(creatorId, buildRequest({ allowedGameTypes: [GameType.CUTTHROAT] })),
      );
      const { rows } = await database.execute<{ settings: unknown; visibility: string }>(
        sql`SELECT "settings", "visibility" FROM "leagues" WHERE "id" = ${leagueId}`,
      );

      expect(rows[0]).toEqual({
        settings: { ...STANDARD_LEAGUE_SETTINGS, allowedGameTypes: [GameType.CUTTHROAT] },
        visibility: 'PRIVATE',
      });
      expect(await readMembership(leagueId, creatorId)).toMatchObject({ role: 'COMMISSIONER', status: 'ACTIVE' });
    });

    it('answers a replayed submission with the league it already created', async (): Promise<void> => {
      const creatorId: string = await insertUser('Maya');
      const request: ICreateLeagueRequest = buildRequest();
      const first: TLeagueOperationResult<{ leagueId: string }> = await createLeague(creatorId, request);

      expect(await createLeague(creatorId, request)).toEqual(first);
      expect(await countRows('leagues')).toBe(1);
      expect(await countRows('memberships')).toBe(1);
    });

    it('refuses a replayed identifier carrying a different league, writing nothing', async (): Promise<void> => {
      const creatorId: string = await insertUser('Maya');
      const request: ICreateLeagueRequest = buildRequest();

      await createLeague(creatorId, request);

      expect(await createLeague(creatorId, { ...request, name: 'Monday Ladder' })).toEqual({
        ok: false,
        refusal: LeagueRefusal.CONFLICT,
      });
      expect(await countRows('leagues')).toBe(1);
    });

    it('treats the same identifier from a different creator as a separate submission', async (): Promise<void> => {
      const request: ICreateLeagueRequest = buildRequest();

      await createLeague(await insertUser('Maya'), request);
      await createLeague(await insertUser('Sam'), request);

      expect(await countRows('leagues')).toBe(2);
    });

    it('refuses an account that still owes welcome, and one that no longer exists', async (): Promise<void> => {
      const unfinishedId: string = await insertUser('Maya', { complete: false });
      const deletedId: string = await insertUser('Sam', { deleted: true });

      expect(await createLeague(unfinishedId, buildRequest())).toEqual({
        ok: false,
        refusal: LeagueRefusal.NEEDS_WELCOME,
      });
      expect(await createLeague(deletedId, buildRequest())).toEqual({
        ok: false,
        refusal: LeagueRefusal.ACCOUNT_MISSING,
      });
      expect(await countRows('leagues')).toBe(0);
    });
  });

  describe(symbolName(readLeagueDetail), (): void => {
    it('returns the league and its active roster in role then join order, with no email anywhere', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const playerId: string = await insertUser('Player');
      const managerId: string = await insertUser('Manager');

      await insertMembership(leagueId, playerId);
      await insertMembership(leagueId, managerId, 'MANAGER');
      await insertMembership(leagueId, await insertUser('Gone'), 'PLAYER', 'REMOVED');

      const detail: ILeagueDetail = valueOf(await readLeagueDetail(leagueId, playerId));

      expect(detail.viewerRole).toBe(LeagueRole.PLAYER);
      expect(detail.members.map((member: ILeagueDetail['members'][number]): string => member.displayName)).toEqual([
        'Commissioner',
        'Manager',
        'Player',
      ]);
      expect(JSON.stringify(detail)).not.toContain('@example.com');
      expect(JSON.stringify(detail)).not.toContain(commissionerId);
    });

    it('answers a nonmember, an unknown id and a malformed id with the same refusal', async (): Promise<void> => {
      const { leagueId } = await seedLeague();
      const outsiderId: string = await insertUser('Outsider');
      const refused: { ok: false; refusal: LeagueRefusal } = { ok: false, refusal: LeagueRefusal.LEAGUE_NOT_FOUND };

      expect(await readLeagueDetail(leagueId, outsiderId)).toEqual(refused);
      expect(await readLeagueDetail(UNKNOWN_LEAGUE_ID, outsiderId)).toEqual(refused);
      expect(await readLeagueDetail('not-a-uuid', outsiderId)).toEqual(refused);
    });

    it('does not admit an inactive or removed member', async (): Promise<void> => {
      const { leagueId } = await seedLeague();
      const inactiveId: string = await insertUser('Inactive');
      const removedId: string = await insertUser('Removed');

      await insertMembership(leagueId, inactiveId, 'PLAYER', 'INACTIVE');
      await insertMembership(leagueId, removedId, 'PLAYER', 'REMOVED');

      expect((await readLeagueDetail(leagueId, inactiveId)).ok).toBe(false);
      expect((await readLeagueDetail(leagueId, removedId)).ok).toBe(false);
    });
  });

  describe(symbolName(readInvitePanel), (): void => {
    it('shows an empty panel to a commissioner and refuses a player and a nonmember', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const playerId: string = await insertUser('Player');

      await insertMembership(leagueId, playerId);

      expect(await readInvitePanel(leagueId, commissionerId)).toEqual({ ok: true, value: { link: null } });
      expect(await readInvitePanel(leagueId, playerId)).toEqual({ ok: false, refusal: LeagueRefusal.FORBIDDEN });
      expect(await readInvitePanel(leagueId, await insertUser('Outsider'))).toEqual({
        ok: false,
        refusal: LeagueRefusal.LEAGUE_NOT_FOUND,
      });
    });
  });

  describe(symbolName(issueInvite), (): void => {
    it('creates a usable link with the chosen expiry and limit', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId, 3);

      expect(link).toMatchObject({
        expiresInDays: 7,
        maxUses: 3,
        state: InviteLinkState.USABLE,
        useCount: 0,
      });
      expect(link.token).toMatch(/^[\w-]{43}$/);
    });

    it('lets a manager issue, and refuses a player without writing', async (): Promise<void> => {
      const { leagueId } = await seedLeague();
      const managerId: string = await insertUser('Manager');
      const playerId: string = await insertUser('Player');

      await insertMembership(leagueId, managerId, 'MANAGER');
      await insertMembership(leagueId, playerId);

      expect(await issueInvite(leagueId, playerId, { ...WEEK_NO_LIMIT, previousId: null })).toEqual({
        ok: false,
        refusal: LeagueRefusal.FORBIDDEN,
      });
      expect(await countRows('invitations')).toBe(0);
      expect((await issueInvite(leagueId, managerId, { ...WEEK_NO_LIMIT, previousId: null })).ok).toBe(true);
    });

    it('returns the usable link that already exists instead of rotating it', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const again: IInvitePanel = valueOf(
        await issueInvite(leagueId, commissionerId, {
          expiresInDays: 30,
          maxUses: 1,
          previousId: null,
        }),
      );

      expect(again.link).toEqual(link);
      expect(await countRows('invitations')).toBe(1);
    });

    it('retires an expired predecessor as EXPIRED and issues its successor', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);

      await expireInvitation(link.id);

      const panel: IInvitePanel = valueOf(
        await issueInvite(leagueId, commissionerId, {
          expiresInDays: 1,
          maxUses: 2,
          previousId: link.id,
        }),
      );

      expect(panel.link).toMatchObject({
        expiresInDays: 1,
        maxUses: 2,
        state: InviteLinkState.USABLE,
        useCount: 0,
      });
      expect((await readInvitation(link.id)).status).toBe('EXPIRED');
    });

    it('retires an exhausted predecessor and issues its successor', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId, 1);

      await acceptInvite(link.token!, await insertUser('Joiner'));

      expect(valueOf(await readInvitePanel(leagueId, commissionerId)).link?.state).toBe(InviteLinkState.EXHAUSTED);

      const panel: IInvitePanel = valueOf(
        await issueInvite(leagueId, commissionerId, {
          expiresInDays: 7,
          maxUses: 1,
          previousId: link.id,
        }),
      );

      expect(panel.link).toMatchObject({ state: InviteLinkState.USABLE, useCount: 0 });
      expect((await readInvitation(link.id)).status).toBe('REVOKED');
    });

    it('refuses a create naming a link other than the dead one that is current', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);

      await expireInvitation(link.id);

      expect(await issueInvite(leagueId, commissionerId, { ...WEEK_NO_LIMIT, previousId: UNKNOWN_LEAGUE_ID })).toEqual({
        ok: false,
        refusal: LeagueRefusal.STALE,
      });
      expect(await countRows('invitations')).toBe(1);
    });

    it('issues a fresh link after a revoke', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);

      await revokeInvite(leagueId, commissionerId, link.id);

      const panel: IInvitePanel = valueOf(
        await issueInvite(leagueId, commissionerId, { ...WEEK_NO_LIMIT, previousId: link.id }),
      );

      expect(panel.link?.state).toBe(InviteLinkState.USABLE);
      expect(panel.link?.id).not.toBe(link.id);
    });
  });

  describe(symbolName(replaceInvite), (): void => {
    it('revokes the named link and issues its replacement with the chosen options', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const panel: IInvitePanel = valueOf(
        await replaceInvite(leagueId, commissionerId, link.id, { expiresInDays: 30, maxUses: 4 }),
      );

      expect(panel.link).toMatchObject({
        expiresInDays: 30,
        maxUses: 4,
        state: InviteLinkState.USABLE,
        useCount: 0,
      });
      expect(panel.link?.token).not.toBe(link.token);
      expect((await readInvitation(link.id)).status).toBe('REVOKED');
    });

    it('refuses a stale replace without touching the current link', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const current: IInviteLink = valueOf(await replaceInvite(leagueId, commissionerId, link.id, WEEK_NO_LIMIT)).link!;

      // The first replace's request replayed after it committed
      expect(await replaceInvite(leagueId, commissionerId, link.id, WEEK_NO_LIMIT)).toEqual({
        ok: false,
        refusal: LeagueRefusal.STALE,
      });
      expect(valueOf(await readInvitePanel(leagueId, commissionerId)).link).toEqual(current);
    });

    it('refuses a player without retiring the link', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const playerId: string = await insertUser('Player');

      await insertMembership(leagueId, playerId);

      expect(await replaceInvite(leagueId, playerId, link.id, WEEK_NO_LIMIT)).toEqual({
        ok: false,
        refusal: LeagueRefusal.FORBIDDEN,
      });
      expect((await readInvitation(link.id)).status).toBe('PENDING');
    });
  });

  describe(symbolName(revokeInvite), (): void => {
    it('revokes the link, keeps memberships, and draws it without a token', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const joinerId: string = await insertUser('Joiner');

      await acceptInvite(link.token!, joinerId);

      const panel: IInvitePanel = valueOf(await revokeInvite(leagueId, commissionerId, link.id));

      expect(panel.link).toMatchObject({
        id: link.id,
        state: InviteLinkState.REVOKED,
        token: null,
      });
      expect((await readMembership(leagueId, joinerId))?.status).toBe('ACTIVE');
    });

    it('succeeds again on the exact revoked id without touching its successor', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);

      await revokeInvite(leagueId, commissionerId, link.id);

      const successor: IInviteLink = valueOf(
        await issueInvite(leagueId, commissionerId, { ...WEEK_NO_LIMIT, previousId: link.id }),
      ).link!;

      expect((await revokeInvite(leagueId, commissionerId, link.id)).ok).toBe(true);
      expect((await readInvitation(successor.id)).status).toBe('PENDING');
    });

    it("refuses an unknown id and another league's link as stale", async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const other: { commissionerId: string; leagueId: string } = await seedLeague('Elsewhere');
      const foreign: IInviteLink = await seedLink(other.leagueId, other.commissionerId);

      await revokeInvite(other.leagueId, other.commissionerId, foreign.id);

      expect(await revokeInvite(leagueId, commissionerId, UNKNOWN_LEAGUE_ID)).toEqual({
        ok: false,
        refusal: LeagueRefusal.STALE,
      });
      expect(await revokeInvite(leagueId, commissionerId, foreign.id)).toEqual({
        ok: false,
        refusal: LeagueRefusal.STALE,
      });
    });
  });

  describe(symbolName(lookupInvite), (): void => {
    it('shows a signed-out visitor exactly the summary allowlist', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);

      await insertMembership(leagueId, await insertUser('Player'));

      expect(await lookupInvite(link.token!, null)).toEqual({
        ok: true,
        value: {
          inviterName: 'Commissioner',
          kind: InviteLookupKind.INVITE,
          leagueName: 'Friday Ladder',
          memberCount: 2,
        },
      });
    });

    it('answers malformed, unknown, expired, revoked and exhausted tokens identically', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const unavailable: { ok: false; refusal: LeagueRefusal } = {
        ok: false,
        refusal: LeagueRefusal.INVITE_UNAVAILABLE,
      };
      const expired: IInviteLink = await seedLink(leagueId, commissionerId, 1);

      expect(await lookupInvite('short', null)).toEqual(unavailable);
      expect(await lookupInvite(UNKNOWN_TOKEN, null)).toEqual(unavailable);

      await expireInvitation(expired.id);
      expect(await lookupInvite(expired.token!, null)).toEqual(unavailable);

      const revoked: IInviteLink = valueOf(
        await issueInvite(leagueId, commissionerId, {
          expiresInDays: 7,
          maxUses: 1,
          previousId: expired.id,
        }),
      ).link!;

      await revokeInvite(leagueId, commissionerId, revoked.id);
      expect(await lookupInvite(revoked.token!, null)).toEqual(unavailable);

      const exhausted: IInviteLink = valueOf(
        await issueInvite(leagueId, commissionerId, {
          expiresInDays: 7,
          maxUses: 1,
          previousId: revoked.id,
        }),
      ).link!;

      await acceptInvite(exhausted.token!, await insertUser('Joiner'));
      expect(await lookupInvite(exhausted.token!, null)).toEqual(unavailable);
    });

    it('sends an active member home even through a revoked link', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const joinerId: string = await insertUser('Joiner');

      await acceptInvite(link.token!, joinerId);
      await revokeInvite(leagueId, commissionerId, link.id);

      expect(await lookupInvite(link.token!, joinerId)).toEqual({
        ok: true,
        value: { kind: InviteLookupKind.MEMBER, leagueId },
      });
    });

    it('refuses a removed member the summary of a usable link', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const removedId: string = await insertUser('Removed');

      await insertMembership(leagueId, removedId, 'PLAYER', 'REMOVED');

      expect(await lookupInvite(link.token!, removedId)).toEqual({
        ok: false,
        refusal: LeagueRefusal.INVITE_UNAVAILABLE,
      });
    });
  });

  describe(symbolName(acceptInvite), (): void => {
    it('joins a new player as an active player and spends one use', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId, 5);
      const joinerId: string = await insertUser('Joiner');

      expect(await acceptInvite(link.token!, joinerId)).toEqual({ ok: true, value: { leagueId } });
      expect(await readMembership(leagueId, joinerId)).toMatchObject({ role: 'PLAYER', status: 'ACTIVE' });
      expect((await readInvitation(link.id)).use_count).toBe(1);
    });

    it('answers a repeat with the same league and spends nothing', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId, 5);
      const joinerId: string = await insertUser('Joiner');

      await acceptInvite(link.token!, joinerId);

      expect(await acceptInvite(link.token!, joinerId)).toEqual({ ok: true, value: { leagueId } });
      expect((await readInvitation(link.id)).use_count).toBe(1);
    });

    it('reactivates an inactive former manager as a player, keeping the original join date', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const formerId: string = await insertUser('Former');

      await insertMembership(leagueId, formerId, 'MANAGER', 'INACTIVE');

      const before: { joined_at: Date } | undefined = await readMembership(leagueId, formerId);

      await acceptInvite(link.token!, formerId);

      expect(await readMembership(leagueId, formerId)).toEqual({
        joined_at: before!.joined_at,
        left_at: null,
        role: 'PLAYER',
        status: 'ACTIVE',
      });
    });

    it('refuses a removed member without any mutation', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);
      const removedId: string = await insertUser('Removed');

      await insertMembership(leagueId, removedId, 'PLAYER', 'REMOVED');

      expect(await acceptInvite(link.token!, removedId)).toEqual({
        ok: false,
        refusal: LeagueRefusal.INVITE_UNAVAILABLE,
      });
      expect((await readMembership(leagueId, removedId))?.status).toBe('REMOVED');
      expect((await readInvitation(link.id)).use_count).toBe(0);
    });

    it('admits one player on the last use and refuses the next', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId, 1);
      const secondId: string = await insertUser('Second');

      await acceptInvite(link.token!, await insertUser('First'));

      expect(await acceptInvite(link.token!, secondId)).toEqual({
        ok: false,
        refusal: LeagueRefusal.INVITE_UNAVAILABLE,
      });
      expect(await readMembership(leagueId, secondId)).toBeUndefined();
    });

    it('refuses an account still owing welcome without spending a use', async (): Promise<void> => {
      const { commissionerId, leagueId } = await seedLeague();
      const link: IInviteLink = await seedLink(leagueId, commissionerId);

      expect(await acceptInvite(link.token!, await insertUser('Fresh', { complete: false }))).toEqual({
        ok: false,
        refusal: LeagueRefusal.NEEDS_WELCOME,
      });
      expect((await readInvitation(link.id)).use_count).toBe(0);
    });
  });

  describe(symbolName(answerRefusal), (): void => {
    /**
     * Fabricates an event that records the status it is given.
     * @internal
     * @function
     * @returns The event and the status it recorded
     */
    function recordingEvent(): { event: H3Event; status: { code?: number } } {
      const status: { code?: number } = {};
      const event = {
        node: {
          res: {
            set statusCode(code: number) {
              status.code = code;
            },
          },
        },
      } as unknown as H3Event;

      return { event, status };
    }

    it('returns the same not-found body for a league and sets 404 rather than throwing', async (): Promise<void> => {
      const { event, status } = recordingEvent();

      expect(await answerRefusal(event, LeagueRefusal.LEAGUE_NOT_FOUND)).toEqual({
        message: 'Pongifi could not find that league.',
        statusCode: 404,
      });
      expect(status.code).toBe(404);
    });

    it('throws every other refusal with its status, clearing the session for a vanished account', async (): Promise<void> => {
      const { event } = recordingEvent();
      let thrown: H3Error | undefined;

      try {
        await answerRefusal(event, LeagueRefusal.ACCOUNT_MISSING);
      } catch (error: unknown) {
        thrown = error as H3Error;
      }

      expect(thrown?.statusCode).toBe(401);
      expect(clearUserSessionMock).toHaveBeenCalledWith(event);
      await expect(answerRefusal(event, LeagueRefusal.STALE)).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
