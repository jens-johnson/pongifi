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
 * ████████████████████████████████ #components/widgets/home/how-it-works/constants.ts █████████████████████████████████
 *
 * Workflow steps and rotation timing for the landing page.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IHowItWorksStep } from './types';

/**
 * Landing page workflow steps in presentation order.
 * @internal
 * @constant
 */
export const STEPS: readonly IHowItWorksStep[] = [
  {
    body: 'Name it, set the rules once, and decide who can record results. Everything after this inherits those settings.',
    icon: 'lucide:trophy',
    label: 'Create a league',
    title: 'Create a league',
  },
  {
    body: 'Share a link or a QR code. They sign in with Google and they are in: no accounts to set up, no passwords to forget.',
    icon: 'lucide:user-plus',
    label: 'Invite your friends',
    title: 'Invite your friends',
  },
  {
    body: 'Score live at the table, or enter a result afterwards. Every game is confirmed by the person you played, so the numbers hold up.',
    icon: 'lucide:clipboard-check',
    label: 'Record games',
    title: 'Record games',
  },
  {
    body: 'Ratings update after every confirmed result. Beat someone better than you and it shows; the ladder settles who is actually best.',
    icon: 'lucide:trending-up',
    label: 'Climb the leaderboard',
    title: 'Climb the leaderboard',
  },
];

/**
 * Milliseconds a workflow step remains visible before automatic advance.
 * @internal
 * @constant
 */
export const DWELL_MS: number = 6000;
