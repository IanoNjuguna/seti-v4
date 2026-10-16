/** Props for the sign-up terms checkbox. */
export interface TermsAcceptanceProps {
  /** Whether the terms have been accepted. Owned by the caller, which gates on it. */
  checked: boolean;
  /** Reports the checkbox's new value. The input is controlled, not defaulted. */
  onChange: (checked: boolean) => void;
  /**
   * Which canvas the control sits on.
   *
   * The same control, on the black front door and on the app's white cards. It was
   * light-only, so the front door could not use it and would have grown a SECOND
   * consent statement — the one thing a consent control must never have, because
   * the two copies then disagree about what was agreed to. The tone swaps the token
   * set and nothing else: the ids, the label, the link and the aria wiring that
   * makes the blocked button explain itself are shared.
   */
  tone?: 'light' | 'dark';
}
