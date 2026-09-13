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
 * █████████████████████████████████ #components/widgets/leagues/create-form/utils.ts ██████████████████████████████████
 *
 * Settles a create-league submission into the form phase and alert it rests in.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';
import { WriteFailure } from '~/utils/leagues/write-failure';

import { CreateLeagueAlert, CreateLeaguePhase } from './enums';
import type { ICreateSubmissionOutcome } from './types';

/**
 * Settles a create submission into the phase the form rests in and the one alert it shows.
 *
 * Uncertainty is absorbing. A retry of a submission that may have committed is that same submission, so no answer to
 * the retry can rule the first attempt out: the form stays frozen on its original values and identifier, and no copy
 * claims the league was not created. Only a submission that was never uncertain returns to an editable form
 * @public
 * @function
 * @param failure - How the answer was read, or null when the request succeeded
 * @param mayHaveCommitted - Whether an earlier attempt at this same submission went unanswered
 * @returns The phase to rest in and the alert to show
 */
export function settleCreateSubmission(
  failure: WriteFailure | null,
  mayHaveCommitted: boolean,
): ICreateSubmissionOutcome {
  if (failure === WriteFailure.UNCERTAIN || mayHaveCommitted) {
    return { alert: CreateLeagueAlert.UNCERTAIN, phase: CreateLeaguePhase.UNCERTAIN };
  }

  // Every other answer is definite: nothing was written, and every value stays for the player to correct or resend
  if (failure === WriteFailure.RATE_LIMITED) {
    return { alert: CreateLeagueAlert.RATE_LIMITED, phase: CreateLeaguePhase.IDLE };
  }

  if (failure === WriteFailure.CONFLICT) {
    return { alert: CreateLeagueAlert.CONFLICT, phase: CreateLeaguePhase.IDLE };
  }

  return { alert: CreateLeagueAlert.REFUSED, phase: CreateLeaguePhase.IDLE };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(settleCreateSubmission, {
  name: 'Settle Create Submission',
  description: 'Resolves a create submission into the form phase and alert, keeping an uncertain outcome absorbing.',
});
