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
import { DatabaseError } from '@neondatabase/serverless';
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

  /* What a given statement fails with instead of answering, by its exact text; it is still sent first */
  failures: Record<string, Error>;

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
vi.mock('@neondatabase/serverless', async (importActual): Promise<Record<string, unknown>> => {
  /**
   * A connection whose every statement answers after a delay this case chose.
   *
   * Its `release` is the driver's, not a recorder's: Neon's pool wraps every client it lends out in a release-once
   * guard and throws on a second call, so a helper that hands the same connection back twice must fail a case here
   * rather than quietly look like a helper that hands it back once
   * @internal
   */
  class FakeClient {
    /* Whether this connection has already gone back to the pool */
    private handedBack: boolean = false;

    /**
     * Binds the connection to the transport of the case that dialled it
     * @param owner - That transport
     */
    public constructor(private readonly owner: IFakeTransport) {}

    /**
     * Answers a statement after whatever delay this case gave it, or fails the way this case said it does
     * @param text - The statement
     * @throws Whatever this case gave that statement to fail with, after it has been sent
     * @returns An empty result
     */
    public async query(text: string): Promise<{ rowCount: number; rows: unknown[] }> {
      this.owner.sent.push(text);

      await pause(this.owner.delays[text] ?? 0);

      const failure: Error | undefined = this.owner.failures[text];

      if (failure !== undefined) {
        throw failure;
      }

      return {
        rowCount: 0,
        rows: [],
      };
    }

    /**
     * Records how the connection was handed back, and refuses to be handed back twice
     * @param reason - The error it was destroyed with, if it was
     * @throws The driver's own refusal when the connection has already been released
     */
    public release(reason?: Error): void {
      if (this.handedBack) {
        throw new Error('Release called on client which has already been released to the pool.');
      }

      this.handedBack = true;
      this.owner.released.push(reason);
    }
  }

  /**
   * A pool whose dialling and closing take as long as this case says they do
   * @internal
   */
  class FakePool {
    /**
     * The transport of the case that built this pool, held rather than read later: a dial the budget already refused
     * still arrives, and the connection it hands to the abandonment path must be recorded against the case that asked
     * for it rather than against whichever case happens to be running by the time it lands
     */
    private readonly owner: IFakeTransport = transport;

    /**
     * Dials the database after whatever delay this case gave it
     * @returns The connection
     */
    public async connect(): Promise<FakeClient> {
      await pause(this.owner.connectMs);

      return new FakeClient(this.owner);
    }

    /**
     * Closes the pool, or never answers when this case says so
     */
    public async end(): Promise<void> {
      if (this.owner.endHangs) {
        return new Promise<void>((): void => undefined);
      }

      this.owner.ended = true;
    }
  }

  // Everything but the pool stays real, because the helper reads `DatabaseError` to tell a commit the database refused
  // from one whose answer never arrived, and a stubbed class would make that distinction true by construction
  return {
    ...(await importActual<Record<string, unknown>>()),
    Pool: FakePool,
  };
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
 * Builds the error the driver raises when the database itself answered a statement with a refusal.
 *
 * Severity is the parameter because it is the whole distinction under test: `ERROR` is a statement the server
 * rejected and a transaction it has already ended, while `FATAL` is the session going away with whatever was
 * outstanding still outstanding
 * @internal
 * @function
 * @param severity - The severity the server reported
 * @returns The refusal
 */
function serverRefusal(severity: string): DatabaseError {
  const refusal: DatabaseError = new DatabaseError('could not serialize access due to concurrent update', 100, 'error');

  refusal.severity = severity;
  refusal.code = '40001';

  return refusal;
}

/**
 * Spends time without yielding, so the deadline passes while no timer can fire.
 *
 * A body that awaits gives the step's own expiry a chance to reject it; a body that computes does not, and what is
 * left holding the operation to its budget is the check made before the next step is begun. That is the path these
 * cases reach, and no asynchronous delay reaches it
 * @internal
 * @function
 * @param milliseconds - How long to spend
 * @returns How many turns it took, so the work cannot be optimised away
 */
function spin(milliseconds: number): number {
  const until: number = Date.now() + milliseconds;
  let turns: number = 0;

  while (Date.now() < until) {
    turns += 1;
  }

  return turns;
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
      failures: {},
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
      // Destroyed with the answer the caller was given, from the single place that hands a connection back
      expect(transport.released).toEqual([expect.any(TransactionOutcomeUnknownError)]);
    });

    it('reports a commit whose connection died as an unknown outcome rather than a failure', async (): Promise<void> => {
      const lost: Error = new Error('Connection terminated unexpectedly');

      transport.failures['COMMIT'] = lost;

      const { outcome } = await run(async (): Promise<string> => 'recorded');

      // The finding this case exists for: only a budget expiry used to be read as uncertainty, so a socket that died
      // with the commit outstanding was reported as a plain failure. Nothing here knows whether it committed
      expect(outcome).toBeInstanceOf(TransactionOutcomeUnknownError);
      expect((outcome as Error).cause).toBe(lost);
      expect(transport.sent).toContain('COMMIT');
      // A rollback sent afterwards cannot establish that the commit nobody answered did not happen
      expect(transport.sent).not.toContain('ROLLBACK');
      expect(transport.released).toEqual([expect.any(TransactionOutcomeUnknownError)]);
    });

    it('reports a commit the database itself refused as the failure it is', async (): Promise<void> => {
      const refused: DatabaseError = serverRefusal('ERROR');

      transport.failures['COMMIT'] = refused;

      const { outcome } = await run(async (): Promise<string> => 'recorded');

      // The other half of the distinction: the server composed this answer and ended the transaction writing it, so
      // calling it unknown would send the caller looking for a receipt that certainly does not exist
      expect(outcome).toBe(refused);
      expect(outcome).not.toBeInstanceOf(TransactionOutcomeUnknownError);
      expect(transport.sent).toContain('ROLLBACK');
      expect(transport.released).toEqual([undefined]);
    });

    it('reports a commit the session died under as unknown, however the database announced it', async (): Promise<void> => {
      const fatal: DatabaseError = serverRefusal('FATAL');

      transport.failures['COMMIT'] = fatal;

      const { outcome } = await run(async (): Promise<string> => 'recorded');

      // A message from the server is not the same as an answer to the commit: a session ending underneath one says
      // this end stopped hearing, which is the uncertainty rather than the refusal
      expect(outcome).toBeInstanceOf(TransactionOutcomeUnknownError);
      expect((outcome as Error).cause).toBe(fatal);
      expect(transport.released).toEqual([expect.any(TransactionOutcomeUnknownError)]);
    });

    it('refuses a commit the deadline passed before it was sent, and hands the connection back once', async (): Promise<void> => {
      const { outcome } = await run(async (): Promise<number> => spin(SLOW_MS));

      // Two findings meet here. A body that crosses the deadline without ever awaiting cannot be refused by the
      // step's own expiry, so it arrives at the commit with the budget already gone: the commit is never sent, which
      // is knowledge, and the connection goes back exactly once — the fake refuses a second release the way the
      // driver's pool does, so the branch that used to release and then let the catch release again fails here
      expect(outcome).toBeInstanceOf(TransactionBudgetError);
      expect(outcome).not.toBeInstanceOf(TransactionOutcomeUnknownError);
      expect(transport.sent).not.toContain('COMMIT');
      expect(transport.released).toEqual([expect.any(TransactionBudgetError)]);
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
