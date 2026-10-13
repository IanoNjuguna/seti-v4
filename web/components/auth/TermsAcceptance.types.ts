/** Props for the sign-up terms checkbox. */
export interface TermsAcceptanceProps {
  /** Whether the terms have been accepted. Owned by the caller, which gates on it. */
  checked: boolean;
  /** Reports the checkbox's new value. The input is controlled, not defaulted. */
  onChange: (checked: boolean) => void;
}
