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
 * ████████████████████████████████████████████ #server/utils/http/utils.ts ████████████████████████████████████████████
 *
 * Shared HTTP helpers for server handlers: the upstream guard translating unexpected external-call failures into 502s.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createError, isError } from 'h3';

import { defineSymbol } from '#shared/utils/symbol';

/**
 * Awaits an upstream operation (an external service call or storage I/O), translating an unexpected rejection into a
 * 502 with the given message while letting deliberate H3 errors (i.e. a createError thrown inside the operation) pass
 * through untouched. Handlers wrap their awaited external calls in this guard so a dead upstream surfaces as a clean
 * gateway error instead of a raw 500 stack
 * @public
 * @function
 * @param operation - The in-flight upstream promise to guard
 * @param statusMessage - The human-readable message for the 502 when the operation rejects unexpectedly
 * @throws 502 when the operation rejects with anything other than an H3 error
 * @returns The operation's resolved value
 */
export async function runUpstream<TResult>(operation: Promise<TResult>, statusMessage: string): Promise<TResult> {
  try {
    return await operation;
  } catch (error: unknown) {
    // Deliberate H3 errors carry their own status; only unexpected failures become 502s
    if (isError(error)) {
      throw error;
    }
    throw createError({
      statusCode: 502,
      statusMessage,
      cause: error,
    });
  }
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suites can title their describe blocks from the source symbol
defineSymbol(runUpstream, {
  name: 'Run Upstream Call',
  description: 'Guards an awaited upstream operation, translating unexpected rejections into 502s.',
});
