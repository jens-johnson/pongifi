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
 * ███████████████████████████████████████████ #utils/results/format.test.ts ███████████████████████████████████████████
 *
 * Unit tests for what a result page says.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { describe, expect, it } from 'vitest';

import type { IMatchView, IMatchViewParticipant, IMatchViewSide } from '#shared/results';
import { DELETED_ACCOUNT_NAME, ResultSettleReason, ResultState, Seat, SideSatisfaction } from '#shared/results';
import { GameType, Side } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import {
  namesOf,
  toAcceptedLine,
  toAwaitingLine,
  toDisputeLine,
  toHeading,
  toLocalDateTime,
  toRatingCell,
  toRatingLine,
  toResolutionLine,
  toSideLabel,
  toSummary,
  toTitle,
} from './format';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * One seat, as the read hands it over
 * @internal
 * @function
 * @param displayName - Who is in it
 * @param side - Which side they play on
 * @param overrides - What the case changes
 * @returns The participant
 */
function seat(displayName: string, side: Side, overrides: Partial<IMatchViewParticipant> = {}): IMatchViewParticipant {
  return {
    confirmed: false,
    identity: {
      displayName,
      guest: false,
      id: displayName,
      member: true,
      removed: false,
    },
    rating: null,
    seat: side === Side.A ? Seat.A1 : Seat.B1,
    side,
    ...overrides,
  };
}

/**
 * A match of the shape the page reads
 * @internal
 * @function
 * @param overrides - What the case changes
 * @returns The match
 */
function match(overrides: Partial<IMatchView> = {}): IMatchView {
  return {
    amendmentOpen: true,
    canonicalMatchId: 'b5e2d1ef-0000-4000-8000-000000000002',
    confirmationDeadline: '2026-09-21T12:00:00.000Z',
    dispute: null,
    ending: 'COMPLETED' as IMatchView['ending'],
    games: [],
    gamesWon: { a: 2, b: 1 },
    gameType: GameType.SINGLES,
    history: [],
    leagueName: 'Friday Ladder',
    participants: [seat('Ada', Side.A), seat('Ben', Side.B)],
    playedAt: '2026-09-20T12:00:00.000Z',
    rating: { rated: true, unratedReason: null },
    recordedBy: {
      displayName: 'Ada',
      guest: false,
      id: 'Ada',
      member: true,
      removed: false,
    },
    retiredSeat: null,
    revision: 1,
    rules: {
      matchFormat: 3,
      targetScore: 11,
      winningMargin: 2,
    },
    settledAt: '2026-09-21T09:00:00.000Z',
    settledReason: null,
    sides: [],
    state: ResultState.UNCONFIRMED,
    submittedAt: '2026-09-20T13:00:00.000Z',
    viewer: {
      administrator: false,
      mayAmend: false,
      mayConfirm: false,
      mayDispute: false,
      mayVoid: false,
      seated: true,
    },
    voided: null,
    ...overrides,
  };
}

/**
 * One side of a match, as the read hands it over
 * @internal
 * @function
 * @param overrides - What the case changes
 * @returns The side
 */
function side(overrides: Partial<IMatchViewSide> = {}): IMatchViewSide {
  return {
    awaitsViewer: false,
    confirmedBy: null,
    confirmers: [
      {
        displayName: 'Ben',
        guest: false,
        id: 'Ben',
        member: true,
        removed: false,
      },
    ],
    satisfiedBy: SideSatisfaction.PENDING,
    side: Side.B,
    viewerTeammate: null,
    ...overrides,
  };
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(toHeading), (): void => {
    it('does not announce a winner while the result can still be contested', (): void => {
      // A page that read "Ada beat Ben" over a result Ben is still entitled to dispute would be taking a side
      expect(toHeading(match({ state: ResultState.UNCONFIRMED }))).toBe('Ada v Ben');
      expect(toHeading(match({ state: ResultState.DISPUTED }))).toBe('Ada v Ben');
    });

    it('names the winner once the result is accepted', (): void => {
      expect(toHeading(match({ state: ResultState.CONFIRMED }))).toBe('Ada beat Ben');
      expect(toHeading(match({ gamesWon: { a: 0, b: 2 }, state: ResultState.CONFIRMED }))).toBe('Ben beat Ada');
    });

    it('stops announcing a winner once the result is voided', (): void => {
      // A voided result has stopped counting: "Ada beat Ben" over a line saying it does not count announces the
      // very thing the void withdrew
      expect(toHeading(match({ state: ResultState.VOID }))).toBe('Ada v Ben');
    });

    it('joins a doubles side the way the spec joins it', (): void => {
      const doubles: IMatchView = match({
        participants: [seat('Ada', Side.A), seat('Ben', Side.A), seat('Cara', Side.B), seat('Dan', Side.B)],
        state: ResultState.CONFIRMED,
      });

      expect(toHeading(doubles)).toBe('Ada and Ben beat Cara and Dan');
    });

    it('names a deleted account the way every other surface does', (): void => {
      const withDeleted: IMatchView = match({
        participants: [
          seat('Ada', Side.A),
          seat(DELETED_ACCOUNT_NAME, Side.B, {
            identity: {
              displayName: DELETED_ACCOUNT_NAME,
              guest: false,
              id: 'Ben',
              member: false,
              removed: true,
            },
          }),
        ],
        state: ResultState.CONFIRMED,
      });

      expect(toHeading(withDeleted)).toBe(`Ada beat ${DELETED_ACCOUNT_NAME}`);
    });
  });

  describe(symbolName(toTitle), (): void => {
    it('says the same thing before and after acceptance, and names the league', (): void => {
      // A tab is read beside other tabs. A title that turned from "v" into "beat" would make one match look like
      // two in somebody's history, and one without the league does not say which ladder it belongs to
      expect(toTitle(match({ state: ResultState.UNCONFIRMED }))).toBe('Ada v Ben · Friday Ladder');
      expect(toTitle(match({ state: ResultState.CONFIRMED }))).toBe('Ada v Ben · Friday Ladder');
      expect(toTitle(match({ state: ResultState.DISPUTED }))).toBe('Ada v Ben · Friday Ladder');
    });
  });

  describe(symbolName(toSideLabel), (): void => {
    it('names the side a seat played on', (): void => {
      expect(toSideLabel(seat('Ada', Side.A))).toBe('Side A');
      expect(toSideLabel(seat('Ben', Side.B))).toBe('Side B');
    });
  });

  describe(symbolName(toSummary), (): void => {
    it('states the format, the length and the games won', (): void => {
      expect(toSummary(match())).toBe('Singles · Best of 3 · 2-1');
      expect(toSummary(match({ gameType: GameType.DOUBLES }))).toBe('Doubles · Best of 3 · 2-1');
    });

    it('names whoever withdrew, since the scoreline alone does not explain a retirement', (): void => {
      expect(toSummary(match({ retiredSeat: Seat.B1 }))).toBe('Singles · Best of 3 · 2-1 · Ben retired');
    });

    it('says nothing about retirement when nobody withdrew', (): void => {
      expect(toSummary(match())).not.toContain('retired');
    });
  });

  describe(symbolName(toAwaitingLine), (): void => {
    it('speaks to the viewer when the viewer is the one being asked', (): void => {
      expect(toAwaitingLine(side({ awaitsViewer: true }))).toBe('Awaiting your confirmation');
    });

    it('names the teammate who could answer instead', (): void => {
      const withTeammate: IMatchViewSide = side({
        awaitsViewer: true,
        viewerTeammate: {
          displayName: 'Cara',
          guest: false,
          id: 'Cara',
          member: true,
          removed: false,
        },
      });

      expect(toAwaitingLine(withTeammate)).toBe("Awaiting your confirmation (or Cara's)");
    });

    it('joins a side’s confirmers with "or", because any one of them answers it', (): void => {
      const pair: IMatchViewSide = side({
        confirmers: [
          {
            displayName: 'Cara',
            guest: false,
            id: 'Cara',
            member: true,
            removed: false,
          },
          {
            displayName: 'Dan',
            guest: false,
            id: 'Dan',
            member: true,
            removed: false,
          },
        ],
      });

      expect(toAwaitingLine(pair)).toBe('Awaiting confirmation from Cara or Dan');
    });

    it('keeps a departed member in the line, and says why they cannot answer', (): void => {
      // The side still waits for somebody, and the page should say who it was waiting for
      const departed: IMatchViewSide = side({
        confirmers: [
          {
            displayName: 'Cara',
            guest: false,
            id: 'Cara',
            member: false,
            removed: false,
          },
          {
            displayName: 'Dan',
            guest: false,
            id: 'Dan',
            member: true,
            removed: false,
          },
        ],
      });

      expect(toAwaitingLine(departed)).toBe('Awaiting confirmation from Cara (no longer a member) or Dan');
    });
  });

  describe(symbolName(toAcceptedLine), (): void => {
    it('tells the three settlements apart', (): void => {
      const lines: string[] = [
        ResultSettleReason.CONFIRMED_BY_ALL,
        ResultSettleReason.DEADLINE_PASSED,
        ResultSettleReason.NO_CONFIRMATION_NEEDED,
      ].map((settledReason): string => toAcceptedLine(match({ settledReason, state: ResultState.CONFIRMED })));

      const when: string = toLocalDateTime('2026-09-21T09:00:00.000Z');

      expect(lines).toEqual([`Confirmed ${when}`, `Accepted automatically ${when}`, `Confirmed on submission ${when}`]);
    });
  });

  describe(symbolName(toRatingLine), (): void => {
    it('says why a match did not rate, rather than only that it did not', (): void => {
      expect(toRatingLine(match())).toBe('Ratings updated');
      expect(toRatingLine(match({ rating: { rated: false, unratedReason: 'GUEST' } }))).toBe('Unrated (guest)');
      expect(toRatingLine(match({ rating: { rated: false, unratedReason: 'RATINGS_OFF' } }))).toBe(
        'Unrated (ratings are off in this league)',
      );
    });
  });

  describe(symbolName(toDisputeLine), (): void => {
    it('shows the words, or that the words were removed', (): void => {
      const disputed = (note: string | null, redacted: boolean): string =>
        toDisputeLine(
          match({
            dispute: {
              at: '2026-09-21T10:00:00.000Z',
              by: {
                displayName: 'Ben',
                guest: false,
                id: 'Ben',
                member: true,
                removed: false,
              },
              note,
              redacted,
            },
            state: ResultState.DISPUTED,
          }),
        );

      const opening: string = `Disputed by Ben ${toLocalDateTime('2026-09-21T10:00:00.000Z')}`;

      expect(disputed('that was not the score', false)).toBe(`${opening}: that was not the score`);
      expect(disputed(null, true)).toBe(`${opening}: Note removed`);
      // No note and nothing removed: the line ends at the date rather than trailing an empty colon
      expect(disputed(null, false)).toBe(opening);
    });
  });

  describe(symbolName(toResolutionLine), (): void => {
    it('tells each viewer what is still open to them', (): void => {
      const administrator = (amendmentOpen: boolean): string =>
        toResolutionLine(
          match({
            amendmentOpen,
            state: ResultState.DISPUTED,
            viewer: { ...match().viewer, administrator: true },
          }),
        );

      expect(administrator(true)).toBe('Resolve it by amending the result or voiding it.');
      expect(administrator(false)).toBe('Amending is no longer possible; you can void it.');
      expect(toResolutionLine(match({ state: ResultState.DISPUTED }))).toBe(
        'A commissioner or manager will resolve it.',
      );
    });
  });

  describe(symbolName(toRatingCell), (): void => {
    it('distinguishes a change, one that is owed, and one that is never coming', (): void => {
      const rated: IMatchView = match();
      const moved: IMatchViewParticipant = seat('Ada', Side.A, {
        rating: {
          after: 1216.4,
          before: 1200,
          delta: 16.4,
          provisional: false,
        },
      });

      expect(toRatingCell(rated, moved)).toBe('1200 → 1216 (+16)');
      expect(toRatingCell(rated, seat('Ben', Side.B))).toBe('Pending');
      expect(toRatingCell(match({ rating: { rated: false, unratedReason: 'GUEST' } }), moved)).toBe('Unrated');
    });

    it('marks a provisional rating, and signs a loss', (): void => {
      const lost: IMatchViewParticipant = seat('Ben', Side.B, {
        rating: {
          after: 1188,
          before: 1200,
          delta: -12,
          provisional: true,
        },
      });

      expect(toRatingCell(match(), lost)).toBe('1200 → 1188 (-12) · Provisional');
    });
  });

  describe(symbolName(namesOf), (): void => {
    it('names an empty side as nothing rather than as undefined', (): void => {
      expect(namesOf([])).toBe('');
    });
  });
});
