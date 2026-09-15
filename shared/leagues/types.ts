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
 * █████████████████████████████████████████████ #shared/leagues/types.ts ██████████████████████████████████████████████
 *
 * Request, response and validation types for league entry.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { LeagueRole } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type { GameType } from '#shared/rules-engine';

import type { InviteLinkState, InviteLookupKind, SettingsSection } from './enums';

/* ─── Validation ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A rejected field value, carrying the message the form shows beneath the field.
 * @public
 * @interface
 */
export interface IFieldValidationFailure {
  /* The message shown beneath the field */
  message: string;

  /* The value did not satisfy the field's rule */
  ok: false;
}

/**
 * An accepted field value, normalized and ready to store.
 * @public
 * @interface
 */
export interface IFieldValidationSuccess<TValue> {
  /* The value satisfied the field's rule */
  ok: true;

  /* The normalized value to persist */
  value: TValue;
}

/**
 * The result of validating one untrusted field.
 * @public
 */
export type TFieldValidationResult<TValue> = IFieldValidationFailure | IFieldValidationSuccess<TValue>;

/**
 * A rejected request body, carrying both the message and the status it is refused with.
 * @public
 * @interface
 */
export interface IBodyValidationFailure {
  /* The message returned as the status message */
  message: string;

  /* The body did not satisfy the shape rule, the allowlist, or a field rule */
  ok: false;

  /* The HTTP status this particular refusal uses */
  statusCode: number;
}

/**
 * An accepted request body, rebuilt from its known fields.
 * @public
 * @interface
 */
export interface IBodyValidationSuccess<TValue> {
  /* The body satisfied every rule */
  ok: true;

  /* The normalized request */
  value: TValue;
}

/**
 * The result of validating an untrusted request body.
 * @public
 */
export type TBodyValidationResult<TValue> = IBodyValidationFailure | IBodyValidationSuccess<TValue>;

/* ─── Requests ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A normalized create-league request: trimmed, uppercased where the rule says so, formats in canonical order.
 * @public
 * @interface
 */
export interface ICreateLeagueRequest {
  /* The uppercased short mark */
  abbreviation: string;

  /* The formats the league plays, deduplicated and in canonical order */
  allowedGameTypes: GameType[];

  /* The trimmed description, or null when none was given */
  description: string | null;

  /* The trimmed league name */
  name: string;

  /* The identifier the create form generated when it mounted, repeated on every retry from that form */
  submissionId: string;
}

/**
 * The choices an invite link is issued or replaced with.
 * @public
 * @interface
 */
export interface IInviteLinkOptions {
  /* How many days the link stays usable, one of the published choices */
  expiresInDays: number;

  /* How many times the link may be used, or null for no limit */
  maxUses: number | null;
}

/**
 * A request to create an invite link, naming the last link the panel saw so a stale panel cannot rotate a link it has
 * never seen.
 * @public
 * @interface
 */
export interface IIssueInviteRequest extends IInviteLinkOptions {
  /* The last link the panel saw, or null when the league has never had one in the panel's view */
  previousId: string | null;
}

/* ─── Responses ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What a successful create returns; a replay of the same submission returns the same value.
 * @public
 * @interface
 */
export interface ICreateLeagueResponse {
  /* The league the submission created */
  leagueId: string;
}

/**
 * One active member of a league, as the members panel draws them. No email address, by design.
 * @public
 * @interface
 */
export interface ILeagueMember {
  /* The member's Google image, or null when there is none */
  avatarUrl: string | null;

  /* The member's current display name */
  displayName: string;

  /* The membership's identifier, which is stable per league and reveals nothing about the account */
  id: string;

  /* When the member joined, as an ISO string */
  joinedAt: string;

  /* The member's role in the league */
  role: LeagueRole;
}

/**
 * A league as its members see it. Carries no invitation data for anyone: the invite panel reads its own endpoint.
 * @public
 * @interface
 */
export interface ILeagueDetail {
  /* The league's short mark */
  abbreviation: string;

  /* The revision the settings page loads at and every save from it carries */
  configurationRevision: number;

  /* The league's description, or null when it has none */
  description: string | null;

  /* The league's identifier */
  id: string;

  /* The active members, commissioners first, then managers, then players, each group by join date */
  members: ILeagueMember[];

  /* The league's name */
  name: string;

  /* The league's stored settings, drawn read-only */
  settings: TLeagueSettings;

  /* The signed-in viewer's own role */
  viewerRole: LeagueRole;
}

/**
 * A league's current or most recent shareable invite link, as the invite panel draws it.
 * @public
 * @interface
 */
export interface IInviteLink {
  /* When the link stops working, as an ISO string; null only for a link issued without expiry, which Pongifi never does */
  expiresAt: string | null;

  /* The duration the link was issued with, so a replacement can be prefilled with it */
  expiresInDays: number;

  /* The invitation's identifier, which every mutation names */
  id: string;

  /* How many times the link may be used, or null for no limit */
  maxUses: number | null;

  /* Whether the link can still be used, and if not, why */
  state: InviteLinkState;

  /* The token, only while the link is usable; a retired link is shown without anything to copy */
  token: string | null;

  /* How many people have joined through it */
  useCount: number;
}

/**
 * The invite panel's state: the current or most recent shareable link, or null when the league has never had one.
 * @public
 * @interface
 */
export interface IInvitePanel {
  /* The link, or null when none has ever been issued */
  link: IInviteLink | null;
}

/**
 * The summary a usable invite shows a visitor who is not yet a member: exactly the reviewed allowlist.
 * @public
 * @interface
 */
export interface IInviteSummary {
  /* The inviter's current display name */
  inviterName: string;

  /* The lookup found a usable invite */
  kind: InviteLookupKind.INVITE;

  /* The league's name */
  leagueName: string;

  /* How many people are active members */
  memberCount: number;
}

/**
 * The answer an invite lookup gives an active member: where their league is, whether or not the link still works.
 * @public
 * @interface
 */
export interface IInviteMembership {
  /* The lookup found the visitor's own league */
  kind: InviteLookupKind.MEMBER;

  /* The league to go to */
  leagueId: string;
}

/**
 * What an invite lookup returns when the invite is usable or the visitor is already a member.
 * @public
 */
export type TInviteLookup = IInviteMembership | IInviteSummary;

/**
 * What a successful or already-satisfied acceptance returns.
 * @public
 * @interface
 */
export interface IAcceptInviteResponse {
  /* The league the visitor is now an active member of */
  leagueId: string;
}

/**
 * The body every not-found answer in league entry carries, identical whatever was actually missing.
 * @public
 * @interface
 */
export interface INotFoundResponse {
  /* The generic message */
  message: string;

  /* Always 404 */
  statusCode: number;
}

/**
 * The body a stale settings save is refused with: the configuration as it now stands, in the shape a successful save
 * returns, plus the message.
 *
 * The page needs the current values to show beside its draft, and the operation has already read them to tell a moved
 * revision from a lost membership, so carrying them here spares the page a second request — and spares it the one state
 * it has no copy for, a definite refusal whose follow-up read failed
 * @public
 * @interface
 */
export interface IStaleConfigurationResponse extends ILeagueConfiguration {
  /* Why the save was refused */
  message: string;

  /* Always 409 */
  statusCode: number;
}

/**
 * The three league-profile fields the Identity section saves. They are columns on the league rather than settings.
 * @public
 * @interface
 */
export interface ILeagueIdentity {
  /* The uppercased short mark */
  abbreviation: string;

  /* The trimmed description, or null when it was cleared */
  description: string | null;

  /* The trimmed name */
  name: string;
}

/**
 * One validated settings-page save: the section, the revision the page loaded at, and that section's values.
 *
 * Exactly one of `identity` and `settings` carries anything, decided by the section
 * @public
 * @interface
 */
export interface ISaveSettingsRequest {
  /* The profile fields, for the Identity section only */
  identity: ILeagueIdentity | null;

  /* The revision the page loaded at, which the write is checked against */
  revision: number;

  /* The section being saved */
  section: SettingsSection;

  /* The settings this section owns, for every section but Identity */
  settings: Partial<TLeagueSettings>;
}

/**
 * A league's saveable configuration as the server persisted it: the profile fields, the settings, and the revision the
 * next save must carry.
 *
 * Returned by a save rather than echoing what was submitted, so the page adopts what is stored rather than what it
 * hoped for, and returned again with a refused save so a stale section can show current values beside its draft
 * @public
 * @interface
 */
export interface ILeagueConfiguration {
  /* The stored short mark */
  abbreviation: string;

  /* The revision this configuration is at; the next save carries it */
  configurationRevision: number;

  /* The stored description, or null */
  description: string | null;

  /* The stored name */
  name: string;

  /* The stored settings */
  settings: TLeagueSettings;
}
