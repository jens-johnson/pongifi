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
 * ███████████████████████████████████████████ #shared/leagues/constants.ts ████████████████████████████████████████████
 *
 * Field limits, messages, request allowlists and invite-link rules shared by league entry.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { GameType } from '#shared/rules-engine';

/* ─── League Fields ──────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The longest league name Pongifi stores, in characters. Names are not unique: two offices may both run Friday Ladder.
 * @public
 * @constant
 */
export const LEAGUE_NAME_MAX_LENGTH: number = 60;

/**
 * The longest short mark Pongifi stores, in characters, measured after uppercasing because `leagues.abbreviation` is a
 * `varchar(8)` and uppercasing can lengthen a string.
 * @public
 * @constant
 */
export const LEAGUE_ABBREVIATION_MAX_LENGTH: number = 8;

/**
 * The longest league description Pongifi stores, in characters.
 * @public
 * @constant
 */
export const LEAGUE_DESCRIPTION_MAX_LENGTH: number = 280;

/**
 * The formats a league can play, in the order the create form lists them and the league page names them.
 *
 * Also the canonical order a submitted selection is normalized into, so the same choice made in a different order is
 * the same request
 * @public
 * @constant
 */
export const LEAGUE_GAME_TYPE_ORDER: readonly GameType[] = [GameType.SINGLES, GameType.DOUBLES, GameType.CUTTHROAT];

/**
 * Shown when the league name is missing or only whitespace.
 * @public
 * @constant
 */
export const LEAGUE_NAME_EMPTY_MESSAGE: string = 'Give the league a name.';

/**
 * Shown when the league name exceeds {@link LEAGUE_NAME_MAX_LENGTH}.
 * @public
 * @constant
 */
export const LEAGUE_NAME_TOO_LONG_MESSAGE: string = 'Keep the name to 60 characters.';

/**
 * Shown when the short mark is missing or only whitespace.
 * @public
 * @constant
 */
export const LEAGUE_ABBREVIATION_EMPTY_MESSAGE: string = 'Give the league a short mark.';

/**
 * Shown when the uppercased short mark exceeds {@link LEAGUE_ABBREVIATION_MAX_LENGTH}.
 * @public
 * @constant
 */
export const LEAGUE_ABBREVIATION_TOO_LONG_MESSAGE: string = 'Keep the short mark to 8 characters.';

/**
 * Shown when the description exceeds {@link LEAGUE_DESCRIPTION_MAX_LENGTH}.
 * @public
 * @constant
 */
export const LEAGUE_DESCRIPTION_TOO_LONG_MESSAGE: string = 'Keep the description to 280 characters.';

/**
 * Shown when no format is selected.
 * @public
 * @constant
 */
export const LEAGUE_GAME_TYPES_EMPTY_MESSAGE: string = 'A league plays at least one format.';

/* ─── Request Bodies ─────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The fields `POST /api/leagues` accepts; anything else makes the body malformed.
 * @public
 * @constant
 */
export const CREATE_LEAGUE_BODY_FIELDS: readonly string[] = [
  'abbreviation',
  'allowedGameTypes',
  'description',
  'name',
  'submissionId',
];

/**
 * The fields the invite-link create endpoint accepts. `previousId` is the last link the panel saw, or null when it
 * has never seen one.
 * @public
 * @constant
 */
export const ISSUE_INVITE_BODY_FIELDS: readonly string[] = ['expiresInDays', 'maxUses', 'previousId'];

/**
 * The fields the invite-link replace endpoint accepts; the link being replaced is named by the path.
 * @public
 * @constant
 */
export const REPLACE_INVITE_BODY_FIELDS: readonly string[] = ['expiresInDays', 'maxUses'];

/**
 * Returned when a league or invite request body is not an object of the published shape.
 *
 * The rejected names are deliberately absent: echoing attacker-supplied keys back into a response is how a reflected
 * value ends up rendered somewhere it should not be
 * @public
 * @constant
 */
export const LEAGUE_BODY_MALFORMED_MESSAGE: string = 'The request body does not match what this endpoint accepts.';

/**
 * The status a malformed body is refused with.
 * @public
 * @constant
 */
export const LEAGUE_BODY_REJECTED_STATUS: number = 400;

/**
 * The status a well-formed body carrying an unusable value is refused with.
 * @public
 * @constant
 */
export const LEAGUE_VALUE_REJECTED_STATUS: number = 422;

/* ─── Invite Links ───────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The expiry choices an invite link can be issued with, in days. Always finite: there is no never-expires option.
 * @public
 * @constant
 */
export const INVITE_EXPIRY_DAY_CHOICES: readonly number[] = [1, 7, 30];

/**
 * The expiry an invite link is issued with when nobody chooses another, in days (VI.I).
 * @public
 * @constant
 */
export const DEFAULT_INVITE_EXPIRY_DAYS: number = 7;

/**
 * The largest use limit an invite link can carry; the ceiling of the `integer` column it is stored in.
 * @public
 * @constant
 */
export const INVITE_MAX_USES_CEILING: number = 2_147_483_647;

/**
 * The exact shape of an invite token: 32 random bytes in unpadded base64url, which is always 43 characters.
 *
 * Checked before any lookup, so a malformed token costs no database query and cannot be used to probe for errors
 * @public
 * @constant
 */
export const INVITE_TOKEN_PATTERN: RegExp = /^[\w-]{43}$/;

/**
 * The shape of a league or invitation identifier; a value that does not match is refused before it reaches a query.
 * @public
 * @constant
 */
export const UUID_PATTERN: RegExp = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
