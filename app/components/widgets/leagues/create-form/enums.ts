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
 * █████████████████████████████████ #components/widgets/leagues/create-form/enums.ts ██████████████████████████████████
 *
 * Phases and alerts of the create-league form.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Where a create submission stands.
 * @public
 * @enum
 */
export enum CreateLeaguePhase {
  /* Editable; nothing is in flight */
  IDLE = 'IDLE',

  /* A submission is in flight; the fields are read-only and the button cannot be pressed again */
  SUBMITTING = 'SUBMITTING',

  /* A submission may have committed; the values and identifier are frozen so a retry is the identical request */
  UNCERTAIN = 'UNCERTAIN',
}

/**
 * The one alert a failed submission shows.
 * @public
 * @enum
 */
export enum CreateLeagueAlert {
  /* The identifier was already used with different values */
  CONFLICT = 'CONFLICT',

  /* Too many writes in a row */
  RATE_LIMITED = 'RATE_LIMITED',

  /* The server refused the request and wrote nothing */
  REFUSED = 'REFUSED',

  /* No answer, so the league may exist */
  UNCERTAIN = 'UNCERTAIN',
}
