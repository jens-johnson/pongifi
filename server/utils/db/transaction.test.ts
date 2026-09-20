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
 * ███████████████████████████████████████ #server/utils/db/transaction.test.ts ████████████████████████████████████████
 *
 * Unit tests for the whole-operation budget, against a transport whose every step can be delayed.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the fake transport is doing this case: how long each step takes, and what it has been asked to do so far
 * @internal
 */
interface IFakeTransport {
  /* How long dialling the database takes */
  connectMs: number;

  /* How long a given statement takes to answer, by its exact text */
  delays: Record<string, number>;

  /* Whether closing the pool never answers */
  endHangs: boolean;

  /* Whether the pool was closed */
  ended: boolean;

  /* Every reason the connection was handed back with, `undefined` for a clean release */
  released: (Error | undefined)[];

  /* Every statement that was actually sent, in order */
  sent: string[];
}

/**
 * The transport the case under test runs against, replaced before each one
 * @internal
 */
let transport: IFakeTransport;

/**
 * Waits, so a step of the operation can be made to take a controlled amount of time
 * @internal
 * @function
 * @param milliseconds - How long to wait
 * @returns A promise that settles then
 */
async function pause(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, milliseconds);
  });
}

// A synthetic transport rather than a database: what these cases are about is where the clock starts and stops, which
// no real connection can be made to demonstrate on demand. The concurrency and rollback behaviour is proven against
// PostgreSQL elsewhere
vi.mock('@neondatabase/serverless', (): Record<string, unknown> => {
  /**
   * A connection whose every statement answers after a delay this case chose
   * @internal
   */
  class FakeClient {
    /**
     * Answers a statement after whatever delay this case gave it
     * @param text - The statement
     * @returns An empty result
     */
    public async query(text: string): Promise<{ rowCount: number; rows: unknown[] }> {
      transport.sent.push(text);

      await pause(transport.delays[text] ?? 0);

      return {
        rowCount: 0,
        rows: [],
      };
    }

    /**
     * Records how the connection was handed back
     * @param reason - The error it was destroyed with, if it was
     */
    public release(reason?: Error): void {
      transport.released.push(reason);
    }
  }

  /**
   * A pool whose dialling and closing take as long as this case says they do
   * @internal
   */
  class FakePool {
    /**
     * Dials the database after whatever delay this case gave it
     * @returns The connection
     */
    public async connect(): Promise<FakeClient> {
      await pause(transport.connectMs);

      return new FakeClient();
    }

    /**
     * Closes the pool, or never answers when this case says so
     */
    public async end(): Promise<void> {
      if (transport.endHangs) {
        return new Promise<void>((): void => undefined);
      }

      transport.ended = true;
    }
  }

  return { Pool: FakePool };
});

const { TransactionBudgetError, TransactionOutcomeUnknownError, withInteractiveTransaction } =
  await import('./transaction');

/**
 * Runs one transaction against the fake transport under a tight budget
 * @internal
 * @function
 * @param body - What to run inside it
 * @param operationTimeoutMs - The budget
 * @returns How long the call took and how it settled
 */
async function run<TResult>(
  body: (transaction: { query: (text: string) => Promise<unknown> }) => Promise<TResult>,
  operationTimeoutMs: number = BUDGET_MS,
): Promise<{ elapsed: number; outcome: TResult | Error }> {
  const started: number = Date.now();

  try {
    const value: TResult = await withInteractiveTransaction(body, {
      connectionString: 'postgres://nowhere/none',
      limits: {
        cleanupTimeoutMs: CLEANUP_MS,
        operationTimeoutMs,
      },
    });

    return {
      elapsed: Date.now() - started,
      outcome: value,
    };
  } catch (error: unknown) {
    return {
      elapsed: Date.now() - started,
      outcome: error as Error,
    };
  }
}

/**
 * What a body throws when the operation itself is refused, rather than the budget refusing it
 * @internal
 * @constant
 */
const BODY_FAILURE: string = 'the seat is not a member';

/**
 * The budget every case runs under, short enough that a delayed step is unambiguously outside it
 * @internal
 * @constant
 */
const BUDGET_MS: number = 40;

/**
 * How long cleanup is given, short enough that a pool which never closes is still not a hang
 * @internal
 * @constant
 */
const CLEANUP_MS: number = 50;

/**
 * A delay no case's budget can absorb
 * @internal
 * @constant
 */
const SLOW_MS: number = 300;

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach((): void => {
    transport = {
      connectMs: 0,
      delays: {},
      endHangs: false,
      ended: false,
      released: [],
      sent: [],
    };
  });

  describe(symbolName(withInteractiveTransaction), (): void => {
    it('returns what the body returned and commits it', async (): Promise<void> => {
      const { outcome } = await run(async (): Promise<string> => 'recorded');

      expect(outcome).toBe('recorded');
      expect(transport.sent).toContain('COMMIT');
      expect(transport.released).toEqual([undefined]);
    });

    it('refuses an operation that spends its whole budget dialling the database', async (): Promise<void> => {
      transport.connectMs = SLOW_MS;

      let ran: boolean = false;
      const { elapsed, outcome } = await run(async (): Promise<string> => {
        ran = true;

        return 'recorded';
      });

      // The finding this case exists for: the budget used to start after the connection was in hand, so the whole of
      // a slow dial was time nobody counted and the call succeeded well outside its stated bound
      expect(outcome).toBeInstanceOf(TransactionBudgetError);
      expect(elapsed).toBeLessThan(SLOW_MS);
      expect(ran).toBe(false);
    });

    it('refuses an operation that spends its budget opening the transaction', async (): Promise<void> => {
      transport.delays['BEGIN'] = SLOW_MS;

      let ran: boolean = false;
      const { elapsed, outcome } = await run(async (): Promise<string> => {
        ran = true;

        return 'recorded';
      });

      expect(outcome).toBeInstanceOf(TransactionBudgetError);
      expect(elapsed).toBeLessThan(SLOW_MS);
      expect(ran).toBe(false);
      expect(transport.sent).not.toContain('COMMIT');
    });

    it('refuses an operation whose body outruns the budget, and destroys the connection', async (): Promise<void> => {
      transport.delays['SELECT slow'] = SLOW_MS;

      const { outcome } = await run(async (transaction): Promise<unknown> => transaction.query('SELECT slow'));

      expect(outcome).toBeInstanceOf(TransactionBudgetError);
      // A ROLLBACK would queue behind the statement the budget just refused to wait for
      expect(transport.sent).not.toContain('ROLLBACK');
      expect(transport.released[0]).toBeInstanceOf(TransactionBudgetError);
    });

    it('never sends a statement the deadline has already passed for', async (): Promise<void> => {
      transport.delays['SELECT slow'] = SLOW_MS;

      const { outcome } = await run(async (transaction): Promise<string> => {
        await transaction.query('SELECT slow').catch((): void => undefined);
        await transaction.query('SELECT after');

        return 'recorded';
      });

      expect(outcome).toBeInstanceOf(TransactionBudgetError);
      expect(transport.sent).toContain('SELECT slow');
      expect(transport.sent).not.toContain('SELECT after');
    });

    it('does not send a commit it has no budget left to send', async (): Promise<void> => {
      const { outcome } = await run(async (): Promise<string> => {
        await pause(SLOW_MS);

        return 'recorded';
      });

      // Known, not unknown: a commit that was never sent is a transaction the server rolls back when this connection
      // dies, and telling the caller otherwise would send them looking for a receipt that cannot exist
      expect(outcome).toBeInstanceOf(TransactionBudgetError);
      expect(outcome).not.toBeInstanceOf(TransactionOutcomeUnknownError);
      expect(transport.sent).not.toContain('COMMIT');
    });

    it('reports a commit that outran the budget as an unknown outcome rather than a failure', async (): Promise<void> => {
      transport.delays['COMMIT'] = SLOW_MS;

      const { elapsed, outcome } = await run(async (): Promise<string> => 'recorded');

      // The other finding this case exists for: the timer used to be cleared before the commit, so a commit that took
      // longer than the whole budget was reported as a plain success
      expect(outcome).toBeInstanceOf(TransactionOutcomeUnknownError);
      expect(elapsed).toBeLessThan(SLOW_MS);
      expect(transport.sent).toContain('COMMIT');
      expect(transport.released[0]).toBeInstanceOf(TransactionBudgetError);
    });

    it('rolls back and reports the body’s own failure rather than the budget', async (): Promise<void> => {
      const { outcome } = await run(async (): Promise<never> => {
        throw new Error(BODY_FAILURE);
      });

      expect((outcome as Error).message).toBe(BODY_FAILURE);
      expect(transport.sent).toContain('ROLLBACK');
      expect(transport.released).toEqual([undefined]);
    });

    it('destroys a connection whose rollback outran the cleanup bound', async (): Promise<void> => {
      transport.delays['ROLLBACK'] = SLOW_MS;

      const { elapsed, outcome } = await run(async (): Promise<never> => {
        throw new Error(BODY_FAILURE);
      });

      expect((outcome as Error).message).toBe(BODY_FAILURE);
      expect(elapsed).toBeLessThan(SLOW_MS);
      expect(transport.released[0]).toBeInstanceOf(Error);
    });

    it('answers even when closing the pool never does', async (): Promise<void> => {
      transport.endHangs = true;

      const { elapsed, outcome } = await run(async (): Promise<string> => 'recorded');

      expect(outcome).toBe('recorded');
      expect(elapsed).toBeLessThan(SLOW_MS);
      expect(transport.ended).toBe(false);
    });
  });
});
