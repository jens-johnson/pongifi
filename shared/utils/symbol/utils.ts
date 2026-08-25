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
 * ███████████████████████████████████████████ #shared/utils/symbol/utils.ts ███████████████████████████████████████████
 *
 * A tiny registry attaching a readable name and description to a function, so test suites can title themselves from the
 * source symbol.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ISymbolMetadata } from './types';

/**
 * The registry mapping a symbol (function, class) to its human-readable metadata
 * @internal
 * @constant
 */
const SYMBOL_METADATA: WeakMap<object, ISymbolMetadata> = new WeakMap<object, ISymbolMetadata>();

/**
 * Registers human-readable metadata (a readable name and optional description) for an exported symbol, then returns
 * the symbol unchanged so it can wrap a declaration or be called beside one. Consumers read it back with
 * {@link symbolName} / {@link symbolDescription}; the unit suites use it to title their `describe` blocks. Lives local
 * to the app (rather than in the style-guide package) so the source-side registration compiles in every build pass,
 * including the Nitro prerenderer, which will not transpile a package's raw TypeScript
 * @public
 * @function
 * @param symbol - The symbol to annotate (i.e. an exported function)
 * @param metadata - The readable name and optional description
 * @returns The same symbol, unchanged
 */
export function defineSymbol<TSymbol extends object>(symbol: TSymbol, metadata: ISymbolMetadata): TSymbol {
  SYMBOL_METADATA.set(symbol, metadata);
  return symbol;
}

/**
 * Resolves a symbol's readable name, falling back to its intrinsic `.name` (i.e. a function's declared name) and
 * finally to "anonymous"
 * @public
 * @function
 * @param symbol - The symbol to look up
 * @returns The readable name registered via {@link defineSymbol}, or the symbol's own name
 */
export function symbolName(symbol: object): string {
  return SYMBOL_METADATA.get(symbol)?.name ?? (symbol as { name?: string }).name ?? 'anonymous';
}

/**
 * Resolves a symbol's registered description, if any
 * @public
 * @function
 * @param symbol - The symbol to look up
 * @returns The description registered via {@link defineSymbol}, or undefined
 */
export function symbolDescription(symbol: object): string | undefined {
  return SYMBOL_METADATA.get(symbol)?.description;
}
