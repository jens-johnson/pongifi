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
 * █████████████████████████████████████ #components/widgets/faq/content/types.ts ██████████████████████████████████████
 *
 * Types for the FAQ groups and their questions.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the FAQ content constants and widget.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * One question and answer within an FAQ group.
 * @public
 * @interface
 */
export interface IFaqQuestion {
  /* The answer shown below the question */
  answer: string;

  /* The stable fragment identifier for direct links */
  id: string;

  /* The question shown as a heading */
  question: string;
}

/**
 * One themed group in the FAQ and its navigation entry.
 * @public
 * @interface
 */
export interface IFaqGroup {
  /* The stable fragment identifier for the group */
  id: string;

  /* The full group heading */
  label: string;

  /* The compact label used in the sticky navigation */
  navigationLabel: string;

  /* The questions shown in the group */
  questions: readonly IFaqQuestion[];
}
