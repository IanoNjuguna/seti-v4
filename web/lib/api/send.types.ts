/**
 * Send-to-a-person types, mirrored from `backend/src/services/payments.ts`.
 *
 * Kept as a copy rather than imported (the web package must not reach into the
 * backend's source). If these drift, the backend's zod schemas in
 * `routes/transactions.ts` are the contract — read them and reconcile both sides.
 */

/**
 * What the server says a send costs, before anything is signed.
 *
 * Every figure is authoritative: the client signs `amount` and `feeInAsset` and
 * computes neither. `amount` is the principal the person receives; `total` is
 * what must be in the wallet (principal + fee + the gas reserve).
 */
export interface SendPreview {
  /** The recipient, checksummed by the server. Sign this one, not the typed one. */
  recipient: string;
  /** The principal in the asset's own units — what gets signed. */
  amount: string;
  asset: string;
  /** Principal + fee + gas, in the asset's own units — what gets signed. */
  total: string;
  /**
   * The figures a customer reads, in THEIR currency.
   *
   * The asset amounts above are machinery: they are what the chain moves. Naming a
   * currency is a money claim, so every displayed figure comes from a server field
   * that states which currency it is in — never from a label chosen in the UI.
   */
  fiatCurrency: string;
  /** The principal in the customer's currency — the amount they typed. */
  fiatAmount: string;
  feeFiat: string;
  networkFeeFiat: string;
  totalFiat: string;
  hasEnoughBalance: boolean;
  feeCapped: boolean;
  /** Fiat amount below which the fee floor no longer applies as configured. */
  minimumTicketForFloor: string;
  /** Units of `fiatCurrency` per USD at the rate these figures came from. */
  fxRate: string;
  fxRateSource: string;
  fxRateStale: boolean;
  /**
   * Signed token carrying the exact rate this preview priced with. Pass it back
   * in `recordSend`; the server writes the ledger from THIS rate, not a
   * freshly-read one, so the figure shown is the figure recorded. A missing,
   * forged, expired or foreign quote is refused (`quote-*`).
   */
  quoteId: string;
  /** Always `batch` for a send: the server refuses `inside-transfer`. */
  feeRoutingMode: 'inside-transfer' | 'batch';
  /** The fee leg, in the asset's own units. */
  feeInAsset: string;
  /** The fee as a share of the principal, e.g. "2.00" — never of `total`. */
  feePercentOfPrincipal: string;
  /** Principal + fee, in the asset's own units. */
  grossAsset: string;
  /** Gas for this send, in the asset's own units. The sender funds it. */
  networkFee: string;
  /** `estimate` = measured gas at the live price; `reserve` = conservative fallback. */
  networkFeeSource: 'estimate' | 'reserve';
  /** Where the fee leg goes. Server-supplied — never invented on this side. */
  treasuryAddress: string;
  /** True when this quote collects the fee. */
  feeCollected: boolean;
}

export interface RecordSendInput {
  /** The principal the recipient received, in the asset's own units. */
  amount: string;
  asset: string;
  recipient: string;
  txHash: string;
  /** The rate quote from the preview the customer confirmed. See SendPreview. */
  quoteId?: string;
  description?: string;
}

export interface RecordSendResult {
  transaction: {
    id: string;
    status: string;
  };
}
