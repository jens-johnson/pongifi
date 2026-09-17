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
 * █████████████████████████████████ #components/widgets/leagues/create-form/types.ts ██████████████████████████████████
 *
 * Types for the create-league form.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { CreateLeagueAlert, CreateLeaguePhase } from './enums';

/**
 * Where a settled create submission leaves the form.
 * @public
 * @interface
 */
export interface ICreateSubmissionOutcome {
  /* The one alert to show */
  alert: CreateLeagueAlert;

  /* The phase to rest in, which decides whether the fields are editable again */
  phase: CreateLeaguePhase;
}

/**
 * The field messages the create form can show, one per field, null when the field is fine.
 * @public
 * @interface
 */
export interface ICreateLeagueFormErrors {
  /* The short mark's message */
  abbreviation: string | null;

  /* The formats' message */
  allowedGameTypes: string | null;

  /* The description's message */
  description: string | null;

  /* The name's message */
  name: string | null;
}
