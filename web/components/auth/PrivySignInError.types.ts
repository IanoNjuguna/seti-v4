/** Props for the failed-exchange state. */
export interface PrivySignInErrorProps {
  /** Actionable reason, already turned into a sentence by the caller. */
  message: string;
  /** Re-run the exchange (the Privy session is still valid). */
  onRetry: () => void;
  /** Abandon the Privy session entirely, so the user is not left half-signed-in. */
  onSignOut: () => void;
}
