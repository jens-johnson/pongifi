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
 * █████████████████████████████████████████ #utils/leagues/settings/enums.ts ██████████████████████████████████████████
 *
 * The states and alerts one settings section moves through.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * The state one settings section is in between its Save and the answer to it.
 *
 * Uncertainty is its own state rather than a failure, because the write may have committed: the section holds the
 * snapshot it submitted and reconciles by reading, never by saving again (page spec, Saving)
 * @public
 * @enum
 */
export enum SettingsSectionPhase {
  /* Editable; nothing in flight */
  IDLE = 'IDLE',

  /* The re-read after an uncertain outcome could not be made either, so nothing may be sent */
  RECONCILE_FAILED = 'RECONCILE_FAILED',

  /* The current configuration is shown beside the draft; nothing writes until the person chooses */
  STALE = 'STALE',

  /* A save is in flight */
  SAVING = 'SAVING',

  /* The answer was lost; the submitted snapshot and its revision are held for an identical retry */
  UNCERTAIN = 'UNCERTAIN',
}

/**
 * The alert a section shows above its controls, each mapping to one line of copy.
 * @public
 * @enum
 */
export enum SettingsSectionAlert {
  /* The write failed in a way that says nothing about whether it committed */
  RECONCILE_FAILED = 'RECONCILE_FAILED',

  /* The caller's role does not cover this section */
  FORBIDDEN = 'FORBIDDEN',

  /* The account has spent its write allowance */
  RATE_LIMITED = 'RATE_LIMITED',

  /* Anything else the server refused with */
  REFUSED = 'REFUSED',

  /* The configuration moved while the section was being edited */
  STALE = 'STALE',
}

/**
 * What a re-read says about a save whose answer was lost.
 * @public
 * @enum
 */
export enum UncertainReconciliation {
  /* The same request may be sent again, at the revision it carried the first time */
  RETRY = 'RETRY',

  /* The write committed after all */
  SAVED = 'SAVED',

  /* Something else moved the configuration, so the draft is compared before anything is sent */
  STALE = 'STALE',
}
