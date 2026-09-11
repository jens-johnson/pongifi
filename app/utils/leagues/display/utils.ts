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
 * ██████████████████████████████████████████ #utils/leagues/display/utils.ts ██████████████████████████████████████████
 *
 * Words for league settings, invite link status, member counts and dates.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { TLeagueSettings } from '#shared/league-settings';
import type { IInviteLink } from '#shared/leagues';
import { InviteLinkState, LEAGUE_GAME_TYPE_ORDER } from '#shared/leagues';
import { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';

import { DISPLAY_DATE_LOCALE, GAME_TYPE_LABELS } from './constants';

/**
 * Renders an ISO timestamp as day, month and year.
 * @public
 * @function
 * @param iso - The timestamp as the API returned it
 * @returns The date, or an empty string when the value is not a usable date
 */
export function toDayMonthYear(iso: string | null): string {
  const date: Date = new Date(iso ?? '');

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(DISPLAY_DATE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Says how many people play in a league, for the invite summary.
 * @public
 * @function
 * @param count - The number of active members
 * @returns The sentence, singular or plural
 */
export function describeMemberCount(count: number): string {
  return count === 1 ? '1 person plays here.' : `${count} people play here.`;
}

/**
 * Says how many times a link has been used against its limit.
 * @internal
 * @function
 * @param link - The link
 * @returns `used 2 of 5`, or `used 3 times` when there is no limit
 */
function describeUses(link: IInviteLink): string {
  if (link.maxUses !== null) {
    return `used ${link.useCount} of ${link.maxUses}`;
  }

  return link.useCount === 1 ? 'used 1 time' : `used ${link.useCount} times`;
}

/**
 * The line the invite panel shows under a usable link, or above the controls when the last link is no longer usable.
 *
 * A usable link gets its expiry and uses. A retired one gets a plain status line with no URL: exhausted shows its uses,
 * expired its date and uses, and revoked nothing more, because the schema records no revocation time
 * @public
 * @function
 * @param link - The current or most recent link
 * @returns The line
 */
export function describeInviteLink(link: IInviteLink): string {
  const uses: string = describeUses(link);

  switch (link.state) {
    case InviteLinkState.USABLE: {
      const limit: string = link.maxUses === null ? ' · no limit' : '';

      return `Expires ${toDayMonthYear(link.expiresAt)}. ${uses.charAt(0).toUpperCase()}${uses.slice(1)}${limit}`;
    }

    case InviteLinkState.EXHAUSTED: {
      return `Last link: ${uses}`;
    }

    case InviteLinkState.EXPIRED: {
      return `Last link: expired ${toDayMonthYear(link.expiresAt)} · ${uses}`;
    }

    default: {
      return 'Last link: revoked';
    }
  }
}

/**
 * Describes how a league plays, in four read-only lines naming values rather than settings keys.
 *
 * Formats; scoring (targets, margin and, where a match format applies, best of); how results are accepted; ratings.
 * Cutthroat is always a single game, so best-of is only mentioned when singles or doubles are played
 * @public
 * @function
 * @param settings - The league's stored settings
 * @returns The lines, in display order
 */
export function describeLeagueSettings(settings: TLeagueSettings): string[] {
  const allowed: GameType[] = LEAGUE_GAME_TYPE_ORDER.filter((gameType: GameType): boolean =>
    settings.allowedGameTypes.includes(gameType),
  );
  const paired: GameType[] = allowed.filter((gameType: GameType): boolean => gameType !== GameType.CUTTHROAT);
  const sameTarget: boolean =
    paired.length === 2 && settings.targetScore[GameType.SINGLES] === settings.targetScore[GameType.DOUBLES];

  // Singles and doubles to the same score read as one phrase; otherwise each format names its own
  const targets: string[] = sameTarget
    ? [`games to ${settings.targetScore[GameType.SINGLES]}`]
    : paired.map(
        (gameType: GameType): string =>
          `${GAME_TYPE_LABELS[gameType].toLowerCase()} to ${settings.targetScore[gameType]}`,
      );

  if (allowed.includes(GameType.CUTTHROAT)) {
    targets.push(`cutthroat to ${settings.targetScore[GameType.CUTTHROAT]}`);
  }

  const scoring: string = targets.join(', ');
  const bestOf: string = paired.length > 0 ? ` Best of ${settings.matchFormat}.` : '';

  const results: string = settings.requireConfirmation
    ? `Results: confirmed by the other players, or accepted automatically after ${settings.resultConfirmationWindow} hours if nobody disputes.`
    : 'Results: accepted as recorded.';

  const ratings: string = settings.ratingEnabled
    ? `Ratings: on, provisional for the first ${settings.provisionalGames} games.`
    : 'Ratings: off.';

  return [
    `Formats: ${allowed.map((gameType: GameType): string => GAME_TYPE_LABELS[gameType]).join(', ')}`,
    `${scoring.charAt(0).toUpperCase()}${scoring.slice(1)}. Win by ${settings.winningMargin}.${bestOf}`,
    results,
    ratings,
  ];
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(toDayMonthYear, {
  name: 'To Day Month Year',
  description: 'Renders an ISO timestamp as day, month and year.',
});

defineSymbol(describeMemberCount, {
  name: 'Describe Member Count',
  description: 'Says how many people play in a league.',
});

defineSymbol(describeInviteLink, {
  name: 'Describe Invite Link',
  description: "The invite panel's line for a usable or retired link.",
});

defineSymbol(describeLeagueSettings, {
  name: 'Describe League Settings',
  description: 'Describes how a league plays in four read-only lines.',
});
