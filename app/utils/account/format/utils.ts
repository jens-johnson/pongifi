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
 * ██████████████████████████████████████████ #utils/account/format/utils.ts ███████████████████████████████████████████
 *
 * Display formatting for the account surfaces: initials, dates and role labels.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { defineSymbol } from '#shared/utils/symbol';

/**
 * The most initials shown in an avatar; three letters stop reading as initials and start reading as a word
 * @internal
 * @constant
 */
const MAX_INITIALS: number = 2;

/**
 * Builds the avatar fallback shown when Google supplied no picture.
 *
 * Takes the first character of the first and last whitespace-separated parts, so "Maya Rodriguez" gives MR and a
 * middle name is skipped rather than crowding the circle. Falls back to a single character, and then to nothing,
 * because a display name can be one word or a single emoji and neither should render as a broken avatar
 * @public
 * @function
 * @param displayName - The player's display name
 * @returns Up to two uppercase initials, or an empty string when none can be taken
 */
export function toInitials(displayName: string): string {
  const parts: string[] = displayName.trim().split(/\s+/u).filter(Boolean);

  if (parts.length === 0) {
    return '';
  }

  const first: string = [...parts[0]!][0] ?? '';

  if (parts.length === 1) {
    return first.toUpperCase();
  }

  const last: string = [...parts.at(-1)!][0] ?? '';

  return `${first}${last}`.toUpperCase().slice(0, MAX_INITIALS);
}

/**
 * Renders an ISO timestamp as the month and year shown beside "member since" and "joined".
 *
 * A day would imply a precision the surface does not need, and a bare year reads as a guess
 * @public
 * @function
 * @param iso - The timestamp as the API returned it
 * @returns The month and year, or an empty string when the value is not a usable date
 */
export function toMonthYear(iso: string): string {
  const date: Date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * Title-cases a schema enum member for display, so COMMISSIONER reads as Commissioner.
 * @public
 * @function
 * @param role - The membership role as the schema stores it
 * @returns The role in title case
 */
export function toRoleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suite can title its describe blocks from the source symbols
defineSymbol(toInitials, {
  name: 'To Initials',
  description: 'Builds the avatar fallback initials from a display name.',
});

defineSymbol(toMonthYear, {
  name: 'To Month And Year',
  description: 'Renders an ISO timestamp as the month and year shown on account surfaces.',
});

defineSymbol(toRoleLabel, {
  name: 'To Role Label',
  description: 'Title-cases a membership role for display.',
});
