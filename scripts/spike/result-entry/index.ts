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
 * ████████████████████████████████████████ scripts/spike/result-entry/index.ts ████████████████████████████████████████
 *
 * Runs the result-entry persistence spike and prints what it observed.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { useLocalProxy } from './harness';
import { BUDGET_SCENARIOS } from './scenarios-budget';
import { PRIVACY_SCENARIOS } from './scenarios-privacy';
import { RATING_SCENARIOS } from './scenarios-ratings';
import { SCHEMA_SCENARIOS } from './scenarios-schema';
import { CONCURRENCY_SCENARIOS, TRANSACTION_SCENARIOS } from './scenarios-transaction';
import type { IScenario, IScenarioResult } from './types';

/**
 * Every check the spike runs, in the order of the handoff's work packages
 * @internal
 * @constant
 */
const SCENARIOS: readonly IScenario[] = [
  ...SCHEMA_SCENARIOS,
  ...TRANSACTION_SCENARIOS,
  ...CONCURRENCY_SCENARIOS,
  ...RATING_SCENARIOS,
  ...PRIVACY_SCENARIOS,
  ...BUDGET_SCENARIOS,
];

/**
 * Whether a failure is the WebSocket giving up rather than the scenario disagreeing with the contract.
 *
 * Docker Desktop on this machine exits on its own between runs, which takes the database with it. That is a fact
 * about the laptop, not about the code under test, so the runner brings the stack back and runs the scenario again
 * rather than recording a result nobody should trust either way
 * @internal
 * @function
 * @param error - What was thrown
 * @returns Whether the transport, rather than the scenario, is what failed
 */
function isTransportFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    // The driver rejects with a DOM-style ErrorEvent when the socket never opened; it is not an Error at all
    return true;
  }

  return ['ECONNREFUSED', 'terminated', 'socket', 'Connection terminated'].some((mark: string): boolean =>
    error.message.includes(mark),
  );
}

/**
 * Brings the disposable stack back up
 * @internal
 * @async
 * @function
 */
async function restartStack(): Promise<void> {
  await promisify(execFile)(fileURLToPath(new URL('stack.sh', import.meta.url)));
}

/**
 * Describes whatever a scenario threw, including the event a failed WebSocket rejects with, which carries its reason
 * somewhere other than a message
 * @internal
 * @function
 * @param error - What was thrown
 * @returns A line worth printing
 */
function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  const event = error as { error?: { message?: string }; message?: string; type?: string };
  const described: string = event?.error?.message ?? event?.message ?? '';

  return described === '' ? `the ${event?.type ?? 'unknown'} event the socket rejected with` : described;
}

/**
 * Runs one check, bringing the stack back and trying again when the socket, rather than the scenario, is what failed
 * @internal
 * @async
 * @function
 * @param scenario - The check to run
 * @param connectionString - The disposable database
 * @returns The line to print, and whether the check passed
 */
async function runScenario(scenario: IScenario, connectionString: string): Promise<{ line: string; passed: boolean }> {
  const started: number = performance.now();

  try {
    let result: IScenarioResult;

    try {
      result = await scenario.run(connectionString);
    } catch (error: unknown) {
      if (!isTransportFailure(error)) {
        throw error;
      }

      await restartStack();
      result = await scenario.run(connectionString);
    }

    const elapsed: string = (performance.now() - started).toFixed(0);

    return {
      line: `  ${result.passed ? 'PASS' : 'FAIL'}  ${scenario.name}\n        ${result.detail} (${elapsed}ms)`,
      passed: result.passed,
    };
  } catch (error: unknown) {
    return { line: `  ERROR ${scenario.name}\n        ${describeFailure(error)}`, passed: false };
  }
}

/**
 * Runs the spike against a disposable database and prints what was observed.
 *
 * The target comes from `SPIKE_DATABASE_URL`, and the WebSocket proxy in front of it from `SPIKE_WS_PROXY`. Nothing
 * defaults: a harness that rebuilt the public schema of whatever happened to be configured would be one mistake away
 * from a deployed database
 * @internal
 * @async
 * @function
 */
async function main(): Promise<void> {
  const connectionString: string | undefined = process.env.SPIKE_DATABASE_URL;
  const proxy: string | undefined = process.env.SPIKE_WS_PROXY;

  if (!connectionString) {
    throw new Error('SPIKE_DATABASE_URL is not set; the spike refuses to guess which database it may rebuild.');
  }

  if (proxy) {
    useLocalProxy(proxy);
  }

  await restartStack();

  let failures: number = 0;
  let currentPackage: string = '';

  for (const scenario of SCENARIOS) {
    if (scenario.package !== currentPackage) {
      currentPackage = scenario.package;
      process.stdout.write(`\n${currentPackage}\n`);
    }

    const { line, passed } = await runScenario(scenario, connectionString);

    failures += passed ? 0 : 1;
    process.stdout.write(`${line}\n`);
  }

  process.stdout.write(`\n${SCENARIOS.length - failures}/${SCENARIOS.length} checks passed\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

try {
  await main();
} catch (error: unknown) {
  // The driver can reject with something that is not an Error at all; printing it raw is pages of socket internals
  process.stdout.write(`the spike could not run: ${describeFailure(error)}\n`);
  process.exitCode = 1;
}
