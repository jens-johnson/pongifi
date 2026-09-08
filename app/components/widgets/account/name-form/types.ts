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
 * ██████████████████████████████████ #components/widgets/account/name-form/types.ts ███████████████████████████████████
 *
 * Props for the shared display-name form.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Inputs for the shared display-name form.
 *
 * The caller owns the request so the profile page can PATCH and the welcome page can POST completion, while the
 * pending, validation, failure and success behaviour stays in one place rather than being written twice
 * @public
 * @interface
 */
export interface IAccountNameFormProps {
  /* Focus the field and select its contents on load, so accepting the prefilled name is one keypress */
  autoFocus?: boolean;

  /* Show a transient confirmation beside the button after a successful save */
  confirm?: boolean;

  /* Helper text under the field */
  helper: string;

  /* The saved name the field starts from and reverts to */
  initialName: string;

  /* The message shown when the save itself fails */
  failureMessage: string;

  /* The label while a save is in flight */
  pendingLabel: string;

  /* Require a change before the primary action is available; the welcome step does not */
  requireChange?: boolean;

  /* Offer a cancel control that restores the saved value */
  showCancel?: boolean;

  /* Performs the save; rejecting shows the failure message and keeps what the player typed */
  submit: (displayName: string) => Promise<void>;

  /* The label on the primary action */
  submitLabel: string;
}
