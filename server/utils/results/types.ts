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
 * ██████████████████████████████████████████ #server/utils/results/types.ts ███████████████████████████████████████████
 *
 * The requests, rows and answers the result operations read and write.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { RatingScope } from '#shared/domain';
import type { IResultPolicySnapshot, IResultSubmission, ResultAction, ResultState } from '#shared/results';
import type { IMatchSettings } from '#shared/rules-engine';

import type { ResultRefusal } from './enums';

/**
 * The identity a write carries so a lost answer can be resolved instead of retried blind
 * @public
 */
export interface IOperationKey {
  /* The identifier the client minted before it sent anything, and reuses for every retry of that action */
  clientOperationId: string;
}

/**
 * A request to record a result
 * @public
 */
export interface IRecordResultRequest extends IOperationKey {
  /* The configuration revision the form was drawn at; a league that has moved since refuses rather than adapts */
  expectedLeagueRevision: number;

  /* The league the match was played in */
  leagueId: string;

  /* The normalized submission */
  submission: IResultSubmission;
}

/**
 * A request to correct a result
 * @public
 */
export interface IAmendResultRequest extends IOperationKey {
  /* The match being corrected */
  canonicalMatchId: string;

  /* The revision the corrector was looking at */
  expectedRevision: number;

  /* The corrected submission; its format is ignored in favour of the frozen one */
  submission: IResultSubmission;
}

/**
 * A request to answer a result
 * @public
 */
export interface IAnswerResultRequest extends IOperationKey {
  /* Confirm, dispute or void */
  action: ResultAction;

  /* The match being answered */
  canonicalMatchId: string;

  /* The revision the answerer was looking at */
  expectedRevision: number;

  /* The words attached to a dispute; null for anything else */
  note: string | null;
}

/**
 * What a committed write recorded, replayed verbatim to a retry of the same action
 * @public
 */
export interface IResultEffect {
  /* The match */
  canonicalMatchId: string;

  /* The revision the operation produced or answered */
  revision: number;

  /* The revision's identifier */
  resultRevisionId: string;

  /* The state the operation left the revision in */
  state: ResultState;
}

/**
 * Where the match stands now, for the caller whose access was just checked.
 *
 * Reported beside the effect rather than in place of it, because a retry asks two questions at once: what my action
 * did, and what the result looks like now. A confirmation of revision one replayed after an amendment has to answer
 * both — the effect it had, and the fact that revision two is what anybody is looking at today
 * @public
 */
export interface IResultCurrentState {
  /* The match */
  canonicalMatchId: string;

  /* The revision that is current now */
  revision: number;

  /* That revision's identifier */
  resultRevisionId: string;

  /* The state it is in now */
  state: ResultState;
}

/**
 * A revision as the transaction reads it back under its locks
 * @public
 */
export interface IRevisionRow {
  canonicalMatchId: string;
  confirmationDeadline: Date | null;
  gameType: string;
  id: string;
  leagueId: string;
  originalPlayedAt: Date;
  playedAt: Date;
  policySnapshot: IResultPolicySnapshot;
  recordedBy: string;
  revision: number;
  settingsSnapshot: IMatchSettings;
  state: ResultState;
  submission: IResultSubmission;
}

/**
 * What one publication cost, split by where the time went.
 *
 * Reported rather than logged, because a budget is chosen from these three numbers and nothing else: reading a league's
 * eligible rows, replaying them through the engine, and writing the snapshots. A single whole-transaction figure cannot
 * tell anybody which of the three a bigger league would break first
 * @public
 */
export interface IGenerationTimings {
  /* Replaying the ordered rows through the rating engine */
  engineMs: number;

  /* Writing the generation, its snapshots and the pointer */
  insertMs: number;

  /* Reading the league's eligible game rows */
  readMs: number;
}

/**
 * What a published generation is, and what publishing it cost
 * @public
 */
export interface IPublishedGeneration {
  /* The generation that is now active */
  generationId: string;

  /* How many game rows actually rated somebody */
  ratedGameCount: number;

  /* Where the time went */
  timings: IGenerationTimings;
}

/**
 * One rating snapshot a published generation carries
 * @public
 */
export interface IGenerationSnapshot {
  delta: number;
  gameId: string;
  gamesPlayed: number;
  isProvisional: boolean;
  rating: number;
  scope: RatingScope;
  userId: string;
}

/**
 * What a write answers with: what it did, or why it was refused.
 *
 * A refusal is a value rather than a thrown error because some of them happen after the transaction has already done
 * durable work worth keeping. A dispute that arrives a minute late meets a result the same transaction has just
 * settled by its deadline: the dispute is refused and the settlement stands, and throwing would have thrown both away.
 *
 * A success carries three things rather than one: the effect, whether that effect is a receipt this call replayed
 * rather than produced, and where the match stands now. They are separate fields because they can disagree, and a
 * caller that read the revision out of the effect would tell somebody their confirmation is current when an amendment
 * has since replaced it
 * @public
 */
export type TResultOutcome =
  | { ok: false; refusal: ResultRefusal; state: ResultState | null }
  | { current: IResultCurrentState; ok: true; replayed: boolean; value: IResultEffect };
