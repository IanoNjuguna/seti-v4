export interface Merchant {
  id: string;
  name: string;
  category: string | null;
  payoutAddress: string | null;
}

export interface ResolvedMerchant {
  merchant: Merchant;
  suggestedAmount: string | null;
}

export interface PaymentPreview {
  amount: string;
  asset: string;
  fee: string;
  feeCurrency: string;
  total: string;
  totalCurrency: string;
  fiatAmount: string;
  fiatCurrency: string;
  hasEnoughBalance: boolean;
  /** True when the KES floor was capped as a share of this small payment. */
  feeCapped: boolean;
  /** KES amount below which the fee floor no longer applies as configured. */
  minimumTicketForFloor: string;
  /** KES per 1 USD used for these figures. */
  fxRate: string;
  fxRateSource: string;
  /** True when the rate is a fallback or has outlived its refresh window. */
  fxRateStale: boolean;
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
  description?: string;
}

export interface RecordPaymentResult {
  transaction: {
    id: string;
    status: string;
  };
}
