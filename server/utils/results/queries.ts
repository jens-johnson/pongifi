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

import { and, desc, eq, gte, isNull, lte, ne, sql } from 'drizzle-orm';

import { LeagueRole, MembershipStatus, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type { IResultFormContext, IResultSubmission } from '#shared/results';
import { canonicalize, DUPLICATE_WINDOW_MINUTES, ResultState } from '#shared/results';
import { GameType } from '#shared/rules-engine';

import { leagues, memberships, resultRevisions, users } from '../../db/schema';
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
 * The most candidate matches one duplicate check reads. A warning is worth a bounded look and nothing more
 * @internal
 * @constant
 */
const DUPLICATE_SCAN_LIMIT: number = 50;

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
 * What a match the person may already have recorded looks like to the page
 * @public
 */
export interface IDuplicateCandidate {
  /* The match, which is the page it is read at */
  canonicalMatchId: string;

  /* When it says it was played */
  playedAt: string;
}

/**
 * The identity two entries of the same match would share.
 *
 * Seats by account and side, scores in order, the format and how it ended. Guest labels are deliberately absent: a
 * guest is a label on one match rather than a person, so two matches against "Dave" are not evidence of one match
 * entered twice (page spec, Probable Duplicates)
 * @internal
 * @function
 * @param submission - The normalized submission
 * @returns A string two duplicate entries agree on
 */
function duplicateKey(submission: IResultSubmission): string {
  const seats: string[] = submission.seats
    .map((seat): string => `${seat.seat}:${seat.userId ?? 'guest'}`)
    .sort((left: string, right: string): number => left.localeCompare(right));
  const games: string[] = [...submission.games]
    .sort((left, right): number => left.gameNumber - right.gameNumber)
    .map((game): string => `${game.gameNumber}:${game.a}-${game.b}`);

  return canonicalize({
    ending: submission.ending,
    games,
    gameType: submission.gameType,
    seats,
  });
}

/**
 * The matches in this league that look like the one about to be recorded.
 *
 * Advisory, and read outside the writing transaction on purpose: this is a warning a person answers, not a rule the
 * database enforces. Two identical honest matches in one evening are possible and stay possible — the page shows
 * what it found, and records anyway when told to.
 *
 * Bounded by the window and by a row limit, so a league with a busy evening cannot turn one save into an unbounded
 * scan
 * @public
 * @async
 * @function
 * @param leagueId - The league the entry belongs to
 * @param submission - The normalized submission
 * @returns The candidates, newest first
 */
export async function readDuplicateCandidates(
  leagueId: string,
  submission: IResultSubmission,
): Promise<IDuplicateCandidate[]> {
  const played: Date = new Date(submission.playedAt);

  if (Number.isNaN(played.getTime())) {
    return [];
  }

  const window: number = DUPLICATE_WINDOW_MINUTES * 60 * 1000;
  const rows = await useDatabase()
    .select({
      canonicalMatchId: resultRevisions.canonicalMatchId,
      playedAt: resultRevisions.playedAt,
      submission: resultRevisions.submission,
    })
    .from(resultRevisions)
    .where(
      and(
        eq(resultRevisions.leagueId, leagueId),
        eq(resultRevisions.isCurrent, true),
        ne(resultRevisions.state, ResultState.VOID),
        gte(resultRevisions.playedAt, new Date(played.getTime() - window)),
        lte(resultRevisions.playedAt, new Date(played.getTime() + window)),
      ),
    )
    .orderBy(desc(resultRevisions.playedAt))
    .limit(DUPLICATE_SCAN_LIMIT);
  const key: string = duplicateKey(submission);

  return rows
    .filter((row: (typeof rows)[number]): boolean => duplicateKey(row.submission) === key)
    .map((row: (typeof rows)[number]): IDuplicateCandidate => ({
      canonicalMatchId: row.canonicalMatchId,
      playedAt: row.playedAt.toISOString(),
    }));
}
