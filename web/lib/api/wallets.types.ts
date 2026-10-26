/**
 * A wallet row the account holds, as `GET /users/:id/wallets` returns it.
 *
 * Only the three fields the browser reads are named: the address, the status the
 * login path writes, and the network the row is scoped to. The rest of the row
 * (chain, asset, keyId, timestamps) belongs to the registry's bookkeeping and
 * naming it here would invite a client to depend on it.
 */
export interface AccountWalletRow {
  id: string;
  /** The registered address, checksummed by the backend before it was stored. */
  address: string;
  /**
   * `active` is the row the account is using; `deprecated` is what a later login
   * writes when it registers a DIFFERENT address. A deprecated row still names an
   * address the account holds — `resolveSigningWallet` ignores status on purpose —
   * so it is a usable fallback rather than dead data.
   */
  status: 'active' | 'deprecated';
  /** `testnet` (Practice) or `mainnet` (Live). The route scopes by the session's. */
  network: string;
}

/** The route's answer. */
export interface AccountWalletsResponse {
  wallets: AccountWalletRow[];
}
