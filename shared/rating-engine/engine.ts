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
 * ██████████████████████████████████████████ #shared/rating-engine/engine.ts ██████████████████████████████████████████
 *
 * The rating engine: pure Elo over finished games, and the chronological replay that rebuilds a run of snapshots.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * rateGame(input) -> IRatingChange[]\nreplayRatings(games, scope, seed?) -> IRatingSnapshotDraft[]
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { ParticipantOutcome, type RatingScope } from '#shared/domain';
import { GameType, Side } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import {
  CUTTHROAT_K_SHARE,
  DAMPENER_GAP_COEFFICIENT,
  DAMPENER_NUMERATOR,
  ELEVATED_K_FACTOR,
  ELEVATED_RATING_THRESHOLD,
  ELO_SCALE,
  ESTABLISHED_K_FACTOR,
  MARGIN_MULTIPLIER_CAP,
  MARGIN_MULTIPLIER_FLOOR,
  PROVISIONAL_K_FACTOR,
  STARTING_RATING,
} from './constants';
import { feedsRatings } from './eligibility';
import type { IRatableGame, IRatedParticipant, IRateGameInput, IRatingChange, IRatingSnapshotDraft } from './types';

/* ─── Elo Primitives ─────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The probability a player of one rating beats a player of another
 * @public
 * @function
 * @param rating - The player's rating
 * @param opponentRating - Their opponent's rating
 * @returns The expected score, between 0 and 1
 */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / ELO_SCALE));
}

/**
 * The K-factor a player's rating moves by. A provisional rating moves fastest, so a newcomer converges on their real
 * level quickly; an elevated one moves slowest, so an established rating is not thrown about by one result
 * @public
 * @function
 * @param rating - The player's current rating
 * @param gamesPlayed - Rated games completed in this scope, before this one
 * @param provisionalGames - How many are needed to leave provisional status
 * @returns The base K-factor
 */
export function kFactor(rating: number, gamesPlayed: number, provisionalGames: number): number {
  if (gamesPlayed < provisionalGames) {
    return PROVISIONAL_K_FACTOR;
  }

  return rating >= ELEVATED_RATING_THRESHOLD ? ELEVATED_K_FACTOR : ESTABLISHED_K_FACTOR;
}

/**
 * How much the margin of victory scales the exchange. An 11-3 and an 11-9 should not move ratings identically, but the
 * effect is damped by the rating gap so a strong player cannot farm rating by running up the score against a weaker
 * one, and it is floored at 1 so a below-margin result cannot zero the exchange
 * @internal
 * @function
 * @param margin - Points separating the winner from the runner-up
 * @param winningMargin - The lead a win required, which is where the multiplier equals one
 * @param winnerRating - The winner's rating
 * @param loserRating - The loser's rating
 * @returns The multiplier applied to each player's base K
 */
function marginMultiplier(margin: number, winningMargin: number, winnerRating: number, loserRating: number): number {
  /**
   * A retirement records the score at the moment of withdrawal, which can leave a margin of one or zero. Taken
   * literally the formula then yields zero and nobody's rating moves, contradicting VIII.VII, so the multiplier is
   * floored at its ordinary-win value
   */
  const raw = Math.log(margin + 1) / Math.log(winningMargin + 1);
  const bounded = Math.max(raw, MARGIN_MULTIPLIER_FLOOR);

  /* Guarded so an implausibly large upset cannot drive the denominator to zero and produce an infinite exchange */
  const denominator = Math.max(
    DAMPENER_GAP_COEFFICIENT * (winnerRating - loserRating) + DAMPENER_NUMERATOR,
    Number.EPSILON,
  );
  const dampener = DAMPENER_NUMERATOR / denominator;

  return Math.min(bounded * dampener, MARGIN_MULTIPLIER_CAP);
}

/* ─── Result Shaping ─────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Builds the change record for one player
 * @internal
 * @function
 * @param participant - The player going in
 * @param delta - How much their rating moved
 * @param provisionalGames - How many rated games leave provisional status
 * @returns The player's rating change
 */
function changeFor(participant: IRatedParticipant, delta: number, provisionalGames: number): IRatingChange {
  const gamesPlayed = participant.gamesPlayed + 1;

  return {
    participantId: participant.participantId,
    ratingBefore: participant.rating,
    ratingAfter: participant.rating + delta,
    delta,
    gamesPlayed,
    isProvisional: gamesPlayed < provisionalGames,
  };
}

/**
 * Splits a singles or doubles field into its two sides
 * @internal
 * @function
 * @param participants - Every player in the game
 * @throws Error when a player carries no side, or a side is empty
 * @returns The players on each side
 */
function bySide(participants: IRatedParticipant[]): Record<Side, IRatedParticipant[]> {
  const sides: Record<Side, IRatedParticipant[]> = { [Side.A]: [], [Side.B]: [] };

  for (const participant of participants) {
    if (!participant.side) {
      throw new Error(`${participant.participantId} has no side; singles and doubles require one.`);
    }

    sides[participant.side].push(participant);
  }

  if (!sides[Side.A].length || !sides[Side.B].length) {
    throw new Error('A singles or doubles game needs players on both sides.');
  }

  return sides;
}

/**
 * A side's rating: one player's in singles, the arithmetic mean of the pair's in doubles. The mean is deliberate — a
 * strong player carrying a weak partner gains little from a win and loses a lot from a defeat, and in a social league
 * that "you are only as good as your pairing" effect is the interesting part rather than a bug (VIII.III)
 * @internal
 * @function
 * @param side - The players on one side
 * @returns The side's rating
 */
function sideRating(side: IRatedParticipant[]): number {
  return side.reduce((total, player) => total + player.rating, 0) / side.length;
}

/* ─── Game Types ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Rates a singles or doubles game. Every player is updated as though they had personally played the opposing side's
 * rating, using their own K but the multiplier the two side ratings produce, so the margin scales the exchange
 * symmetrically while a provisional rating still moves at a provisional speed
 * @internal
 * @function
 * @param input - The game to rate
 * @returns Each player's rating change
 */
function rateSided(input: IRateGameInput): IRatingChange[] {
  const sides = bySide(input.participants);
  const scores = {
    [Side.A]: sides[Side.A][0]!.score,
    [Side.B]: sides[Side.B][0]!.score,
  };
  const ratings = {
    [Side.A]: sideRating(sides[Side.A]),
    [Side.B]: sideRating(sides[Side.B]),
  };

  /**
   * A retirement credits the side that stayed regardless of the scoreboard, so a declared outcome wins over the score.
   * Table tennis has no draws, so where no outcome is declared the higher score took it
   */
  const declared = input.participants.find((participant) => participant.outcome === ParticipantOutcome.WIN)?.side;
  const winner = declared ?? (scores[Side.A] > scores[Side.B] ? Side.A : Side.B);
  const loser = winner === Side.A ? Side.B : Side.A;
  const multiplier = marginMultiplier(
    Math.abs(scores[Side.A] - scores[Side.B]),
    input.winningMargin,
    ratings[winner],
    ratings[loser],
  );

  return input.participants.map((participant) => {
    const side = participant.side!;
    const opposing = side === Side.A ? Side.B : Side.A;
    const actual = Number(side === winner);
    const expected = expectedScore(ratings[side], ratings[opposing]);
    const base = kFactor(participant.rating, participant.gamesPlayed, input.provisionalGames);

    return changeFor(participant, base * multiplier * (actual - expected), input.provisionalGames);
  });
}

/**
 * Rates a cutthroat game on finishing order alone. Margins are ignored on purpose: under server-only scoring a final
 * point total is partly a function of rotation luck, so using it would rate the draw rather than the player
 * (VIII.IV)
 * @internal
 * @function
 * @param input - The game to rate
 * @returns Each player's rating change
 */
function rateCutthroat(input: IRateGameInput): IRatingChange[] {
  const { participants, provisionalGames } = input;

  return participants.map((participant) => {
    const base = kFactor(participant.rating, participant.gamesPlayed, provisionalGames);
    const delta = participants
      .filter((other) => other.participantId !== participant.participantId)
      .reduce((total, other) => {
        /* Players on equal scores share a rank and split the comparison */
        const actual = participant.score === other.score ? 0.5 : Number(participant.score > other.score);
        const expected = expectedScore(participant.rating, other.rating);

        return total + base * CUTTHROAT_K_SHARE * (actual - expected);
      }, 0);

    return changeFor(participant, delta, provisionalGames);
  });
}

/* ─── Public Surface ─────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Rates a single game, returning what it does to every player's rating. Pure: the same game and the same ratings going
 * in always produce the same ratings coming out, which is what makes recomputation reproducible
 * @public
 * @function
 * @param input - The game and the ratings going into it
 * @throws Error when the field does not match the game type
 * @returns Each player's rating change
 */
export function rateGame(input: IRateGameInput): IRatingChange[] {
  if (input.gameType === GameType.CUTTHROAT) {
    if (input.participants.length !== 3) {
      throw new Error(`A cutthroat game needs 3 players; received ${input.participants.length}.`);
    }

    return rateCutthroat(input);
  }

  const expected = input.gameType === GameType.SINGLES ? 2 : 4;

  if (input.participants.length !== expected) {
    throw new Error(`A ${input.gameType} game needs ${expected} players; received ${input.participants.length}.`);
  }

  return rateSided(input);
}

/**
 * Replays a chronological run of games into the snapshots they produce. This is the whole of recomputation: amending or
 * voiding a game invalidates every snapshot from that game forward for the affected players, and Pongifi rebuilds them
 * by handing the affected games back to this function in order. Games that feed nothing are skipped without consuming
 * a rating or advancing anyone's games-played count (VIII.VII, VIII.VIII)
 * @public
 * @function
 * @param games - The games to replay, in chronological order
 * @param scope - Which ladder is being rebuilt
 * @param seed - Ratings and games played to start from; anyone absent starts at the opening rating
 * @returns The snapshots the run produces, in order
 */
export function replayRatings(
  games: IRatableGame[],
  scope: RatingScope,
  seed: Map<string, { rating: number; gamesPlayed: number }> = new Map(),
): IRatingSnapshotDraft[] {
  const standing = new Map(seed);
  const drafts: IRatingSnapshotDraft[] = [];

  for (const game of games) {
    if (!feedsRatings(game.eligibility)) {
      continue;
    }

    const participants = game.participants.map((participant) => {
      const current = standing.get(participant.participantId);

      return {
        ...participant,
        rating: current?.rating ?? STARTING_RATING,
        gamesPlayed: current?.gamesPlayed ?? 0,
      };
    });

    for (const change of rateGame({ ...game, participants })) {
      standing.set(change.participantId, {
        rating: change.ratingAfter,
        gamesPlayed: change.gamesPlayed,
      });
      drafts.push({
        ...change,
        gameId: game.gameId,
        scope,
      });
    }
  }

  return drafts;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names so the unit suites can title their describe blocks from the source symbols
defineSymbol(rateGame, {
  name: 'Rate Game',
  description: 'Computes what one game does to every player’s rating.',
});

defineSymbol(replayRatings, {
  name: 'Replay Ratings',
  description: 'Rebuilds a run of rating snapshots by replaying games in order.',
});
