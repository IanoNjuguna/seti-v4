/**
 * Payment types, mirrored from `mobile/src/lib/api/pay.types.ts`.
 *
 * Kept as a copy rather than imported from `mobile/` deliberately: `web/` ships
 * only next/react/react-dom and must not reach into another package's source.
 * If these drift, the backend's zod schemas are the contract — read
 * `backend/src/routes/transactions.ts` and reconcile both sides.
 */

/** v1 supports exactly these two; see `references/tempo-chain-and-wallets.md`. */
export type SupportedAsset = 'ousd' | 'pathusd';

export interface PaymentPreview {
  /** The principal in the asset's own units — what gets signed. */
  amount: string;
  asset: string;
  /** Gross in the asset's own units: principal + fee + gas. What gets signed. */
  total: string;
  /**
   * The figures a customer reads, in THEIR currency. See the note in
   * `send.types.ts`: the asset amounts are machinery, and every displayed figure
   * carries the currency it is in rather than a label chosen by the UI.
   */
  fiatCurrency: string;
  fiatAmount: string;
  feeFiat: string;
  networkFeeFiat: string;
  totalFiat: string;
  hasEnoughBalance: boolean;
  /** True when the fiat fee floor was capped as a share of this small payment. */
  feeCapped: boolean;
  /** Fiat amount below which the fee floor no longer applies as configured. */
  minimumTicketForFloor: string;
  /** Units of `fiatCurrency` per USD at the rate these figures came from. */
  fxRate: string;
  fxRateSource: string;
  /** True when the rate is a fallback or has outlived its refresh window. */
  fxRateStale: boolean;
  /**
   * Signed token carrying the exact rate this preview priced with. Pass it back
   * in `recordPayment`; the server writes the ledger from THIS rate, not a
   * freshly-read one, so the figure shown is the figure recorded. A missing,
   * forged, expired or foreign quote is refused (`quote-*`).
   */
  quoteId: string;
  /**
   * How the client must route the fee. Decided by the server — the client must
   * not choose, or a modified client could ask for the cheaper path.
   *
   * `inside-transfer`: sign ONE transfer of `total` to the merchant.
   * `batch`: sign an atomic batch of `amount` to the merchant plus
   * `feeInAsset` to the treasury.
   */
  feeRoutingMode: 'inside-transfer' | 'batch';
  /**
   * The fee in the payment asset. In `batch` mode this is the exact fee-leg
   * amount; in `inside-transfer` mode it is '0' because the fee rides inside
   * `total` and no second transfer exists.
   */
  feeInAsset: string;
  /** The fee as a share of the principal, e.g. "2.00" — never of `total`. */
  feePercentOfPrincipal: string;
  /**
   * Principal + fee. This is what a single-transfer (`inside-transfer`)
   * signature carries: `total` adds a gas figure, and gas never reaches the
   * recipient.
   */
  grossAsset: string;
  /** Gas for this transfer, in the asset's own units. The customer funds it. */
  networkFee: string;
  /** `estimate` = measured gas at the live price; `reserve` = conservative fallback. */
  networkFeeSource: 'estimate' | 'reserve';
  /**
   * Where the fee leg must go, in `batch` mode. Supplied by the server — the
   * client must never invent a treasury address.
   */
  treasuryAddress: string;
  merchant?: {
    id: string;
    name: string;
    payoutAddress: string | null;
  };
}

export interface RecordPaymentInput {
  userId: string;
  amount: string;
  asset: string;
  merchantId: string;
  txHash: string;
  /**
   * The address the wallet signed with — the `from` of the transfer.
   *
   * The backend binds the recorded row to this wallet, so it verifies it twice:
   * that it belongs to the account, and that it is the sender the chain recorded.
   * Only the browser knows which of the account's embedded wallets it picked,
   * which is why the client has to say. Required, not optional: a record call
   * without it is refused (`signer-not-declared`), so omitting it is a bug rather
   * than a fallback.
   */
  walletAddress: string;
  /** The rate quote from the preview the customer confirmed. See PaymentPreview. */
  quoteId?: string;
  description?: string;
}

export interface RecordPaymentResult {
  transaction: {
    id: string;
    status: string;
  };
}
