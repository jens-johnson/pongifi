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
 * █████████████████████████████ #components/widgets/features/formats-diagram/constants.ts █████████████████████████████
 *
 * Accessible descriptions for each format illustration.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { TFeaturesFormat } from './types';

/**
 * Human-readable descriptions keep the changing diagrams useful beyond their visual treatment
 * @public
 * @constant
 */
export const FEATURES_FORMAT_DESCRIPTIONS: Readonly<Record<TFeaturesFormat, string>> = {
  cutthroat:
    'Cutthroat places one server opposite a receiving pair. The three players rotate clockwise, and only the server can score.',
  doubles:
    'Doubles places two players on each side. Numbered paths show the four-player service and receiving rotation.',
  singles: 'Singles places one player on each side, with the rally moving directly across the net.',
};
