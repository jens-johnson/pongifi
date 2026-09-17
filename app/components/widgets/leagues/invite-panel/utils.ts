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
 * █████████████████████████████████ #components/widgets/leagues/invite-panel/utils.ts █████████████████████████████████
 *
 * The invite panel's write settlement, and the QR code it draws from a link.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { QrCodeGenerateResult } from 'uqr';
import { encode } from 'uqr';

import type { IInviteLink } from '#shared/leagues';
import { InviteLinkState } from '#shared/leagues';
import { defineSymbol } from '#shared/utils/symbol';
import { toDayMonthYear } from '~/utils/leagues/display';
import { WriteFailure } from '~/utils/leagues/write-failure';

import {
  INVITE_NOT_LIVE_MESSAGE,
  INVITE_QR_EXPIRY_PREFIX,
  INVITE_QR_FALLBACK_NAME,
  INVITE_QR_FILE_SUFFIX,
  INVITE_STALE_MESSAGE,
  INVITE_UPDATE_FAILED_MESSAGE,
  QR_BACKGROUND,
  QR_CAPTION_FONT,
  QR_CAPTION_GAP,
  QR_CAPTION_INSET,
  QR_CAPTION_LINE_HEIGHT,
  QR_FOREGROUND,
  QR_IMAGE_TYPE,
  QR_MODULE_SIZE,
  QR_QUIET_MODULES,
} from './constants';

/**
 * Settles a write the panel has already re-read after into the one alert it shows.
 *
 * A conflict and a dead link are both definite and both leave the panel showing something other than what the caller
 * acted on, so each says which it was: a conflict points at the link that replaced the one named, while a link that
 * ran out of time or uses was never replaced and no re-read can revive it. Every other answer may have written, so it
 * alerts only when the re-read shows nothing moved
 * @public
 * @function
 * @param failure - How the answer was read
 * @param changed - Whether the re-read returned a different link than the one the write was sent against
 * @returns The alert to show, or null when the re-read already told the story
 */
export function settleInviteWrite(failure: WriteFailure, changed: boolean): string | null {
  if (failure === WriteFailure.GONE) {
    return INVITE_NOT_LIVE_MESSAGE;
  }

  if (failure === WriteFailure.CONFLICT) {
    return INVITE_STALE_MESSAGE;
  }

  return changed ? null : INVITE_UPDATE_FAILED_MESSAGE;
}

/**
 * The characters a short mark may leave in a file name; everything else becomes a separator.
 * @internal
 * @constant
 */
const FILE_NAME_KEEP: RegExp = /[^A-Za-z0-9]+/gu;

/**
 * The separators a file name is not left opening or closing on.
 * @internal
 * @constant
 */
const FILE_NAME_EDGES: RegExp = /^-+|-+$/gu;

/**
 * Splits a caption into the widest lines that fit, breaking a single word that fits on no line at all.
 * @internal
 * @function
 * @param context - The context the caption is measured in, already carrying its font
 * @param caption - The caption
 * @param maxWidth - The width a line may not exceed
 * @returns The lines, in order
 */
function wrapCaption(context: CanvasRenderingContext2D, caption: string, maxWidth: number): string[] {
  const words: string[] = caption.split(/\s+/u).filter((word: string): boolean => word.length > 0);

  return words
    .flatMap((word: string): string[] =>
      context.measureText(word).width <= maxWidth ? [word] : breakWord(context, word, maxWidth),
    )
    .reduce((lines: string[], word: string): string[] => {
      const line: string | undefined = lines.at(-1);

      if (line !== undefined && context.measureText(`${line} ${word}`).width <= maxWidth) {
        lines[lines.length - 1] = `${line} ${word}`;

        return lines;
      }

      lines.push(word);

      return lines;
    }, []);
}

/**
 * Cuts a word no line can hold into the widest pieces that fit, so a long league name wraps rather than clipping.
 * @internal
 * @function
 * @param context - The context the word is measured in
 * @param word - The word
 * @param maxWidth - The width a piece may not exceed
 * @returns The pieces, in order
 */
function breakWord(context: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  return Array.from(word).reduce((pieces: string[], character: string): string[] => {
    const piece: string | undefined = pieces.at(-1);

    if (piece !== undefined && context.measureText(`${piece}${character}`).width <= maxWidth) {
      pieces[pieces.length - 1] = `${piece}${character}`;

      return pieces;
    }

    pieces.push(character);

    return pieces;
  }, []);
}

/**
 * Fills the dark modules of a code, inset by its quiet space.
 * @internal
 * @function
 * @param context - The context to draw on
 * @param code - The encoded code
 */
function drawModules(context: CanvasRenderingContext2D, code: QrCodeGenerateResult): void {
  context.fillStyle = QR_FOREGROUND;

  code.data.forEach((row: boolean[], y: number): void => {
    row.forEach((dark: boolean, x: number): void => {
      if (dark) {
        context.fillRect(
          (x + QR_QUIET_MODULES) * QR_MODULE_SIZE,
          (y + QR_QUIET_MODULES) * QR_MODULE_SIZE,
          QR_MODULE_SIZE,
          QR_MODULE_SIZE,
        );
      }
    });
  });
}

/**
 * Prints the caption lines under the code, centred, outside its quiet space.
 * @internal
 * @function
 * @param context - The context to draw on
 * @param lines - The wrapped lines
 * @param codeSize - The width and height the code itself occupies
 */
function drawCaptions(context: CanvasRenderingContext2D, lines: readonly string[], codeSize: number): void {
  context.fillStyle = QR_FOREGROUND;
  context.font = QR_CAPTION_FONT;
  context.textAlign = 'center';
  context.textBaseline = 'top';

  lines.forEach((line: string, index: number): void => {
    context.fillText(line, codeSize / 2, codeSize + QR_CAPTION_GAP + index * QR_CAPTION_LINE_HEIGHT);
  });
}

/**
 * Draws an invite link as a scannable code, with any caption lines printed beneath it.
 *
 * One path serves the screen and the saved file: the on-screen code passes no captions, and the download passes the
 * league and the expiry a saved image has to carry on its own. The code is encoded from the URL string in this
 * browser; nothing about the token leaves the page
 * @public
 * @function
 * @param url - The exact link the code encodes
 * @param captions - The lines to print under it, or none
 * @returns The canvas, or null when this browser draws no canvas at all
 */
export function drawInviteQr(url: string, captions: readonly string[]): HTMLCanvasElement | null {
  const code: QrCodeGenerateResult = encode(url);
  const codeSize: number = (code.size + QR_QUIET_MODULES * 2) * QR_MODULE_SIZE;
  const canvas: HTMLCanvasElement = document.createElement('canvas');

  canvas.width = codeSize;

  const measuring: CanvasRenderingContext2D | null = canvas.getContext('2d');

  if (measuring === null) {
    return null;
  }

  measuring.font = QR_CAPTION_FONT;

  const lines: string[] = captions.flatMap((caption: string): string[] =>
    wrapCaption(measuring, caption, codeSize - QR_CAPTION_INSET * 2),
  );

  // Sizing a canvas resets its context, so the height is settled before anything is drawn on it
  // The gap is counted twice: once above the first printed line, once under the last, so nothing sits on an edge
  canvas.height = codeSize + (lines.length === 0 ? 0 : QR_CAPTION_GAP * 2 + lines.length * QR_CAPTION_LINE_HEIGHT);

  const context: CanvasRenderingContext2D | null = canvas.getContext('2d');

  if (context === null) {
    return null;
  }

  context.fillStyle = QR_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawModules(context, code);
  drawCaptions(context, lines, codeSize);

  return canvas;
}

/**
 * Reads a drawn code back as a file.
 * @public
 * @function
 * @param canvas - The canvas the code was drawn on
 * @returns The file, or null when this browser cannot produce one
 */
export async function toInviteQrFile(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof canvas.toBlob !== 'function') {
    return null;
  }

  return new Promise((resolve: (file: Blob | null) => void): void => {
    canvas.toBlob(resolve, QR_IMAGE_TYPE);
  });
}

/**
 * The lines printed under a downloaded code.
 *
 * A saved image cannot be recalled, so it carries the day its code stops working; a link the API returned without a
 * usable date says nothing rather than saying nothing useful
 * @public
 * @function
 * @param leagueName - The league's name
 * @param link - The link the code encodes
 * @returns The lines, in print order
 */
export function toInviteQrCaptions(leagueName: string, link: IInviteLink): string[] {
  const expiry: string = toDayMonthYear(link.expiresAt);

  return expiry === '' ? [leagueName] : [leagueName, `${INVITE_QR_EXPIRY_PREFIX}${expiry}`];
}

/**
 * The name a downloaded code is saved under.
 *
 * A short mark is stored uppercased but is otherwise the commissioner's own text, so anything a path could read is
 * replaced before it names a file
 * @public
 * @function
 * @param abbreviation - The league's short mark
 * @returns `OFF-invite.png`
 */
export function toInviteQrFileName(abbreviation: string): string {
  const stem: string = abbreviation.replace(FILE_NAME_KEEP, '-').replace(FILE_NAME_EDGES, '');

  return `${stem === '' ? INVITE_QR_FALLBACK_NAME : stem}${INVITE_QR_FILE_SUFFIX}`;
}

/**
 * Which link a drawn code belongs to, or an empty key when there is no link a code could encode.
 *
 * Identity and usability only: a link whose use count has moved is still the same link, and redrawing a code because
 * somebody joined would be noise
 * @public
 * @function
 * @param link - The link, or null
 * @returns The key
 */
export function toInviteQrLinkKey(link: IInviteLink | null): string {
  return link !== null && link.state === InviteLinkState.USABLE && (link.token ?? '') !== ''
    ? `${link.id}:${link.token}`
    : '';
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description so the unit suite can title its describe block from the source symbol
defineSymbol(settleInviteWrite, {
  name: 'Settle Invite Write',
  description: 'Resolves a re-read invite write into the one alert the panel shows.',
});

defineSymbol(drawInviteQr, {
  name: 'Draw Invite QR',
  description: 'Draws an invite link as a scannable code, with any captions printed beneath it.',
});

defineSymbol(toInviteQrFile, {
  name: 'To Invite QR File',
  description: 'Reads a drawn code back as a file.',
});

defineSymbol(toInviteQrCaptions, {
  name: 'To Invite QR Captions',
  description: 'The lines printed under a downloaded code.',
});

defineSymbol(toInviteQrFileName, {
  name: 'To Invite QR File Name',
  description: 'The name a downloaded code is saved under.',
});

defineSymbol(toInviteQrLinkKey, {
  name: 'To Invite QR Link Key',
  description: 'Which link a drawn code belongs to.',
});
