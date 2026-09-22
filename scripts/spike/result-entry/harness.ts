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
 * ███████████████████████████████████████ scripts/spike/result-entry/harness.ts ███████████████████████████████████████
 *
 * Disposable database, migrations and fixtures for the result-entry persistence spike.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { neonConfig, Pool } from '@neondatabase/serverless';

import { GameCreator, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import { GameType } from '#shared/rules-engine';

/**
 * Where the checked-in migrations live, relative to this file
 * @internal
 * @constant
 */
const MIGRATIONS: URL = new URL('../../../server/db/migrations/', import.meta.url);

/**
 * How many milliseconds are in an hour, which is the unit every window in a league's settings is stated in
 * @public
 * @constant
 */
export const HOUR_MS: number = 60 * 60 * 1000;

/**
 * The league every fixture is built in
 * @public
 * @constant
 */
export const LEAGUE_ID: string = '11111111-1111-1111-1111-111111111111';

/**
 * A league's settings, varied per fixture
 * @public
 * @function
 * @param overrides - What this fixture changes
 * @returns The settings
 */
export function settingsFixture(overrides: Partial<TLeagueSettings> = {}): TLeagueSettings {
  return {
    allowedGameTypes: [GameType.SINGLES, GameType.DOUBLES],
    cutthroatTimeCap: 0,
    expediteEnabled: false,
    matchFormat: 1,
    provisionalGames: 5,
    ratingEnabled: true,
    requireConfirmation: true,
    resultAmendmentWindow: 48,
    resultConfirmationWindow: 24,
    serviceInterval: 2,
    targetScore: {
      [GameType.CUTTHROAT]: 15,
      [GameType.DOUBLES]: 11,
      [GameType.SINGLES]: 11,
    },
    walkoverGracePeriod: 15,
    whoCanCreateGames: GameCreator.PLAYER,
    whoCanRecordResults: ResultRecorder.PARTICIPANTS,
    winningMargin: 2,
    ...overrides,
  };
}

/**
 * Points the Neon serverless driver at a WebSocket proxy in front of an ordinary PostgreSQL server.
 *
 * The driver, its wire protocol and its pooling are the deployed ones; only the endpoint differs, which is what makes
 * this a transport proof rather than a mock. What it cannot stand in for is Neon's own network: latency, connection
 * limits and pooler behaviour on the hosted service are not measured here
 * @public
 * @function
 * @param proxy - The proxy's host and port, as `host:port`
 */
export function useLocalProxy(proxy: string): void {
  neonConfig.wsProxy = (host: string, port: number | string): string => `${proxy}/v1?address=${host}:${port}`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

/**
 * Drops and rebuilds the public schema, then applies every checked-in migration in journal order.
 *
 * Destructive by design, and nothing here can tell a disposable target from a deployed one. The runners refuse an
 * unset `SPIKE_DATABASE_URL` so that no database is rebuilt by default, which is the whole of the protection: a URL
 * that is set is a URL this drops. Point it at a fixture whose disposability you have checked yourself — never at
 * the database anything else is reading, a preview's included
 * @public
 * @async
 * @function
 * @param connectionString - The disposable database, verified as such by whoever supplied it
 */
export async function resetDatabase(connectionString: string): Promise<void> {
  const pool: Pool = new Pool({ connectionString });

  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');

    const files: string[] = (await readdir(fileURLToPath(MIGRATIONS)))
      .filter((name: string): boolean => name.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql: string = await readFile(fileURLToPath(new URL(file, MIGRATIONS)), 'utf8');

      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim().length > 0) {
          await pool.query(statement);
        }
      }
    }
  } finally {
    await pool.end();
  }
}

/**
 * Inserts a league with the given settings and a roster of active members
 * @public
 * @async
 * @function
 * @param connectionString - The disposable database
 * @param names - The display names to seat, in order
 * @param settings - The league's settings
 * @returns The account ids, keyed by display name, and the first one's id as the commissioner
 */
export async function seedLeague(
  connectionString: string,
  names: string[],
  settings: TLeagueSettings = settingsFixture(),
): Promise<Record<string, string>> {
  const pool: Pool = new Pool({ connectionString });

  try {
    const ids: Record<string, string> = {};

    for (const name of names) {
      const { rows } = await pool.query<{ id: string }>(
        'INSERT INTO "users" ("email", "display_name") VALUES ($1, $2) RETURNING "id"',
        [`${name.toLowerCase()}@example.com`, name],
      );

      ids[name] = rows[0]!.id;
    }

    const [first] = names;

    await pool.query(
      `INSERT INTO "leagues" ("id", "name", "abbreviation", "settings", "created_by")
       VALUES ($1, 'Spike League', 'SPK', $2, $3)`,
      [LEAGUE_ID, JSON.stringify(settings), ids[first!]],
    );

    for (const [index, name] of names.entries()) {
      await pool.query(
        `INSERT INTO "memberships" ("league_id", "user_id", "role", "status")
         VALUES ($1, $2, $3, 'ACTIVE')`,
        [LEAGUE_ID, ids[name]!, index === 0 ? 'COMMISSIONER' : 'PLAYER'],
      );
    }

    return ids;
  } finally {
    await pool.end();
  }
}

/**
 * Reads one scalar back from the database, for an assertion that does not need a transaction
 * @public
 * @async
 * @function
 * @param connectionString - The disposable database
 * @param text - The statement
 * @param values - The values to bind
 * @returns The rows
 */
export async function read<TRow extends Record<string, unknown>>(
  connectionString: string,
  text: string,
  values: unknown[] = [],
): Promise<TRow[]> {
  const pool: Pool = new Pool({ connectionString });

  try {
    const { rows } = await pool.query<TRow>(text, values);

    return rows;
  } finally {
    await pool.end();
  }
}
