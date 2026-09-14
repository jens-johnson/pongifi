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
 * ██████████████████████████████████████████ #server/utils/leagues/enums.ts ███████████████████████████████████████████
 *
 * Enumerations for account standing and league-entry refusals.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Whether the account a session names can act in league entry.
 * @public
 * @enum
 */
export enum AccountStanding {
  /* A live account that has finished /welcome */
  ACTIVE = 'ACTIVE',

  /* No live account: never existed, or soft-deleted since the session was sealed */
  MISSING = 'MISSING',

  /* A live account that still owes /welcome */
  NEEDS_WELCOME = 'NEEDS_WELCOME',
}

/**
 * Why a league-entry operation wrote nothing. Each maps to one HTTP answer, so handlers never decide status codes
 * themselves.
 * @public
 * @enum
 */
export enum LeagueRefusal {
  /* The session names no live account */
  ACCOUNT_MISSING = 'ACCOUNT_MISSING',

  /* The submission identifier was already used for a different request */
  CONFLICT = 'CONFLICT',

  /* The league's configuration moved between the settings page loading and the save */
  CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED',

  /* The caller is a member but not a commissioner or manager */
  FORBIDDEN = 'FORBIDDEN',

  /* The invite is unknown, dead, or refused for this account; indistinguishable on purpose */
  INVITE_UNAVAILABLE = 'INVITE_UNAVAILABLE',

  /* The league is unknown, or the caller is not an active member; indistinguishable on purpose */
  LEAGUE_NOT_FOUND = 'LEAGUE_NOT_FOUND',

  /* The link named is still the current one, but has passed its expiry or spent its uses, so it cannot be changed */
  LINK_NOT_LIVE = 'LINK_NOT_LIVE',

  /* The account still owes /welcome, which every write requires */
  NEEDS_WELCOME = 'NEEDS_WELCOME',

  /* The caller is a member, but not of the role the settings section being saved requires */
  SECTION_FORBIDDEN = 'SECTION_FORBIDDEN',

  /* A stored setting is outside the limits the editor enforces, so the league cannot be saved as it stands */
  SETTINGS_UNUSABLE = 'SETTINGS_UNUSABLE',

  /* The mutation named a link that is no longer the current one */
  STALE = 'STALE',
}
