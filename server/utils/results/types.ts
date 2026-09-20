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
import type {
  IResultPolicySnapshot,
  IResultSubmission,
  ResultAction,
  ResultState,
  SideSatisfaction,
} from '#shared/results';
import type { IMatchSettings, Side } from '#shared/rules-engine';

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
 * A match this entry looks like, as the warning names it
 * @public
 */
export interface IDuplicateCandidate {
  /* The match, which is the page it is read at */
  canonicalMatchId: string;

  /* When it says it was played */
  playedAt: string;
}

/**
 * What a refusal hands back so the page can act on it.
 *
 * Read under the same lock the refusal was decided under, never from a snapshot taken before it: a candidate list or
 * an existing-result link that was true a moment earlier is exactly the thing an overlapping request invalidates
 * @public
 */
export interface IResultRefusalDetails {
  /* The token that records this exact result and this exact warning as seen, to be sent back to record anyway */
  acknowledgement?: string;

  /* The matches this entry looks like, when that is why it was refused */
  candidates?: IDuplicateCandidate[];

  /* The result this operation already wrote, when a reused key arrived with a different body */
  existing?: { canonicalMatchId: string };
}

/**
 * A request to record a result
 * @public
 */
export interface IRecordResultRequest extends IOperationKey {
  /**
   * The token a probable-duplicate warning issued, sent back to say "record it anyway".
   *
   * Bound to what was shown rather than to a list of ids: it is a digest of the submission the person saw warned and
   * the candidates they were shown, so changing the result — a play time by one minute, a score — invalidates it and
   * earns a fresh warning, and so does a new candidate appearing in the meantime.
   *
   * Beside the result rather than in it: it is no part of what was recorded, so pressing "record it anyway" can
   * never read as a different body under the same operation id. Absent means nothing was acknowledged, which is the
   * direction that warns rather than the one that writes
   */
  acknowledgement?: string | null;

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
 * One side of a match as the revision that created it saw it: who may answer for that side, and how it is satisfied
 * @public
 */
export interface IRevisionSide {
  /* The registered accounts seated on this side, frozen as the revision was born */
  confirmers: string[];

  /* How the side stands: answered by the submission, by a confirmation, exempt, or still owed */
  satisfiedBy: SideSatisfaction;

  /* Which side of the table it is */
  side: Side;
}

/**
 * A revision as the transaction reads it back under its locks
 * @public
 */
export interface IRevisionRow {
  canonicalMatchId: string;
  confirmationDeadline: Date | null;
  /* The confirmation protocol this revision was born under; an older revision is still judged by its own */
  confirmationRuleVersion: number;
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
  | { details?: IResultRefusalDetails; ok: false; refusal: ResultRefusal; state: ResultState | null }
  | { current: IResultCurrentState; ok: true; replayed: boolean; value: IResultEffect };
