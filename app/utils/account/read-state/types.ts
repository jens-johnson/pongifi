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
 * ████████████████████████████████████████ #utils/account/read-state/types.ts █████████████████████████████████████████
 *
 * Types for the account read state resolver.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { AccountReadState } from './enums';

/**
 * Everything the state resolver needs, taken as values rather than as `useFetch`'s refs.
 *
 * Values rather than framework objects, so the decision is a pure function the unit suite can drive through every
 * combination without a Nuxt runtime
 * @public
 * @interface
 */
export interface IAccountReadStateInput {
  /* The status carried by the read's error, or null when it did not fail */
  errorStatusCode: number | null;

  /* Whether the read has data to render */
  hasData: boolean;

  /* The request's own status, straight from `useFetch` */
  status: TAccountReadStatus;
}

/**
 * The request statuses `useFetch` reports.
 *
 * Declared here rather than imported from Nuxt, because these tests run standalone and the resolver is the only part
 * that has to agree with the framework
 * @public
 */
export type TAccountReadStatus = 'error' | 'idle' | 'pending' | 'success';

/**
 * The resolver's answer, re-exported so a caller needs one import.
 * @public
 */
export type TAccountReadState = AccountReadState;
