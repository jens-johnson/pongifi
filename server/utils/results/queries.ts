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

import { and, eq, isNull, sql } from 'drizzle-orm';

import { LeagueRole, MembershipStatus, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type { IResultFormContext, ResultOperation } from '#shared/results';
import { GameType } from '#shared/rules-engine';

import { leagues, memberships, resultOperations, users } from '../../db/schema';
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
