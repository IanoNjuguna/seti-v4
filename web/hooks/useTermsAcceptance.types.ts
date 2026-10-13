/** The sign-up gate's state, read by the controls that must stay blocked. */
export interface UseTermsAcceptanceReturn {
  /** False until the customer ticks the box, on every visit — never persisted. */
  accepted: boolean;
  setAccepted: (accepted: boolean) => void;
}
