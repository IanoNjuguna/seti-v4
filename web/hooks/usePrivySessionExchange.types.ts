/** Where the Privy → Seti session exchange currently stands. */
export type PrivyExchangeStatus =
  /** Not started: either signed out, or no Privy session yet. */
  | 'idle'
  /** Privy is authenticated; the token exchange is in flight. */
  | 'exchanging'
  /** The exchange failed and an actionable reason is available. */
  | 'failed';

export interface PrivyExchangeValue {
  status: PrivyExchangeStatus;
  /** Actionable reason the exchange failed, or null. */
  error: string | null;
  /** Re-run the exchange — the Privy session is still valid, so this can succeed. */
  retry: () => void;
}
