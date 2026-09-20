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
 * █████████████████████████████████████████ #server/utils/results/queries.ts ██████████████████████████████████████████
 *
 * Reads the result pages make, starting with the context a Record form opens with.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { LeagueRole, MembershipStatus, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type {
  IGameScoreRow,
  IMatchView,
  IMatchViewGame,
  IMatchViewParticipant,
  IMatchViewRevision,
  IMatchViewSide,
  IResultFormContext,
  IResultIdentity,
  IResultPolicySnapshot,
  IResultSubmission,
  ResultOperation,
  ResultSettleReason,
} from '#shared/results';
import {
  DELETED_ACCOUNT_NAME,
  ResultAction,
  ResultEnding,
  ResultState,
  sideOfSeat,
  SideSatisfaction,
} from '#shared/results';
import type { IMatchSettings, Side } from '#shared/rules-engine';
import { GameType, Side as MatchSide } from '#shared/rules-engine';

import {
  activeRatingGenerations,
  leagues,
  memberships,
  ratingSnapshots,
  resultActions,
  resultDisputeNotes,
  resultOperations,
  resultRevisionGames,
  resultRevisions,
  resultRevisionSides,
  resultSideConfirmers,
  users,
} from '../../db/schema';
import { useDatabase } from '../db';
import { HOUR_MS } from './constants';

/**
 * The formats this slice records. Cutthroat is played and rated, but a final triple cannot be validated from scores
 * alone, so it waits for the live scorer (page spec, Not In This Slice)
 * @internal
 * @constant
 */
const RECORDABLE_FORMATS: readonly GameType[] = [GameType.SINGLES, GameType.DOUBLES];

/**
 * How the Record page names who may record, matching the label the settings page already uses
 * @internal
 * @constant
 */
const RECORDER_LABEL: Record<string, string> = {
  [ResultRecorder.MANAGER]: 'a commissioner or manager',
  [ResultRecorder.PARTICIPANTS]: 'a commissioner, a manager, or a player in the match',
};

/**
 * Whether this role and setting let the account open the form at all.
 *
 * A player under a PARTICIPANTS policy may record, but only a match they are seated in, which the form enforces as
 * they fill the seats and the service enforces again at the write. Under any other policy they may not record, and
 * the page says so instead of showing a form that would be refused
 * @internal
 * @function
 * @param role - The role the account holds now
 * @param settings - The league's current settings
 * @returns Whether the form renders
 */
function mayOpenForm(role: LeagueRole, settings: TLeagueSettings): boolean {
  if (role === LeagueRole.COMMISSIONER || role === LeagueRole.MANAGER) {
    return true;
  }

  return settings.whoCanRecordResults === ResultRecorder.PARTICIPANTS;
}

/**
 * Everything the Record page needs before a person can type anything.
 *
 * The clock is the point of this read. A device five minutes fast would otherwise offer a play time the server
 * refuses as the future, and the person would have no way to know why — so the instant the form opens with comes
 * from the database, and the entry window is measured from that same instant rather than from the browser's idea of
 * now (contract, Record Clock Addendum).
 *
 * The roster carries display names rather than ids alone because the seat picker names people the way the members
 * panel does; a deleted account is not in it, because a seat cannot be given to one
 * @public
 * @async
 * @function
 * @param leagueId - The league, already checked to be a UUID
 * @param userId - The account from the verified session
 * @returns The context, or null when the caller is not an active member of a league that exists
 */
export async function readFormContext(leagueId: string, userId: string): Promise<IResultFormContext | null> {
  const database = useDatabase();
  const rows = await database
    .select({
      configurationRevision: leagues.configurationRevision,
      name: leagues.name,
      role: memberships.role,
      settings: leagues.settings,
    })
    .from(leagues)
    .innerJoin(
      memberships,
      and(
        eq(memberships.leagueId, leagues.id),
        eq(memberships.userId, userId),
        eq(memberships.status, MembershipStatus.ACTIVE),
      ),
    )
    .innerJoin(users, and(eq(users.id, memberships.userId), isNull(users.deletedAt)))
    .where(eq(leagues.id, leagueId))
    .limit(1);
  const league: (typeof rows)[number] | undefined = rows[0];

  if (!league) {
    return null;
  }

  const settings: TLeagueSettings = league.settings;
  const roster = await database
    .select({ displayName: users.displayName, id: users.id })
    .from(memberships)
    .innerJoin(users, and(eq(users.id, memberships.userId), isNull(users.deletedAt)))
    .where(and(eq(memberships.leagueId, leagueId), eq(memberships.status, MembershipStatus.ACTIVE)));

  // The database's clock, not this process's: the window below is measured from the instant the form is
  // initialized with, and a browser five minutes fast never decides what "now" was
  const clock = await database
    .select({ now: sql<Date>`now()` })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);
  const now: Date = clock[0]?.now ?? new Date();
  const role: LeagueRole = league.role as LeagueRole;

  return {
    authority: { may: mayOpenForm(role, settings), who: RECORDER_LABEL[settings.whoCanRecordResults] ?? '' },
    configurationRevision: league.configurationRevision,
    earliest: new Date(now.getTime() - settings.resultAmendmentWindow * HOUR_MS).toISOString(),
    formats: RECORDABLE_FORMATS.filter((format: GameType): boolean => settings.allowedGameTypes.includes(format)),
    leagueName: league.name,
    now: now.toISOString(),
    roster: roster.map((member: (typeof roster)[number]) => ({ displayName: member.displayName, id: member.id })),
    rules: {
      matchFormat: settings.matchFormat,
      targetScore: settings.targetScore as unknown as Record<string, number>,
      winningMargin: settings.winningMargin,
    },
  };
}

/**
 * What a receipt says this account's operation already did
 * @public
 */
export interface IOperationReceipt {
  /* The match the operation touched */
  canonicalMatchId: string;

  /* The revision it produced or answered */
  resultRevisionId: string;
}

/**
 * The receipt this account's operation already wrote, if it wrote one.
 *
 * Read before the duplicate advisory, and for one reason: a save whose response was lost has already created the
 * match, so the identical retry now matches its own creation. Warning about that would tell the person their own
 * committed result looks like a duplicate of itself, and the receipt the service would have replayed never gets
 * read. Only an operation with no receipt is fresh enough to warn about.
 *
 * Keyed by the acting account, so it can only ever find this caller's own operation
 * @public
 * @async
 * @function
 * @param userId - The account from the verified session
 * @param operation - Which kind of write this key belongs to
 * @param clientOperationId - The identifier the page minted before it sent anything
 * @returns The receipt, or null when this operation has never committed
 */
export async function readOperationReceipt(
  userId: string,
  operation: ResultOperation,
  clientOperationId: string,
): Promise<IOperationReceipt | null> {
  const rows = await useDatabase()
    .select({
      canonicalMatchId: resultOperations.canonicalMatchId,
      resultRevisionId: resultOperations.resultRevisionId,
    })
    .from(resultOperations)
    .where(
      and(
        eq(resultOperations.actorUserId, userId),
        eq(resultOperations.operation, operation),
        eq(resultOperations.clientOperationId, clientOperationId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * How a person is named, resolved now rather than copied when the match was recorded
 * @internal
 * @function
 * @param row - What the join found for that account, if anything
 * @param guestName - The label a guest seat was entered under
 * @returns The identity a page renders
 */
function identityOf(
  row: { deletedAt: Date | null; displayName: string; id: string; member: boolean } | undefined,
  guestName: string | null = null,
): IResultIdentity {
  if (guestName !== null) {
    return {
      displayName: guestName,
      guest: true,
      id: null,
      member: false,
      removed: false,
    };
  }

  if (!row || row.deletedAt !== null) {
    return {
      displayName: DELETED_ACCOUNT_NAME,
      guest: false,
      id: row?.id ?? null,
      member: false,
      removed: true,
    };
  }

  return {
    displayName: row.displayName,
    guest: false,
    id: row.id,
    member: row.member,
    removed: false,
  };
}

/**
 * Reads every account a match names, with the state each one is in now.
 *
 * One read for the whole page: the heading, the participants table, the history and the dispute line all name people,
 * and all of them have to agree about who is deleted and who is still a member
 * @internal
 * @async
 * @function
 * @param leagueId - The league the match belongs to
 * @param userIds - Every account the page could name
 * @returns What to render for each, by account id
 */
async function readIdentities(
  leagueId: string,
  userIds: string[],
): Promise<Map<string, { deletedAt: Date | null; displayName: string; id: string; member: boolean }>> {
  const wanted: string[] = [...new Set(userIds)];

  if (wanted.length === 0) {
    return new Map();
  }

  const rows = await useDatabase()
    .select({
      deletedAt: users.deletedAt,
      displayName: users.displayName,
      id: users.id,
      membership: memberships.status,
    })
    .from(users)
    .leftJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.leagueId, leagueId)))
    .where(inArray(users.id, wanted));

  return new Map(
    rows.map((row: (typeof rows)[number]) => [
      row.id,
      {
        deletedAt: row.deletedAt,
        displayName: row.displayName,
        id: row.id,
        member: row.membership === MembershipStatus.ACTIVE,
      },
    ]),
  );
}

/**
 * Which side won a game, by the scoreboard or by the withdrawal that ended it.
 *
 * A retired game is won by the side that did not withdraw whatever the scoreboard says (III.II.X.II), and every game
 * played out before it keeps its own winner
 * @internal
 * @function
 * @param game - The entered scores
 * @param retiredSide - The side that withdrew, on the game it withdrew in
 * @returns The winning side, or null when nobody won it
 */
function winnerOf(game: IGameScoreRow, retiredSide: Side | null): Side | null {
  if (retiredSide !== null) {
    return retiredSide === MatchSide.A ? MatchSide.B : MatchSide.A;
  }

  if (game.a === game.b) {
    return null;
  }

  return game.a > game.b ? MatchSide.A : MatchSide.B;
}

/**
 * Reads a match as its page shows it.
 *
 * The current revision alone decides what is on the page: its submission states the scores and the seats, its
 * snapshots state the rules the match was judged by, and its sides state who still owes an answer. Earlier revisions
 * appear only in the history.
 *
 * Every rating figure comes from the league's **active generation**, never from the newest rows written: a
 * recomputation publishes a whole ladder and moves one pointer, so a page that read the newest snapshot per game
 * could show one member's number from the new ladder beside another's from the old one
 * @public
 * @async
 * @function
 * @param leagueId - The league, already authorized for this caller
 * @param canonicalMatchId - The match, which is its page
 * @param userId - The account from the verified session
 * @param role - The role that account holds now
 * @returns The view, or null when there is no such match in this league
 */
export async function readMatchView(
  leagueId: string,
  canonicalMatchId: string,
  userId: string,
  role: LeagueRole,
): Promise<IMatchView | null> {
  const database = useDatabase();
  const revisions = await database
    .select({
      confirmationDeadline: resultRevisions.confirmationDeadline,
      editedBy: resultRevisions.editedBy,
      gameType: resultRevisions.gameType,
      id: resultRevisions.id,
      originalPlayedAt: resultRevisions.originalPlayedAt,
      isCurrent: resultRevisions.isCurrent,
      playedAt: resultRevisions.playedAt,
      policySnapshot: resultRevisions.policySnapshot,
      recordedBy: resultRevisions.recordedBy,
      revision: resultRevisions.revision,
      settingsSnapshot: resultRevisions.settingsSnapshot,
      settledAt: resultRevisions.settledAt,
      settledReason: resultRevisions.settledReason,
      state: resultRevisions.state,
      submission: resultRevisions.submission,
      submittedAt: resultRevisions.submittedAt,
    })
    .from(resultRevisions)
    .where(and(eq(resultRevisions.leagueId, leagueId), eq(resultRevisions.canonicalMatchId, canonicalMatchId)))
    .orderBy(asc(resultRevisions.revision));
  const current = revisions.find((row: (typeof revisions)[number]): boolean => row.isCurrent === true);

  if (!current) {
    return null;
  }

  const submission: IResultSubmission = current.submission;
  const settings: IMatchSettings = current.settingsSnapshot;
  const policy: IResultPolicySnapshot = current.policySnapshot;
  const retiredSide: Side | null =
    submission.ending === ResultEnding.RETIRED && submission.retiredSeat ? sideOfSeat(submission.retiredSeat) : null;
  const lastGame: number = Math.max(...submission.games.map((game: IGameScoreRow): number => game.gameNumber));
  const games: IMatchViewGame[] = [...submission.games]
    .sort((left: IGameScoreRow, right: IGameScoreRow): number => left.gameNumber - right.gameNumber)
    .map((game: IGameScoreRow): IMatchViewGame => {
      const retired: boolean = retiredSide !== null && game.gameNumber === lastGame;

      return {
        a: game.a,
        b: game.b,
        gameNumber: game.gameNumber,
        retired,
        winner: winnerOf(game, retired ? retiredSide : null),
      };
    });
  const sideRows = await database
    .select({
      confirmedAt: resultRevisionSides.confirmedAt,
      confirmedByUserId: resultRevisionSides.confirmedByUserId,
      satisfiedBy: resultRevisionSides.satisfiedBy,
      side: resultRevisionSides.side,
    })
    .from(resultRevisionSides)
    .where(eq(resultRevisionSides.resultRevisionId, current.id));
  const confirmerRows = await database
    .select({ side: resultSideConfirmers.side, userId: resultSideConfirmers.userId })
    .from(resultSideConfirmers)
    .where(eq(resultSideConfirmers.resultRevisionId, current.id));
  const actions = await database
    .select({
      actorUserId: resultActions.actorUserId,
      createdAt: resultActions.createdAt,
      id: resultActions.id,
      revisionId: resultActions.resultRevisionId,
      type: resultActions.type,
    })
    .from(resultActions)
    .where(
      inArray(
        resultActions.resultRevisionId,
        revisions.map((row: (typeof revisions)[number]): string => row.id),
      ),
    );
  const notes = await database
    .select({
      actionId: resultDisputeNotes.resultActionId,
      body: resultDisputeNotes.body,
      redactedAt: resultDisputeNotes.redactedAt,
    })
    .from(resultDisputeNotes)
    .where(
      inArray(
        resultDisputeNotes.resultActionId,
        actions.map((action: (typeof actions)[number]): string => action.id),
      ),
    );
  const ratings = await database
    .select({
      after: sql<number>`max(${ratingSnapshots.rating})`,
      before: sql<number>`min(${ratingSnapshots.ratingBefore})`,
      delta: sql<number>`sum(${ratingSnapshots.delta})`,
      provisional: sql<boolean>`bool_or(${ratingSnapshots.isProvisional})`,
      userId: ratingSnapshots.userId,
    })
    .from(ratingSnapshots)
    .innerJoin(
      activeRatingGenerations,
      eq(activeRatingGenerations.ratingGenerationId, ratingSnapshots.ratingGenerationId),
    )
    .innerJoin(resultRevisionGames, eq(resultRevisionGames.gameId, ratingSnapshots.gameId))
    .where(and(eq(activeRatingGenerations.leagueId, leagueId), eq(resultRevisionGames.resultRevisionId, current.id)))
    .groupBy(ratingSnapshots.userId);
  const identities = await readIdentities(leagueId, [
    ...submission.seats.map((seat): string | null => seat.userId).filter((id): id is string => id !== null),
    ...revisions.flatMap((row: (typeof revisions)[number]): string[] => [
      row.recordedBy,
      row.editedBy ?? row.recordedBy,
    ]),
    ...actions.map((action: (typeof actions)[number]): string => action.actorUserId),
    ...confirmerRows.map((row: (typeof confirmerRows)[number]): string => row.userId),
  ]);

  return shapeMatchView({
    actions,
    canonicalMatchId,
    confirmerRows,
    current,
    games,
    identities,
    notes,
    policy,
    ratings,
    revisions,
    settings,
    sideRows,
    submission,
    userId,
    role,
  });
}

/**
 * What the gathering half read, handed to the shaping half
 * @internal
 */
interface IMatchViewSource {
  actions: { actorUserId: string; createdAt: Date; id: string; revisionId: string; type: string }[];
  canonicalMatchId: string;
  confirmerRows: { side: string; userId: string }[];
  current: {
    confirmationDeadline: Date | null;
    id: string;
    originalPlayedAt: Date;
    playedAt: Date;
    recordedBy: string;
    revision: number;
    settledAt: Date | null;
    settledReason: string | null;
    state: string;
    submittedAt: Date;
  };
  games: IMatchViewGame[];
  identities: Map<string, { deletedAt: Date | null; displayName: string; id: string; member: boolean }>;
  notes: { actionId: string; body: string | null; redactedAt: Date | null }[];
  policy: IResultPolicySnapshot;
  ratings: { after: number; before: number; delta: number; provisional: boolean; userId: string }[];
  revisions: {
    editedBy: string | null;
    id: string;
    recordedBy: string;
    revision: number;
    submission: IResultSubmission;
    submittedAt: Date;
  }[];
  role: LeagueRole;
  settings: IMatchSettings;
  sideRows: { confirmedByUserId: string | null; satisfiedBy: string; side: string }[];
  submission: IResultSubmission;
  userId: string;
}

/**
 * Turns what was read into what the page shows.
 *
 * Pure, and separate from the reads above, because every rule the page states is here: who may act, what the status
 * line is waiting for, whether the match rated and why not. A rule that lives inside a query is a rule nobody can
 * test without a database
 * @internal
 * @function
 * @param source - Everything the reads found
 * @returns The view
 */
function shapeMatchView(source: IMatchViewSource): IMatchView {
  const { current, identities, submission } = source;
  const state: ResultState = current.state as ResultState;
  const seatedIds: string[] = submission.seats
    .map((seat): string | null => seat.userId)
    .filter((id): id is string => id !== null);
  const rated: boolean = source.policy.ratingEnabled && submission.seats.every((seat): boolean => seat.userId !== null);
  // Seat order, so the status line names a side's confirmers the way the participants table lists them rather than
  // in whatever order the rows came back
  const seatOrder: string[] = submission.seats
    .map((seat): string | null => seat.userId)
    .filter((id): id is string => id !== null);
  const sides: IMatchViewSide[] = source.sideRows.map((row): IMatchViewSide => {
    const eligible: string[] = source.confirmerRows
      .filter((confirmer): boolean => confirmer.side === row.side)
      .map((confirmer): string => confirmer.userId)
      .sort((left: string, right: string): number => seatOrder.indexOf(left) - seatOrder.indexOf(right));
    const pending: boolean = row.satisfiedBy === SideSatisfaction.PENDING;
    const teammate: string | undefined = eligible.find((id: string): boolean => id !== source.userId);

    return {
      awaitsViewer: pending && eligible.includes(source.userId),
      confirmedBy: row.confirmedByUserId ? identityOf(identities.get(row.confirmedByUserId)) : null,
      confirmers: eligible.map((id: string): IResultIdentity => identityOf(identities.get(id))),
      satisfiedBy: row.satisfiedBy as SideSatisfaction,
      side: row.side as Side,
      viewerTeammate:
        pending && eligible.includes(source.userId) && teammate ? identityOf(identities.get(teammate)) : null,
    };
  });
  const confirmedByAccount: Set<string> = new Set(
    source.sideRows.map((row): string | null => row.confirmedByUserId).filter((id): id is string => id !== null),
  );
  const ratingOf = (userId: string | null): IMatchViewParticipant['rating'] => {
    const row = userId === null ? undefined : source.ratings.find((rating): boolean => rating.userId === userId);

    return row
      ? {
          after: row.after,
          before: row.before,
          delta: row.delta,
          provisional: row.provisional,
        }
      : null;
  };
  const participants: IMatchViewParticipant[] = submission.seats.map((seat): IMatchViewParticipant => ({
    confirmed: seat.userId !== null && confirmedByAccount.has(seat.userId),
    identity: identityOf(seat.userId === null ? undefined : identities.get(seat.userId), seat.guestName),
    rating: ratingOf(seat.userId),
    seat: seat.seat,
    side: sideOfSeat(seat.seat),
  }));
  const currentActions = source.actions.filter((action): boolean => action.revisionId === current.id);
  const disputeAction = currentActions.find((action): boolean => action.type === ResultAction.DISPUTE);
  const voidAction = currentActions.find((action): boolean => action.type === ResultAction.VOID);
  const noteOf = (actionId: string | undefined): { note: string | null; redacted: boolean } => {
    const row = actionId === undefined ? undefined : source.notes.find((note): boolean => note.actionId === actionId);

    return { note: row?.body ?? null, redacted: row !== undefined && row.redactedAt !== null };
  };
  const seated: boolean = seatedIds.includes(source.userId);
  const administrator: boolean = source.role === LeagueRole.COMMISSIONER || source.role === LeagueRole.MANAGER;
  // Revision one's stated play time, which the revision row keeps for exactly this: a correction that moved the play
  // time must not be able to revive an amendment right that had run out
  const amendmentBound: number = current.originalPlayedAt.getTime() + source.policy.resultAmendmentWindow * HOUR_MS;
  const waiting: boolean = state === ResultState.UNCONFIRMED;
  const mayConfirm: boolean =
    waiting &&
    sides.some(
      (side): boolean =>
        side.satisfiedBy === SideSatisfaction.PENDING &&
        side.confirmers.some((confirmer): boolean => confirmer.id === source.userId && confirmer.member),
    );

  const amendmentOpen: boolean = Date.now() < amendmentBound;

  return {
    amendmentOpen,
    canonicalMatchId: source.canonicalMatchId,
    confirmationDeadline: current.confirmationDeadline?.toISOString() ?? null,
    dispute:
      state === ResultState.DISPUTED && disputeAction
        ? {
            at: disputeAction.createdAt.toISOString(),
            by: identityOf(identities.get(disputeAction.actorUserId)),
            ...noteOf(disputeAction.id),
          }
        : null,
    ending: submission.ending,
    games: source.games,
    gamesWon: {
      a: source.games.filter((game): boolean => game.winner === MatchSide.A).length,
      b: source.games.filter((game): boolean => game.winner === MatchSide.B).length,
    },
    gameType: submission.gameType,
    history: source.revisions.map((row): IMatchViewRevision => {
      const disputed = source.actions.find(
        (action): boolean => action.revisionId === row.id && action.type === ResultAction.DISPUTE,
      );

      return {
        // This revision's own instant: a history in which every line carried the current revision's time would say
        // that a correction and the entry it corrected happened together
        at: row.submittedAt.toISOString(),
        by: identityOf(identities.get(row.editedBy ?? row.recordedBy)),
        disputedAt: disputed?.createdAt.toISOString() ?? null,
        disputedBy: disputed ? identityOf(identities.get(disputed.actorUserId)) : null,
        kind: row.editedBy === null ? 'RECORDED' : 'AMENDED',
        revision: row.revision,
        scores: row.submission.games.map((game: IGameScoreRow): string => `${game.a}-${game.b}`).join(', '),
      };
    }),
    participants,
    playedAt: current.playedAt.toISOString(),
    rating: {
      rated,
      unratedReason: rated ? null : source.policy.ratingEnabled ? 'GUEST' : 'RATINGS_OFF',
    },
    recordedBy: identityOf(identities.get(current.recordedBy)),
    revision: current.revision,
    rules: {
      matchFormat: source.settings.matchFormat,
      targetScore: source.settings.targetScore,
      winningMargin: source.settings.winningMargin,
    },
    settledAt: current.settledAt?.toISOString() ?? null,
    settledReason: (current.settledReason as ResultSettleReason | null) ?? null,
    sides,
    state,
    submittedAt: current.submittedAt.toISOString(),
    viewer: {
      administrator,
      // An amendment resolves a dispute, and only while the window measured from the original play time is open
      mayAmend: administrator && state === ResultState.DISPUTED && amendmentOpen,
      mayConfirm,
      // Wider than confirming by design: anybody seated may dispute while the result is still pending, the recorder
      // and the recorder's partner included (VII.VI)
      mayDispute: waiting && seated,
      mayVoid: administrator && state !== ResultState.VOID,
      seated,
    },
    voided:
      state === ResultState.VOID && voidAction
        ? { at: voidAction.createdAt.toISOString(), by: identityOf(identities.get(voidAction.actorUserId)) }
        : null,
  };
}
