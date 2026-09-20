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
 * ████████████████████████████████████████ scripts/spike/result-entry/types.ts ████████████████████████████████████████
 *
 * What one spike check is, and what running it observed.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * One thing the spike set out to prove, and what running it observed
 * @public
 */
export interface IScenarioResult {
  /* What was observed, in enough detail to argue with */
  detail: string;

  /* Whether the observation matched what the contract requires */
  passed: boolean;
}

/**
 * A named check the harness can run
 * @public
 */
export interface IScenario {
  /* Which work package of the handoff it answers */
  package: string;

  /* What it proves */
  name: string;

  /**
   * Runs it against a disposable database
   * @param connectionString - The disposable database
   * @returns What was observed
   */
  run: (connectionString: string) => Promise<IScenarioResult>;
}

/**
 * The handoff's work packages, named once so a check says which one it answers without repeating the words
 * @public
 * @constant
 */
export const PACKAGES = {
  BUDGET: '6. Runtime budget',
  CONCURRENCY: '3. Concurrency and recovery',
  PRIVACY: '5. Privacy',
  RATINGS: '4. Ratings and reads',
  SCHEMA: '1. Schema and reconstruction',
  TRANSACTION: '2. Real transaction path',
} as const;
