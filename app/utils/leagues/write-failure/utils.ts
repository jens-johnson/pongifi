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
 * ███████████████████████████████████████ #utils/leagues/write-failure/utils.ts ███████████████████████████████████████
 *
 * Classifies a failed league-entry write as a definite refusal or an uncertain outcome.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

import { WriteFailure } from './enums';

/**
 * The first status that means the server, or something in front of it, failed rather than refused.
 * @internal
 * @constant
 */
const FIRST_SERVER_ERROR_STATUS: number = 500;

/**
 * The statuses with a meaning of their own; every other 4xx is a plain refusal.
 * @internal
 * @constant
 */
const FAILURE_BY_STATUS: Readonly<Record<number, WriteFailure>> = {
  /* The session ended */
  401: WriteFailure.UNAUTHORIZED,

  /* The role or the welcome step is missing */
  403: WriteFailure.FORBIDDEN,

  /* Not available to this account */
  404: WriteFailure.NOT_FOUND,

  /* State already moved on */
  409: WriteFailure.CONFLICT,

  /* Too many writes */
  429: WriteFailure.RATE_LIMITED,
};

/**
 * Reads the HTTP status off whatever `$fetch` rejected with.
 * @internal
 * @function
 * @param error - The rejection
 * @returns The status, or null when the request never got an answer
 */
function readStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { response, statusCode }: { response?: { status?: unknown }; statusCode?: unknown } = error;
  const status: unknown = statusCode ?? response?.status;

  return typeof status === 'number' && status > 0 ? status : null;
}

/**
 * Classifies a failed league-entry write so the page knows whether anything could have been written.
 *
 * A request that never got an answer, and a 5xx, are uncertain: the write may have committed before the answer was
 * lost. Every 4xx is definite, and the ones a page treats differently are named
 * @public
 * @function
 * @param error - What `$fetch` rejected with
 * @returns How to read the failure
 */
export function classifyWriteFailure(error: unknown): WriteFailure {
  const status: number | null = readStatus(error);

  if (status === null || status >= FIRST_SERVER_ERROR_STATUS) {
    return WriteFailure.UNCERTAIN;
  }

  return FAILURE_BY_STATUS[status] ?? WriteFailure.REFUSED;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(classifyWriteFailure, {
  name: 'Classify Write Failure',
  description: 'Classifies a failed league-entry write as a definite refusal or an uncertain outcome.',
});
