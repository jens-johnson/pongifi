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
 * ███████████████████████████████████ #components/widgets/faq/content/constants.ts ████████████████████████████████████
 *
 * Reviewed FAQ copy, routes, and navigation settings.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the FAQ content widget.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IFaqGroup } from './types';

/**
 * The contact destination shared with the About page.
 * @public
 * @constant
 */
export const FAQ_CONTACT_URL: string = 'mailto:jens@jens-johnson.com';

/**
 * The five FAQ groups and their reviewed public answers.
 * @public
 * @constant
 */
export const FAQ_GROUPS: readonly IFaqGroup[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    navigationLabel: 'Getting started',
    questions: [
      {
        answer:
          'To play in a league and carry a rating, yes. Someone with an account can also seat you as a guest for a one-off game. Once the result is accepted, that game counts towards points and win and loss, but a game with a guest in it is unrated for everyone who played it.',
        id: 'do-i-need-an-account',
        question: 'Do I need an account?',
      },
      {
        answer: 'No. Pongifi runs in the browser on a phone, tablet or laptop.',
        id: 'do-i-need-to-install-anything',
        question: 'Do I need to install anything?',
      },
      {
        answer: 'Two. A league of two is just a rivalry with a scoreboard, which is a perfectly good reason to use it.',
        id: 'how-many-people-do-i-need-to-start-a-league',
        question: 'How many people do I need to start a league?',
      },
      {
        answer: 'No. Pongifi cares about the scoring, not the furniture.',
        id: 'do-i-need-a-regulation-table',
        question: 'Do I need a regulation table?',
      },
    ],
  },
  {
    id: 'recording',
    label: 'Recording Games',
    navigationLabel: 'Recording',
    questions: [
      {
        answer:
          "No. You can score live at the table, or enter the result afterwards. Live scoring is the fuller record and is the only way to get rally-level statistics, since those need the sequence rather than the final score. Both recording modes can contribute to records and statistics once the result is accepted; ratings and individual statistics still follow the game's eligibility rules.",
        id: 'do-i-have-to-score-point-by-point',
        question: 'Do I have to score point by point?',
      },
      {
        answer:
          "If your league asks for confirmation, an unconfirmed result is accepted automatically once the league's confirmation window has passed, so one unresponsive person cannot hold up the standings. A league can also switch confirmation off, in which case results count as soon as they are recorded.",
        id: 'what-if-my-opponent-never-confirms-the-result',
        question: 'What if my opponent never confirms the result?',
      },
      {
        answer:
          'Either of you can dispute it. A disputed result is not deleted. It stays on the record and stops counting until it is sorted out.',
        id: 'what-if-we-disagree-about-the-score',
        question: 'What if we disagree about the score?',
      },
      {
        answer: "Yes, within the league's amendment window. After that it needs someone with the right role.",
        id: 'i-recorded-the-wrong-score-can-i-fix-it',
        question: 'I recorded the wrong score. Can I fix it?',
      },
      {
        answer:
          "Yes, as a guest. Once the result is accepted, the game counts towards points and win and loss, but it never moves anyone's rating, including the players who do have accounts.",
        id: 'can-someone-without-an-account-play',
        question: 'Can someone without an account play?',
      },
    ],
  },
  {
    id: 'ratings',
    label: 'Ratings And Standings',
    navigationLabel: 'Ratings',
    questions: [
      {
        answer:
          'It is Elo-derived. Beating someone rated above you moves you more than beating someone below you, and losing to someone below you costs more than losing to someone above. In singles and doubles the margin of victory counts too, up to a cap, so a heavy win means more than a narrow one without letting blowouts be farmed. Cutthroat is rated on finishing order alone.',
        id: 'how-does-the-rating-work',
        question: 'How does the rating work?',
      },
      {
        answer:
          'One of these will be why: the result is not confirmed yet, someone in the game was a guest, the league has ratings turned off, the game was marked unrated, the game was a walkover, or the game has not reached a state that counts.',
        id: 'why-didnt-my-rating-move',
        question: "Why didn't my rating move?",
      },
      {
        answer:
          'Your first few games move your rating faster than normal while it finds roughly the right level. How many games that takes is a league setting.',
        id: 'what-does-provisional-mean',
        question: 'What does "provisional" mean?',
      },
      {
        answer:
          'No. Singles, doubles and cutthroat are rated separately, and there is an overall rating alongside them. Being excellent at cutthroat says very little about your singles game.',
        id: 'is-my-doubles-rating-the-same-as-my-singles-rating',
        question: 'Is my doubles rating the same as my singles rating?',
      },
      {
        answer: 'No. Only results do. Volume moves you up the games-played column and nowhere else.',
        id: 'does-playing-more-games-improve-my-rating',
        question: 'Does playing more games improve my rating?',
      },
    ],
  },
  {
    id: 'leagues',
    label: 'Leagues, Roles And Privacy',
    navigationLabel: 'Leagues',
    questions: [
      {
        answer:
          'Leagues are private by default. You can choose to make one discoverable if you want people to find and join it.',
        id: 'who-can-see-my-league',
        question: 'Who can see my league?',
      },
      {
        answer: 'That is a league setting: either any player, or only managers. Same for who can create games.',
        id: 'who-is-allowed-to-record-results',
        question: 'Who is allowed to record results?',
      },
      {
        answer:
          'Within reason, yes. A league sets its target score, winning margin, service interval, match length, whether the expedite system is used, and the cutthroat time cap.',
        id: 'can-we-play-our-own-house-rules',
        question: 'Can we play our own house rules?',
      },
      {
        answer: 'Yes. A league can turn rating off entirely and still keep standings, results and statistics.',
        id: 'can-we-use-pongifi-without-ratings',
        question: 'Can we use Pongifi without ratings?',
      },
    ],
  },
  {
    id: 'rules',
    label: 'The Rules',
    navigationLabel: 'Rules',
    questions: [
      {
        answer:
          "The ITTF's, as the baseline, with league settings layered on top for the things every group does differently.",
        id: 'whose-rules-does-pongifi-follow',
        question: 'Whose rules does Pongifi follow?',
      },
      {
        answer:
          'A rule for games that stall: once it is introduced, the receiver wins the point if the server fails to finish the rally within a set number of returns. It is a league setting, so you can leave it off.',
        id: 'what-is-the-expedite-system',
        question: 'What is the expedite system?',
      },
      {
        answer:
          'The 1v1v1 house game. It is not an ITTF format, but one that almost every office plays. Pongifi supports it as a first-class format with its own rotation, its own optional time cap, and its own rating ladder.',
        id: 'what-is-cutthroat',
        question: 'What is cutthroat?',
      },
      {
        answer:
          'In singles and doubles the score at that moment stands and the side that stayed is credited with the win. In cutthroat the player leading when play stopped takes the game. An accepted retirement can count toward ratings when the game is otherwise eligible; guest games, unrated games and leagues with ratings disabled remain unrated.',
        id: 'what-happens-if-someone-retires-mid-match',
        question: 'What happens if someone retires mid-match?',
      },
      {
        answer:
          "After the league's grace period it is recorded as a walkover. Once accepted, that counts towards win and loss, but it does not move ratings. No table tennis was played.",
        id: 'what-if-someone-doesnt-turn-up',
        question: "What if someone doesn't turn up?",
      },
    ],
  },
];

/**
 * The viewport band that decides which FAQ group is active.
 * @public
 * @constant
 */
export const TOP_THIRD_BAND: string = '-32% 0px -66% 0px';
