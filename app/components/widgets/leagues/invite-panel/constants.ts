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
 * ███████████████████████████████ #components/widgets/leagues/invite-panel/constants.ts ███████████████████████████████
 *
 * Expiry choices, timings and copy for the invite panel.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IInviteExpiryOption } from './types';

/**
 * The expiry choices, always finite (VI.I).
 * @public
 * @constant
 */
export const INVITE_EXPIRY_OPTIONS: readonly IInviteExpiryOption[] = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

/**
 * How long Copied shows after the link is copied, in milliseconds.
 * @public
 * @constant
 */
export const COPIED_VISIBLE_MS: number = 2000;

/**
 * The id of the region the code opens into, named so the control can point `aria-controls` at it.
 * @public
 * @constant
 */
export const INVITE_QR_REGION_ID: string = 'league-invite-qr';

/**
 * Shown when a create, replace or revoke was refused, or could not be confirmed and the re-read shows no change.
 * @public
 * @constant
 */
export const INVITE_UPDATE_FAILED_MESSAGE: string = 'Pongifi could not update the invite link. Try again.';

/**
 * Shown when a replace, a revoke or a QR action named a link that another request had already replaced.
 * @public
 * @constant
 */
export const INVITE_STALE_MESSAGE: string = 'This link was already replaced. The link shown is the current one.';

/**
 * Shown when a replace or revoke named the current link after it had passed its expiry or spent its uses.
 * @public
 * @constant
 */
export const INVITE_NOT_LIVE_MESSAGE: string = 'This link is no longer live. Create a new link to invite players.';

/**
 * Shown under the use limit when it is not a whole number of at least one.
 * @public
 * @constant
 */
export const INVITE_MAX_USES_MESSAGE: string = 'Use a whole number of 1 or more, or leave it empty for no limit.';

/**
 * Shown when the check a QR action makes before it renders or saves anything never got an answer.
 * @public
 * @constant
 */
export const INVITE_QR_UNREAD_MESSAGE: string = 'Pongifi could not check the invite link. Try again.';

/**
 * Shown when the browser cannot draw a code at all, which is the only way a checked, usable link produces nothing.
 * @public
 * @constant
 */
export const INVITE_QR_UNAVAILABLE_MESSAGE: string = 'Pongifi could not draw a QR code for this link.';

/**
 * Shown when a check answers that the viewer no longer runs this league, in place of every control the panel had.
 * @public
 * @constant
 */
export const INVITE_AUTHORITY_LOST_MESSAGE: string =
  'You no longer manage this league, so its invite link is not shown.';

/**
 * How wide one module of a rendered code is, in pixels. Whole pixels, so no module is drawn on a half pixel.
 * @public
 * @constant
 */
export const QR_MODULE_SIZE: number = 8;

/**
 * The quiet space kept clear around a code, in modules. Four is the published minimum a scanner relies on.
 * @public
 * @constant
 */
export const QR_QUIET_MODULES: number = 4;

/**
 * The font the printed captions are drawn in.
 * @public
 * @constant
 */
export const QR_CAPTION_FONT: string = '14px system-ui, sans-serif';

/**
 * The height of one printed caption line, in pixels.
 * @public
 * @constant
 */
export const QR_CAPTION_LINE_HEIGHT: number = 20;

/**
 * The gap between the code's quiet space and the first printed caption line, in pixels.
 * @public
 * @constant
 */
export const QR_CAPTION_GAP: number = 8;

/**
 * How far a printed caption stays clear of each edge, in pixels; a caption wraps inside it rather than clipping.
 * @public
 * @constant
 */
export const QR_CAPTION_INSET: number = 16;

/**
 * What a code is drawn on. A literal rather than a theme token: a code is read by a camera, not by a person, and a
 * dark theme's surface would leave it unscannable.
 * @public
 * @constant
 */
export const QR_BACKGROUND: string = '#ffffff';

/**
 * What a code's modules and captions are drawn in, a literal for the same reason as {@link QR_BACKGROUND}.
 * @public
 * @constant
 */
export const QR_FOREGROUND: string = '#000000';

/**
 * The image a code is rendered as, on screen and in the saved file.
 * @public
 * @constant
 */
export const QR_IMAGE_TYPE: string = 'image/png';

/**
 * What the downloaded file's name ends in, after the league's short mark.
 * @public
 * @constant
 */
export const INVITE_QR_FILE_SUFFIX: string = '-invite.png';

/**
 * What names the downloaded file when a short mark holds nothing a file name can carry.
 * @public
 * @constant
 */
export const INVITE_QR_FALLBACK_NAME: string = 'league';

/**
 * What a downloaded caption calls the day the link stops working.
 * @public
 * @constant
 */
export const INVITE_QR_EXPIRY_PREFIX: string = 'Expires ';

/**
 * How long a download's temporary URL is left in place before it is released, in milliseconds. Long enough that the
 * browser has taken the file, short enough that nothing is held while the page lives.
 * @public
 * @constant
 */
export const DOWNLOAD_RELEASE_MS: number = 1000;
