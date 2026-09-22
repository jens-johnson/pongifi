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
 * ██████████████████████████████████████████ #utils/results/record/types.ts ███████████████████████████████████████████
 *
 * The Record form's own shapes, which are drafts rather than submissions.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { Seat } from '#shared/results';
import type { GameType } from '#shared/rules-engine';

/**
 * One seat as the form holds it.
 *
 * A member or a guest, never both, and neither until somebody chooses. Held as a draft rather than as a submission
 * seat because a half-filled seat is a normal state of a form and not a shape the server would take
 * @public
 */
export interface IRecordSeat {
  /* The guest's name as typed, when this seat holds a guest */
  guestName: string | null;

  /* The seat this is */
  seat: Seat;

  /* The member in it, when this seat holds one */
  userId: string | null;
}

/**
 * One game's row as the form holds it.
 *
 * The scores are the strings the inputs carry, not numbers: a box somebody has not finished typing in is empty
 * rather than zero, and `type="number"` would silently make one the other
 * @public
 */
export interface IRecordRow {
  /* Side A's score, as typed */
  a: string;

  /* Side B's score, as typed */
  b: string;
}

/**
 * The whole form, as it stands
 * @public
 */
export interface IRecordDraft {
  /* Whether the match was played out or ended in a withdrawal */
  ending: 'COMPLETED' | 'RETIRED';

  /* How many games were played, when it ended in a withdrawal */
  gamesPlayed: number;

  /* Which format is being recorded */
  gameType: GameType;

  /* When it was played, as the input carries it */
  playedAt: string;

  /* The seat that withdrew, when it ended in one */
  retiredSeat: Seat | null;

  /* The games, in order */
  rows: IRecordRow[];

  /* The seats, in canonical order */
  seats: IRecordSeat[];
}

/**
 * Everything the form is refusing at the moment, addressed to where it is shown.
 *
 * Separated by where it belongs rather than as one list, because the spec puts a row's message under that row, a
 * seat's under that seat, and the match-level ones above Save
 * @public
 */
export interface IRecordProblems {
  /* What is wrong above Save, or null */
  match: string | null;

  /* What is wrong with the play time, or null */
  playedAt: string | null;

  /* What is wrong with each row, by index; a row with nothing wrong is absent */
  rows: Record<number, string>;

  /* What is wrong with each seat, by seat; a seat with nothing wrong is absent */
  seats: Partial<Record<Seat, string>>;
}

/**
 * Who is recording, as the form's checks need to know them
 * @public
 */
export interface IRecordRecorder {
  /* Whether this league only lets a participant record, so the recorder must hold a seat */
  mustPlay: boolean;

  /**
   * What to call a member.
   *
   * Passed in rather than looked up here: the roster belongs to the page, and a message that named an id instead
   * of a person would be no use to whoever has to change the seat
   */
  nameOf: (userId: string) => string;

  /* The account doing the recording */
  userId: string;
}

/**
 * What to call each side, for the line under the rows
 * @public
 */
export interface IRecordSideNames {
  /* Side A */
  a: string;

  /* Side B */
  b: string;
}
