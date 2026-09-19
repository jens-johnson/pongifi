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
 * ███████████████████████████████████████████ #server/api/stats.get.test.ts ███████████████████████████████████████████
 *
 * Persistence tests for the public statistics endpoint.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { EventHandler } from 'h3';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationStatus, GameStatus } from '#shared/domain';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import { GameType } from '#shared/rules-engine';

import type { IPublicStats } from './stats.get';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The database handle swapped for a fresh Postgres before each case.
 * @internal
 * @constant
 */
const databaseRef = vi.hoisted((): { current: unknown } => ({ current: undefined }));

/**
 * The cache doubles, hoisted so the module mock can consume them.
 * @internal
 * @constant
 */
const cacheMocks = vi.hoisted(
  (): {
    get: Mock<(key: string) => Promise<IPublicStats | null>>;
    set: Mock<(key: string, value: IPublicStats, options: { ex: number }) => Promise<void>>;
  } => ({
    get: vi.fn(),
    set: vi.fn(),
  }),
);

vi.mock('#utils/db', (): Record<string, unknown> => ({ useDatabase: (): unknown => databaseRef.current }));
vi.mock('#utils/cache', (): Record<string, unknown> => ({ useCache: (): unknown => cacheMocks }));
vi.stubGlobal(
  'defineEventHandler',
  vi.fn((handler: EventHandler): EventHandler => handler),
);

/**
 * The checked-in migrations applied to each isolated database.
 * @internal
 * @constant
 */
const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../db/migrations', import.meta.url));

/**
 * The handler under test, imported after its globals and module mocks are ready.
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./stats.get');

/**
 * The PGlite instance closed after each case.
 * @internal
 */
let client: PGlite;

/**
 * The database under test.
 * @internal
 */
let database: ReturnType<typeof drizzle>;

/**
 * Inserts a user and returns their identifier.
 * @internal
 * @function
 * @param email - The account address
 * @returns The new account identifier
 */
async function insertUser(email: string): Promise<string> {
  const { rows } = await database.execute<{ id: string }>(
    sql`INSERT INTO "users" ("email", "display_name") VALUES (${email}, 'Player') RETURNING "id"`,
  );

  return rows[0]!.id;
}

/**
 * Inserts a league and returns its identifier.
 * @internal
 * @function
 * @param creatorId - The account creating the league
 * @param name - The league name
 * @returns The new league identifier
 */
async function insertLeague(creatorId: string, name: string): Promise<string> {
  const { rows } = await database.execute<{ id: string }>(
    sql`INSERT INTO "leagues" ("name", "abbreviation", "settings", "created_by")
        VALUES (${name}, ${name.slice(0, 3)}, ${JSON.stringify(STANDARD_LEAGUE_SETTINGS)}::jsonb, ${creatorId})
        RETURNING "id"`,
  );

  return rows[0]!.id;
}

/**
 * Inserts a game with two scored participants.
 * @internal
 * @function
 * @param leagueId - The league receiving the game
 * @param creatorId - The account creating the game
 * @param status - The lifecycle status
 * @param confirmationStatus - The confirmation status
 * @param endedAt - When the game ended
 * @param durationMs - The duration in milliseconds
 * @param scores - The two final scores
 */
async function insertGame(
  leagueId: string,
  creatorId: string,
  status: GameStatus,
  confirmationStatus: ConfirmationStatus,
  endedAt: Date,
  durationMs: number,
  scores: readonly [number, number],
): Promise<void> {
  const { rows } = await database.execute<{ id: string }>(
    sql`INSERT INTO "games" (
          "league_id", "type", "status", "confirmation_status", "settings_snapshot", "created_by", "ended_at",
          "duration_ms"
        )
        VALUES (
          ${leagueId}, ${GameType.SINGLES}, ${status}, ${confirmationStatus}, '{}'::jsonb, ${creatorId}, ${endedAt},
          ${durationMs}
        )
        RETURNING "id"`,
  );

  await database.execute(
    sql`INSERT INTO "game_participants" ("game_id", "guest_name", "final_score")
        VALUES (${rows[0]!.id}, 'First', ${scores[0]}), (${rows[0]!.id}, 'Second', ${scores[1]})`,
  );
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach(async (): Promise<void> => {
    client = new PGlite();
    database = drizzle(client);
    databaseRef.current = database;
    cacheMocks.get.mockReset().mockResolvedValue(null);
    cacheMocks.set.mockReset().mockResolvedValue();

    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  afterEach(async (): Promise<void> => {
    await client.close();
  });

  it('counts only confirmed completions across all four public figures and writes the v2 cache key', async (): Promise<void> => {
    const creatorId: string = await insertUser('stats@example.com');
    const activeLeagueId: string = await insertLeague(creatorId, 'Active League');
    const oldLeagueId: string = await insertLeague(creatorId, 'Old League');
    const recent: Date = new Date();
    const old: Date = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    await insertGame(
      activeLeagueId,
      creatorId,
      GameStatus.COMPLETE,
      ConfirmationStatus.CONFIRMED,
      recent,
      120_000,
      [11, 6],
    );
    await insertGame(
      activeLeagueId,
      creatorId,
      GameStatus.COMPLETE,
      ConfirmationStatus.CONFIRMED,
      recent,
      60_000,
      [11, 9],
    );
    await insertGame(oldLeagueId, creatorId, GameStatus.COMPLETE, ConfirmationStatus.CONFIRMED, old, 60_000, [11, 8]);
    await insertGame(
      oldLeagueId,
      creatorId,
      GameStatus.COMPLETE,
      ConfirmationStatus.UNCONFIRMED,
      recent,
      600_000,
      [21, 19],
    );
    await insertGame(
      oldLeagueId,
      creatorId,
      GameStatus.COMPLETE,
      ConfirmationStatus.DISPUTED,
      recent,
      600_000,
      [21, 19],
    );
    await insertGame(oldLeagueId, creatorId, GameStatus.RETIRED, ConfirmationStatus.CONFIRMED, recent, 600_000, [5, 3]);

    const stats: IPublicStats = (await handler({} as never)) as IPublicStats;

    expect(stats).toMatchObject({
      available: true,
      gamesRecorded: 3,
      leaguesActiveThisWeek: 1,
      minutesLogged: 4,
      pointsScored: 56,
    });
    expect(cacheMocks.set).toHaveBeenCalledWith('stats:public:v2', stats, { ex: 60 });
  });
});
