import { getAddress } from 'viem';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { describeEvmAddress } from '../lib/address.js';
import { getUserBalance } from './balance.js';
import { estimateNetworkFee, reserveNetworkFee } from './chain.js';
import { calculateMerchantFee, minimumTicketForFloor } from './fees.js';
import { issueQuote } from './quote.js';
import { servedNetwork, treasuryAddressFor } from '../config/networks.js';
import { normalizeNetwork, type Network } from '../lib/network.js';
import type { SupportedAsset } from './chain.js';
import type { TransactionType } from '../types/index.js';

export interface PaymentPreviewInput {
  userId: string;
  /**
   * The network the preview prices for. Defaults to the served network; the
   * signed quote carries it, so a practice quote cannot be redeemed on live.
   */
  network?: Network;
  /**
   * The amount the customer entered, in THEIR currency — not stablecoin units.
   *
   * The local currency is what the customer actually chooses: the pay screen
   * labels the field with it, a merchant QR payload carries a local-currency
   * amount, and the fee schedule is denominated in it. Reading the entered figure
   * as stablecoin units was a unit bug: a customer typing 250 against a `KES`
   * label signed a 250 OUSD transfer, roughly 129x what they meant.
   */
  amountFiat: string;
  asset: string;
  type: TransactionType;
  merchantId?: string;
}

export interface PaymentPreview {
  /** Principal, in stablecoin units: what the merchant receives. */
  amount: string;
  asset: string;
  /**
   * Gross amount the customer must sign for, in stablecoin units:
   * principal + fee + gas. This — not `amount` — is what leaves the wallet,
   * because the fee rides along in the same transfer.
   */
  total: string;
  /** Principal expressed in the customer's currency — the amount they entered. */
  fiatAmount: string;
  /** The customer's currency. Every figure they read is in it. */
  fiatCurrency: string;
  /** The fee, in the customer's currency. */
  feeFiat: string;
  /** Gas, in the customer's currency. */
  networkFeeFiat: string;
  /** Principal + fee + gas, in the customer's currency. */
  totalFiat: string;
  hasEnoughBalance: boolean;
  /** True when the KES floor was capped as a share of this small payment. */
  feeCapped: boolean;
  /** KES amount below which the floor no longer applies as configured. */
  minimumTicketForFloor: string;
  /** KES per 1 USD used for these figures. */
  fxRate: string;
  fxRateSource: string;
  /** True when the rate is a fallback or has outlived its refresh window. */
  fxRateStale: boolean;
  /**
   * A signed token carrying the exact rate this preview priced with.
   *
   * The client passes it back on the record call, and the backend writes every
   * fiat figure from the rate inside it — NOT from a freshly-read live rate. That
   * is what makes "the figure you saw is the figure we record" true rather than
   * hoped-for. Absent a missing/forged/expired/foreign quote, the record path
   * refuses; it never falls back to the live rate.
   */
  quoteId: string;
  /**
   * How the client must route the fee, decided by the server.
   *
   * `inside-transfer`: sign ONE transfer of `total` to the merchant — the fee
   * rides inside it, so Seti collects nothing. `batch`: sign an atomic batch of
   * `amount` to the merchant plus `feeInAsset` to the treasury.
   */
  feeRoutingMode: 'inside-transfer' | 'batch';
  /**
   * The fee expressed in the payment asset, at the same rate used above.
   *
   * Only meaningful in `batch` mode, where it is the exact amount of the fee
   * leg. In `inside-transfer` mode it is 0 because no separate leg exists — the
   * fee is already inside `total`.
   */
  feeInAsset: string;
  /** The fee as a share of the principal, e.g. "2.00". Never a share of `total`. */
  feePercentOfPrincipal: string;
  /**
   * Principal + fee, in the asset's own units. This — not `total` — is what a
   * single-transfer (`inside-transfer`) signature must carry: `total` includes a
   * gas figure, and gas is never part of what the recipient receives.
   */
  grossAsset: string;
  /** Gas for this transfer, in the asset's own units. The customer funds it. */
  networkFee: string;
  /** `estimate` = measured gas at the live price; `reserve` = the conservative fallback. */
  networkFeeSource: 'estimate' | 'reserve';
  /**
   * Where the fee leg must go, in `batch` mode. Supplied by the server: the
   * client must never invent a treasury address.
   */
  treasuryAddress: string;
  merchant?: {
    id: string;
    name: string;
    payoutAddress: string | null;
  };
}

/**
 * An FX rate plus its provenance.
 *
 * Provenance matters because a rate is persisted onto a transaction row: if a
 * figure is ever disputed, "which rate produced this, and when" has to be
 * answerable without guessing. `stale` flags a cached rate that has outlived
 * the provider's own refresh cadence, so the UI can say so rather than present
 * an old number as current.
 */
export interface FxQuote {
  /** The currency these figures are in, as an ISO 4217 code. */
  fiatCurrency: string;
  /** Units of `fiatCurrency` per 1 USD. */
  fiatPerUsd: number;
  source: string;
  asOf: Date;
  stale: boolean;
}

interface RateCache {
  /** Units per USD, keyed by currency code, as the provider published them. */
  rates: Record<string, number>;
  asOf: Date;
  source: string;
  /** Rates this process has already accepted, to judge the next fetch against. */
  accepted: Record<string, number>;
  expiresAt: number;
}

let rateCache: RateCache | null = null;

/**
 * The currencies v1 can display.
 *
 * Enabling a currency means more than showing it: it needs a fallback rate, so a
 * preview can still price when the provider is unreachable — and a preview that
 * cannot price is a payment that cannot be made. Adding a market is therefore an
 * entry here plus an entry in `FALLBACK_FX`, and nothing else: the arithmetic,
 * the formatting and the ledger are currency-agnostic.
 */
export const ENABLED_FIAT = ['KES'] as const;

/** Used for a user whose stored currency is no longer enabled. */
export const DEFAULT_FIAT = 'KES';

/**
 * Fallback rates, per USD, for currencies that may be displayed.
 *
 * Deliberately sparse: a currency with no fallback here cannot be priced offline,
 * so it is not enabled. `getFxQuote` refuses anything absent from both lists
 * rather than inventing a rate, because an invented rate is a wrong price.
 */
export const FALLBACK_FX: Record<string, number> = { KES: 130 };

export const FALLBACK_RATE_SOURCE = 'fallback';
export const LIVE_RATE_SOURCE = 'open.er-api.com';

/** How long a fetched table is reused before re-fetching. */
const RATE_CACHE_MS = 60 * 60 * 1000; // 1 hour

/**
 * A rate older than this is reported as stale.
 *
 * The provider publishes once a day, so 36 hours means: if we have not managed a
 * fresh fetch in well over a day, the number is no longer trustworthy as "the
 * rate right now" and the UI should say so.
 */
const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

/**
 * How far a rate may move from the last accepted one before we reject it.
 *
 * An absolute band cannot generalise across currencies — 50–500 means nothing for
 * a currency quoted in the thousands — so the check is relative: a move of more
 * than a third in an hour is a unit slip or a provider fault, not a market. The
 * anchor is the last accepted value, or the fallback on the very first fetch.
 */
const MAX_RATE_DEVIATION = 0.3;

export function isEnabledFiat(currency: string): boolean {
  return (ENABLED_FIAT as readonly string[]).includes(currency);
}

/**
 * Whether a rate is plausible enough to price with.
 *
 * Rejects 0, NaN and any implausible jump. A provider returning 0, a unit slip
 * (129 KES quoted as 129,000,000), or a mis-mapped symbol would otherwise be
 * persisted onto every transaction row and quietly corrupt every fee calculation.
 */
function isSaneRate(rate: number | undefined, anchor: number | undefined): rate is number {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return false;
  if (typeof anchor !== 'number' || anchor <= 0) return true;

  return Math.abs(rate / anchor - 1) <= MAX_RATE_DEVIATION;
}

/** Fetch the provider's whole USD table: one request serves every currency. */
async function fetchRates(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.warn('[fx] provider returned HTTP', response.status);
      return null;
    }

    const payload = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };

    if (payload.result !== 'success' || !payload.rates) {
      console.warn('[fx] provider did not report success');
      return null;
    }

    return payload.rates;
  } catch (error) {
    // A payment preview must not fail because a free rate provider is down.
    console.warn('[fx] live fetch failed, using fallback:', error);
    return null;
  }
}

/**
 * The exchange rate used for fiat figures, for one currency.
 *
 * Fetches the provider's table and caches it. Fails soft to a configured fallback
 * for that currency: a transient provider outage must not 500 a payment preview or
 * block recording a payment that already settled on-chain.
 *
 * Refuses a currency that is not enabled, rather than falling back to a number:
 * pricing in a currency nobody configured would produce rows whose figures cannot
 * be explained.
 *
 * The provider refreshes daily, so a cached rate is marked `stale` once it is
 * older than STALE_AFTER_MS. Callers persist `source`/`asOf` alongside every
 * figure, so a historical row can always be explained.
 */
export async function getFxQuote(fiatCurrency: string = DEFAULT_FIAT): Promise<FxQuote> {
  if (!isEnabledFiat(fiatCurrency)) {
    throw new Error(
      `${fiatCurrency} is not an enabled currency. Enabled: ${ENABLED_FIAT.join(', ')}.`
    );
  }

  if (rateCache && Date.now() < rateCache.expiresAt) {
    const cached = rateCache.rates[fiatCurrency];
    if (isSaneRate(cached, rateCache.accepted[fiatCurrency] ?? FALLBACK_FX[fiatCurrency])) {
      rateCache.accepted[fiatCurrency] = cached;
      return {
        fiatCurrency,
        fiatPerUsd: cached,
        source: rateCache.source,
        asOf: rateCache.asOf,
        stale:
          rateCache.source === FALLBACK_RATE_SOURCE ||
          Date.now() - rateCache.asOf.getTime() > STALE_AFTER_MS,
      };
    }
  }

  const fetched = await fetchRates();
  const anchorFor = (currency: string) =>
    rateCache?.accepted[currency] ?? FALLBACK_FX[currency];

  const live = fetched?.[fiatCurrency];
  const usableRate = isSaneRate(live, anchorFor(fiatCurrency)) ? live : undefined;

  if (usableRate === undefined && live !== undefined) {
    console.warn(`[fx] provider returned an implausible ${fiatCurrency} rate:`, live);
  }

  const source = usableRate === undefined ? FALLBACK_RATE_SOURCE : LIVE_RATE_SOURCE;
  const rates = usableRate === undefined
    ? { ...(rateCache?.rates ?? {}), [fiatCurrency]: FALLBACK_FX[fiatCurrency] }
    : { ...(fetched ?? {}), [fiatCurrency]: usableRate };

  rateCache = {
    rates,
    asOf: new Date(),
    source,
    accepted: { ...(rateCache?.accepted ?? {}), ...(usableRate ? { [fiatCurrency]: usableRate } : {}) },
    expiresAt: Date.now() + RATE_CACHE_MS,
  };

  return {
    fiatCurrency,
    fiatPerUsd: rates[fiatCurrency],
    source,
    asOf: rateCache.asOf,
    stale: source === FALLBACK_RATE_SOURCE,
  };
}

/** Convenience wrapper for callers that only need the number. */
export async function getFiatPerUsd(fiatCurrency: string = DEFAULT_FIAT): Promise<number> {
  return (await getFxQuote(fiatCurrency)).fiatPerUsd;
}

/**
 * Sign the rate a transfer quote priced with.
 *
 * One implementation for payments and sends so the two cannot disagree about
 * what a quote token carries. The rate, its source and its as-of all go into the
 * signed payload — which is what lets a record path write the exact figures the
 * preview showed instead of re-reading a live rate.
 */
function signRateQuote(userId: string, quote: TransferQuote, network: Network = servedNetwork): string {
  return issueQuote({
    userId,
    network,
    fiatCurrency: quote.fiatCurrency,
    fiatPerUsd: quote.fxRate,
    source: quote.fxRateSource,
    asOf: quote.fxRateAsOf,
  });
}

export async function previewPayment(input: PaymentPreviewInput): Promise<PaymentPreview> {
  const amountFiat = Number(input.amountFiat);
  if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
    throw new Error('Amount must be a positive number');
  }

  let merchant = null;
  if (input.merchantId) {
    merchant = await prisma.merchant.findUnique({
      where: { id: input.merchantId },
    });
    if (!merchant) {
      throw new Error('Merchant not found');
    }
  }

  const quote = await quoteTransfer({
    userId: input.userId,
    amountFiat,
    asset: input.asset,
    network: input.network,
  });
  const quoteId = signRateQuote(input.userId, quote, normalizeNetwork(input.network, servedNetwork));

  return {
    // Principal in stablecoin units — what the merchant receives, and the
    // figure the batch's merchant leg must carry. Asset units are for SIGNING and
    // for the chain; every figure a customer reads is a `*Fiat` one below.
    amount: quote.principalAsset.toFixed(8),
    asset: input.asset,
    /** Gross amount the customer must sign for: principal + fee + gas. */
    total: quote.total.toFixed(8),
    /**
     * The customer's currency, and every figure they read. The asset's name never
     * reaches them: which stablecoin backs a dollar is an implementation detail,
     * and "7.86 PATHUSD" in a preview is exactly that leak.
     */
    fiatCurrency: quote.fiatCurrency,
    /** The principal in the customer's currency — the amount they entered. */
    fiatAmount: quote.fiatAmount.toFixed(2),
    feeFiat: quote.feeFiat.toFixed(2),
    networkFeeFiat: quote.networkFeeFiat.toFixed(2),
    totalFiat: quote.totalFiat.toFixed(2),
    hasEnoughBalance: quote.hasEnoughBalance,
    feeCapped: quote.feeCapped,
    minimumTicketForFloor: quote.minimumTicketForFloor,
    fxRate: quote.fxRate.toFixed(4),
    fxRateSource: quote.fxRateSource,
    fxRateStale: quote.fxRateStale,
    quoteId,
    feeRoutingMode: quote.feeRoutingMode,
    feeInAsset: quote.feeLegInAsset.toFixed(8),
    feePercentOfPrincipal: quote.feePercentOfPrincipal.toFixed(2),
    grossAsset: quote.grossAsset.toFixed(8),
    networkFee: quote.networkFeeInAsset.toFixed(8),
    networkFeeSource: quote.networkFeeSource,
    /**
     * Where the fee leg must go, in `batch` mode. Server-supplied for the same
     * reason the mode is: the client must never invent a treasury address, and
     * this is the value the fee and the reconciliation agree on.
     */
    treasuryAddress: treasuryAddressFor(normalizeNetwork(input.network, servedNetwork)),
    merchant: merchant
      ? {
          id: merchant.id,
          name: merchant.name,
          payoutAddress: merchant.payoutAddress,
        }
      : undefined,
  };
}

/**
 * The money arithmetic a transfer shares, whatever its recipient.
 *
 * Extracted from `previewPayment` when sends were added, so a payment and a send
 * cannot drift apart: the fee schedule, the fx quote, the gas reserve and the
 * mode decision are one implementation. A send is not a different kind of money —
 * it is the same principal/fee/gross split with a different payee, and a second
 * copy of this arithmetic is how the two would come to disagree about what 2%
 * means.
 *
 * **The entered figure is the PRINCIPAL, not the total.** The customer types what
 * the recipient should get; the fee and the gas reserve are added on top and
 * funded by the sender. `total` is what must be in the wallet.
 */
export interface TransferQuote {
  /** What the customer entered, in KES. */
  fiatAmount: number;
  /** Principal in stablecoin units — what the recipient receives. */
  principalAsset: number;
  /** Fee in KES, from the schedule. */
  feeFiat: number;
  feeCapped: boolean;
  /** The fee in stablecoin units: the amount of the treasury leg in `batch`. */
  feeInAsset: number;
  /** The fee as a share of the principal, for copy that stays true if it moves. */
  feePercentOfPrincipal: number;
  /** Principal + fee: what a single transfer (inside-transfer mode) must carry. */
  grossAsset: number;
  /** The gas figure shown to the customer, in stablecoin units. */
  networkFeeInAsset: number;
  /** The gas figure shown to the customer, in their own currency. */
  networkFeeFiat: number;
  /** Whether `networkFeeInAsset` is a live estimate or the conservative reserve. */
  networkFeeSource: 'estimate' | 'reserve';
  /** Gross + gas. What the balance must cover for the customer's comfort. */
  total: number;
  /** The same total in the customer's currency — the figure they read. */
  totalFiat: number;
  feeRoutingMode: 'inside-transfer' | 'batch';
  /** The fee leg the client must sign. 0 in `inside-transfer` mode. */
  feeLegInAsset: number;
  /** The currency every fiat figure here is in. */
  fiatCurrency: string;
  /** Units of `fiatCurrency` per USD at the rate these figures were derived from. */
  fxRate: number;
  fxRateSource: string;
  /** When the rate was published — carried into the signed quote, then the row. */
  fxRateAsOf: Date;
  fxRateStale: boolean;
  hasEnoughBalance: boolean;
  /** Fiat amount below which the floor no longer applies as configured. */
  minimumTicketForFloor: string;
}

/**
 * The currency to price this user in.
 *
 * Reads the stored preference and refuses to price in a currency the app no
 * longer enables — a stored code outliving its configuration must not produce
 * figures nobody can explain. Falls back to `DEFAULT_FIAT`.
 */
export async function resolveUserFiat(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fiatCurrency: true },
  });

  const stored = user?.fiatCurrency;
  return stored && isEnabledFiat(stored) ? stored : DEFAULT_FIAT;
}

export async function quoteTransfer(input: {
  userId: string;
  amountFiat: number;
  asset: string;
  /** The network the transfer is on. Absent means the network this deployment serves. */
  network?: Network;
}): Promise<TransferQuote> {
  const fiatCurrency = await resolveUserFiat(input.userId);
  const quote = await getFxQuote(fiatCurrency);
  const fiatPerUsd = quote.fiatPerUsd;

  // The customer entered their own currency. The recipient's principal IS that
  // figure; only the asset leg is derived from it, at the rate quoted above.
  // Keeping the fiat figure exactly as entered also means the customer sees the
  // number they typed rather than a value round-tripped through the stablecoin.
  const fiatAmount = input.amountFiat;
  const principalAsset = fiatPerUsd > 0 ? fiatAmount / fiatPerUsd : 0;

  // The fee is collected inside the customer's transfer in `inside-transfer`
  // mode: they send principal + fee, so the fee is collected atomically with the
  // payment and no sweep or relayer is needed.
  //
  // NOTE: this makes the fee a consumer-side charge in practice. The published
  // "merchant pays 2%" framing describes who it is attributed to, not who
  // funds it.
  const merchantFeeResult = calculateMerchantFee(fiatAmount);
  const merchantFee = merchantFeeResult.feeFiat;
  const feeInAsset = fiatPerUsd > 0 ? merchantFee / fiatPerUsd : 0;
  const grossAsset = principalAsset + feeInAsset;

  // Gas, two readings of ONE measurement.
  //
  // `estimateNetworkFee` is the DISPLAY figure: the measured gas of a real batch
  // for THIS asset times the live gas price. When the RPC cannot answer it falls
  // back to the reservation, and the preview says which one it is
  // (`networkFeeSource`), so the UI can mark it as approximate rather than
  // implied precise.
  //
  // `reserveNetworkFee` is the BALANCE floor `hasEnoughBalance` is measured
  // against: the SAME measured batch gas, priced at a conservative gas price
  // rather than the live one. It is derived from the measurement rather than a
  // flat literal, so the displayed estimate and the reservation cannot drift
  // apart when the gas figure is re-taken.
  //
  // The customer funds their own gas (decided 2026-10-10, no sponsorship), so it
  // belongs on the receipt-and-preview, not buried.
  const estimate = await estimateNetworkFee(input.asset as SupportedAsset);
  const networkFeeInAsset = Number(estimate.feeAsset);
  const reservedNetworkFeeInAsset = Math.max(
    Number(reserveNetworkFee(input.asset as SupportedAsset).feeAsset),
    networkFeeInAsset
  );

  const feeRoutingMode = env.FEE_ROUTING_MODE === 'batch' ? 'batch' : 'inside-transfer';
  const feeLegInAsset = feeRoutingMode === 'batch' ? feeInAsset : 0;

  const asset = input.asset as SupportedAsset;
  // The BALANCE of the network this payment is on. Sufficiency is a per-chain
  // question: a practice payment checked against a live balance (or the reverse)
  // refuses sends the customer can afford and admits ones they cannot.
  const balanceResult = await getUserBalance(
    input.userId,
    asset,
    normalizeNetwork(input.network, servedNetwork)
  );
  const balance = Number(balanceResult.balance);
  // Sufficient balance is measured against the GROSS plus the RESERVATION — never
  // the bare estimate. The estimate is a point number that moves with the gas
  // price; the reservation is the same measurement at a conservative price, so
  // it holds on a busy block.
  const hasEnoughBalance = balance >= grossAsset + reservedNetworkFeeInAsset;

  const total = grossAsset + networkFeeInAsset;
  const networkFeeFiat = networkFeeInAsset * fiatPerUsd;

  return {
    fiatAmount,
    fiatCurrency,
    principalAsset,
    feeFiat: merchantFee,
    feeCapped: merchantFeeResult.cappedByMaxPercent,
    feeInAsset,
    feePercentOfPrincipal: principalAsset > 0 ? (feeInAsset / principalAsset) * 100 : 0,
    grossAsset,
    networkFeeInAsset,
    networkFeeFiat,
    networkFeeSource: estimate.source,
    total,
    /**
     * The customer-facing total, added up in THEIR currency rather than derived
     * from the asset total: principal + fee + gas, exactly as the three rows above
     * it read. Multiplying the asset total by the rate instead would leave the
     * displayed rows a hair short of the displayed total, and a customer checking
     * the arithmetic is entitled to find it exact.
     */
    totalFiat: fiatAmount + merchantFee + networkFeeFiat,
    feeRoutingMode,
    feeLegInAsset,
    fxRate: fiatPerUsd,
    fxRateSource: quote.source,
    fxRateAsOf: quote.asOf,
    fxRateStale: quote.stale,
    hasEnoughBalance,
    minimumTicketForFloor: minimumTicketForFloor().toFixed(2),
  };
}

export interface SendPreviewInput {
  userId: string;
  /**
   * The network the preview prices for. Defaults to the served network; the
   * signed quote carries it, so a practice quote cannot be redeemed on live.
   */
  network?: Network;
  /**
   * The amount the customer entered, in KES — the same unit a merchant payment
   * takes, because the fee schedule, the balance and every persisted figure are
   * KES. The recipient's principal IS this figure; the asset leg is derived.
   */
  amountFiat: string;
  asset: string;
  /** The address the money goes to. Checksummed before anything is quoted. */
  recipient: string;
}

export interface SendPreview {
  /** The checksummed recipient the client must use, so it cannot invent one. */
  recipient: string;
  /** Principal in stablecoin units — what the person receives. */
  amount: string;
  asset: string;
  /** Gross + gas in stablecoin units: what must leave the wallet. */
  total: string;
  /** Principal expressed in the customer's currency — the amount they entered. */
  fiatAmount: string;
  fiatCurrency: string;
  /** The fee, in the customer's currency. */
  feeFiat: string;
  /** Gas, in the customer's currency. */
  networkFeeFiat: string;
  /** Principal + fee + gas, in the customer's currency. */
  totalFiat: string;
  hasEnoughBalance: boolean;
  feeCapped: boolean;
  minimumTicketForFloor: string;
  fxRate: string;
  fxRateSource: string;
  fxRateStale: boolean;
  /**
   * Signed token carrying the frozen rate this preview priced with. Pass it back
   * on the record call; the ledger is written from THIS rate. See PaymentPreview.
   */
  quoteId: string;
  feeRoutingMode: 'inside-transfer' | 'batch';
  /** The fee leg's amount. 0 in `inside-transfer`, where a send is refused. */
  feeInAsset: string;
  /** The fee as a share of the principal, e.g. "2.00". Never a share of `total`. */
  feePercentOfPrincipal: string;
  /** Principal + fee, in the asset's own units — the amount the person receives plus the fee. */
  grossAsset: string;
  /** Gas for this send, in the asset's own units. The sender funds it. */
  networkFee: string;
  /** `estimate` = measured gas at the live price; `reserve` = the conservative fallback. */
  networkFeeSource: 'estimate' | 'reserve';
  /**
   * Where the fee leg must go. Server-supplied on purpose: the client must never
   * invent a treasury address, and this is the only value that keeps the fee and
   * the reconciliation agreeing on a destination.
   */
  treasuryAddress: string;
  /** True when this send actually collects the fee. Always true when it returns. */
  feeCollected: boolean;
}

/**
 * Why a send cannot be quoted in `inside-transfer` mode.
 *
 * With a merchant in the path, `inside-transfer` is merely a fee Seti does not
 * collect. With a person, it is worse than that: the fee rides inside the
 * transfer, so the 2% is handed to the person being paid. There is no version of
 * that which is a correctly-priced send, so it is refused rather than discounted.
 */
export const SEND_REQUIRES_BATCH =
  'Sending to a person needs FEE_ROUTING_MODE=batch. In inside-transfer mode the ' +
  'fee rides inside the single transfer, so the 2% would be paid to the recipient.';

export class SendRequiresBatchError extends Error {
  readonly code = 'send-requires-batch';

  constructor() {
    super(SEND_REQUIRES_BATCH);
    this.name = 'SendRequiresBatchError';
  }
}

/**
 * Quote a send to a person: same split as a merchant payment, different payee.
 *
 * Refused unless the server is in `batch` mode — see {@link SEND_REQUIRES_BATCH}.
 * The client signs `amount` to the recipient and `feeInAsset` to
 * `treasuryAddress` in ONE atomic transaction, and `recordSend` then requires
 * both legs on-chain before anything is written.
 */
export async function previewSend(input: SendPreviewInput): Promise<SendPreview> {
  const amountFiat = Number(input.amountFiat);
  if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
    throw new Error('Amount must be a positive number');
  }

  // Refused here rather than at signing time: a bad address must never reach a
  // wallet prompt, and `describeEvmAddress` names the checksum when it fails.
  const complaint = describeEvmAddress(input.recipient);
  if (complaint) {
    throw new Error(`Recipient cannot receive a transfer: ${complaint}`);
  }

  const quote = await quoteTransfer({
    userId: input.userId,
    amountFiat,
    asset: input.asset,
    network: input.network,
  });
  const quoteId = signRateQuote(input.userId, quote, normalizeNetwork(input.network, servedNetwork));

  if (quote.feeRoutingMode !== 'batch') {
    throw new SendRequiresBatchError();
  }

  return {
    /**
     * The checksummed form. `describeEvmAddress` above proved the input is
     * usable, and this is the canonical spelling of it: an all-lowercase address
     * is accepted on the way in, so the client is handed back the EIP-55 form it
     * should sign rather than the string it happened to type.
     */
    recipient: getAddress(input.recipient),
    amount: quote.principalAsset.toFixed(8),
    asset: input.asset,
    total: quote.total.toFixed(8),
    /** See the note in `previewPayment`: every figure a customer reads is fiat. */
    fiatCurrency: quote.fiatCurrency,
    fiatAmount: quote.fiatAmount.toFixed(2),
    feeFiat: quote.feeFiat.toFixed(2),
    networkFeeFiat: quote.networkFeeFiat.toFixed(2),
    totalFiat: quote.totalFiat.toFixed(2),
    hasEnoughBalance: quote.hasEnoughBalance,
    feeCapped: quote.feeCapped,
    minimumTicketForFloor: quote.minimumTicketForFloor,
    fxRate: quote.fxRate.toFixed(4),
    fxRateSource: quote.fxRateSource,
    fxRateStale: quote.fxRateStale,
    quoteId,
    feeRoutingMode: quote.feeRoutingMode,
    feeInAsset: quote.feeLegInAsset.toFixed(8),
    feePercentOfPrincipal: quote.feePercentOfPrincipal.toFixed(2),
    grossAsset: quote.grossAsset.toFixed(8),
    networkFee: quote.networkFeeInAsset.toFixed(8),
    networkFeeSource: quote.networkFeeSource,
    treasuryAddress: treasuryAddressFor(normalizeNetwork(input.network, servedNetwork)),
    feeCollected: true,
  };
}
