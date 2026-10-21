/**
 * Settlement: the one place the product decides to turn a bridged stablecoin into
 * OUSD, on the customer's behalf and with the customer's own signature.
 *
 * ## Why this exists at all
 *
 * A customer should never have to know which stablecoin they hold. OUSD is Tempo's
 * native settlement asset with 1:1 mint/redeem through partners and no bridge
 * dependency, so it is the asset to hold; USDC.e and pathUSD arrive bridged. The
 * balance is displayed as one USD figure (#85) and settled here, so the difference
 * is invisible.
 *
 * ## Why it is a PLAN, not a swap
 *
 * The backend cannot sign for a customer: Seti is non-custodial, and a key that can
 * move customer funds is custody, a different business and a different licence.
 * Only the customer's embedded wallet can sign. So the backend's job is to decide
 * WHAT is worth settling and price it; the app signs it while the customer has the
 * app open, and `recordConvert` verifies the receipt afterwards.
 *
 * That constraint is also the batching rule, for free: settlement happens at app
 * open, when the un-settled amount has crossed a threshold — one interaction with
 * the book per crossing, not one per payment.
 *
 * ## What was measured before choosing any of these numbers
 *
 * `quoteSwapExactAmountIn`, 2026-10-21, mainnet (4217, where the product runs):
 * `pathusd → ousd` 0.0bps and `usdc.e → ousd` 1.0bps, flat from 1 unit to 1,000,000.
 * Practice (42431, CI and dev only): `pathusd → ousd` dies just above 2,400 units
 * and `usdc.e → ousd` has no book at all.
 *
 * `usdt0` was measured with no book in either direction earlier on 2026-10-21 and
 * re-measured with one late the same day: on mainnet, `usdt0 → pathusd` 2bps and
 * `usdt0 → ousd` 1bps, both flat from 10 units to 50,000, and the reverse
 * (`pathusd`/`ousd → usdt0`) at 0–1bps. Books appear; a skip decision must read the
 * book at the moment it runs rather than trust a note like this one.
 *
 * Those numbers are why the spread cap below is what it is: on mainnet no pair we
 * offer comes close to it, so the cap only fires when the book has genuinely
 * changed shape, which is exactly when a swap should be skipped rather than taken.
 */
import { formatUnits, parseUnits } from 'viem';
import {
  CONVERT_TOLERANCE_BPS,
  isAllowedPair,
  quoteDexConvert,
} from './convert.js';
import { getUserAssetBalances } from './balance.js';
import { getFxQuote, resolveUserFiat } from './payments.js';
import { issueQuote } from './quote.js';
import { assetsForNetwork, estimateNetworkFee, isListedOn, servedNetwork } from './chain.js';
import { ASSET_DECIMALS, type SupportedAsset } from '../config/assets.js';
import { normalizeNetwork, type Network } from '../lib/network.js';

/**
 * The asset everything settles INTO.
 *
 * Not configurable per network by accident: OUSD is the reason settlement exists.
 * A network that does not list OUSD has nothing to settle into, and pays for its
 * honesty by having every asset skipped as `not-listed`.
 */
export const SETTLE_TARGET: SupportedAsset = 'ousd';

/**
 * The smallest un-settled amount worth a swap, in the asset's own units.
 *
 * A swap costs the customer gas in the input token. Below a few units the gas is a
 * meaningful share of the amount moved and the swap is a net loss dressed as
 * housekeeping, so dust stays where it is and gets swept when more money arrives.
 * Five units is a floor, not a target — the customer never sees either figure.
 */
export const SETTLE_MIN_UNITS = 5;

/**
 * The worst spread a settlement will accept, in basis points, measured against a
 * 1:1 par between two dollar stablecoins.
 *
 * Mainnet measures 0–1bps on every pair offered, so this fires only when the book
 * has changed shape — a drained side, a pair that has become illiquid. When it
 * fires, the money stays in the asset it arrived in, which is a supported state.
 */
export const SETTLE_MAX_SPREAD_BPS = 30;

/** Why an asset was left alone. Every one of these is a normal outcome. */
export type SettleSkipReason =
  /** It is already the target, which is the product working as intended. */
  | 'already-target'
  /** The balance is below {@link SETTLE_MIN_UNITS}. */
  | 'below-threshold'
  /** The book has no orders for this pair at this size. */
  | 'no-market'
  /** The fill would be worse than {@link SETTLE_MAX_SPREAD_BPS}. */
  | 'spread-too-wide'
  /** This network does not list the asset, or does not list OUSD. */
  | 'not-listed';

export interface SettleableAsset {
  assetIn: SupportedAsset;
  assetOut: SupportedAsset;
  /** What would be spent, in `assetIn` units. */
  amountIn: string;
  /** What the book says arrives, in `assetOut` units. */
  amountOut: string;
  /** The floor the app must sign, the quote less the convert tolerance. */
  minAmountOut: string;
  /** Spread against par, in basis points. The number the cap is compared with. */
  spreadBps: number;
}

export interface SettleSkip {
  asset: SupportedAsset;
  balance: string;
  reason: SettleSkipReason;
}

export interface SettlePlan {
  network: Network;
  target: SupportedAsset;
  /**
   * The frozen rate the plan priced in, when there is anything to settle.
   *
   * Settlement is the one path where nothing is SHOWN before it happens, so there
   * is no preview to carry a quote id — but `recordConvert` still refuses a row
   * without a frozen rate, and that discipline is what keeps every ledger figure
   * reproducible. So the plan mints one, and the app hands it back with the hash.
   * Found by the first end-to-end run (#105), not by a unit test: the plan existed,
   * the runner existed, and every settlement would have been refused
   * `quote-missing` between them.
   */
  quoteId: string | null;
  /** Worth doing now, priced. The app signs these, one transaction each. */
  items: SettleableAsset[];
  /** Everything else, with the reason. Never shown to a customer. */
  skipped: SettleSkip[];
}

export interface ClassifySettleInput {
  asset: SupportedAsset;
  /** The on-chain balance, in the asset's own units. */
  balance: string;
  /** The book's quote for the whole balance, or null when it has none. */
  quote: { amountIn: bigint; amountOut: bigint } | null;
  /** True when the pair is on the allowlist for this network. */
  allowed: boolean;
}

export interface ClassifySettleResult {
  settle: boolean;
  /** Spread against par in basis points, when there was a quote to measure. */
  spreadBps: number;
  reason?: SettleSkipReason;
}

/**
 * Decide one asset, without a chain, a database or a user.
 *
 * Pure so the rules can be proven: this is where the dust guard, the pair gate and
 * the spread cap live, and every one of them has a wrong direction that costs the
 * customer money — settling something below the gas cost, swapping a pair with no
 * book, or taking a fill worse than par by more than the cap.
 *
 * The spread is measured against PAR (both sides are dollar stablecoins), not
 * against a previous quote: a settlement's question is "is this still roughly
 * one-to-one", and comparing two quotes would only say whether the book moved
 * between them.
 */
export function classifySettle(input: ClassifySettleInput): ClassifySettleResult {
  const balance = parseUnits(input.balance, ASSET_DECIMALS);

  if (input.asset === SETTLE_TARGET) {
    return { settle: false, spreadBps: 0, reason: 'already-target' };
  }

  if (balance < parseUnits(String(SETTLE_MIN_UNITS), ASSET_DECIMALS)) {
    return { settle: false, spreadBps: 0, reason: 'below-threshold' };
  }

  if (!input.allowed || !input.quote) {
    return { settle: false, spreadBps: 0, reason: 'no-market' };
  }

  const { amountIn, amountOut } = input.quote;
  if (amountIn <= BigInt(0) || amountOut <= BigInt(0)) {
    return { settle: false, spreadBps: 0, reason: 'no-market' };
  }

  // Integer basis points, so a float can never decide a refusal: the distance from
  // par, as |in - out| / in, scaled. Uses bigint maths end to end.
  const delta = amountIn > amountOut ? amountIn - amountOut : amountOut - amountIn;
  const spreadBps = Number((delta * BigInt(10_000)) / amountIn);

  if (spreadBps > SETTLE_MAX_SPREAD_BPS) {
    return { settle: false, spreadBps, reason: 'spread-too-wide' };
  }

  return { settle: true, spreadBps };
}

/**
 * What this account should settle, on this network, right now.
 *
 * Reads balances off the chain (one read per listed asset), quotes the book for
 * anything worth settling, and answers with both the work and the reasons for the
 * rest. It never writes anything: the app signs, and `recordConvert` records.
 *
 * A quote that reverts is a skip, not an error. The book refusing a size is a fact
 * about the book, and the customer must not see a failure because the housekeeping
 * could not run.
 */
export async function planSettlement(input: {
  userId: string;
  network?: Network;
}): Promise<SettlePlan> {
  const network = normalizeNetwork(input.network, servedNetwork);
  const targetListed = isListedOn(SETTLE_TARGET, network);

  const balances = await getUserAssetBalances(input.userId, network);
  const items: SettleableAsset[] = [];
  const skipped: SettleSkip[] = [];

  for (const row of balances) {
    const asset = row.asset;

    if (!targetListed || !isListedOn(asset, network)) {
      skipped.push({ asset, balance: row.amount, reason: 'not-listed' });
      continue;
    }

    // The cheap refusals first, so a dust balance costs no chain call: the same
    // order of operations `previewConvert` uses, for the same reason.
    const cheap = classifySettle({ asset, balance: row.amount, quote: null, allowed: false });
    if (cheap.reason === 'already-target' || cheap.reason === 'below-threshold') {
      skipped.push({ asset, balance: row.amount, reason: cheap.reason });
      continue;
    }

    const allowed = isAllowedPair(asset, SETTLE_TARGET, network);
    if (!allowed) {
      skipped.push({ asset, balance: row.amount, reason: 'no-market' });
      continue;
    }

    /**
     * What can actually be swapped: the balance MINUS the gas for the swap.
     *
     * Found the hard way (#105): a plan that offers the whole balance signs a swap
     * that spends every unit it holds, leaving nothing to pay the fee — and the
     * transaction reverts on chain. Gas is charged in the INPUT token on Tempo, so
     * the input has to leave room for it.
     *
     * The preview path avoids this with `hasEnoughBalance` ("input plus gas"), but a
     * settlement has no preview. Deducting here is the same rule, applied at the
     * moment the amount is chosen.
     */
    const grossBalance = parseUnits(row.amount, ASSET_DECIMALS);
    const gasEstimate = await estimateNetworkFee(asset, network);
    const gasInAsset = parseUnits(gasEstimate.feeAsset, ASSET_DECIMALS);
    const spendableUnits = grossBalance > gasInAsset ? grossBalance - gasInAsset : BigInt(0);
    const amountIn = spendableUnits;

    let quote: { amountIn: bigint; amountOut: bigint } | null = null;
    try {
      const priced = await quoteDexConvert({
        assetIn: asset,
        assetOut: SETTLE_TARGET,
        amountIn,
        network,
      });
      quote = { amountIn, amountOut: priced.amountOut };
    } catch {
      // No market at this size. A fact about the book, not a failure of the plan.
      quote = null;
    }

    const spendable = formatUnits(spendableUnits, ASSET_DECIMALS);
    const decision = classifySettle({ asset, balance: spendable, quote, allowed });
    if (!decision.settle || !quote) {
      skipped.push({ asset, balance: row.amount, reason: decision.reason ?? 'no-market' });
      continue;
    }

    // The floor the app signs: the quote less the same tolerance `previewConvert`
    // applies, floored in integer maths so it cannot be a rounding artefact.
    const minAmountOut = (quote.amountOut * BigInt(10_000 - CONVERT_TOLERANCE_BPS)) / BigInt(10_000);

    items.push({
      assetIn: asset,
      assetOut: SETTLE_TARGET,
      amountIn: formatUnits(quote.amountIn, ASSET_DECIMALS),
      amountOut: formatUnits(quote.amountOut, ASSET_DECIMALS),
      minAmountOut: formatUnits(minAmountOut, ASSET_DECIMALS),
      spreadBps: decision.spreadBps,
    });
  }

  // One rate for the plan, not one per asset: every figure settles at the same
  // moment, and a per-item rate would let two rows disagree about the same minute.
  let quoteId: string | null = null;
  if (items.length > 0) {
    const fiatCurrency = await resolveUserFiat(input.userId);
    const fx = await getFxQuote(fiatCurrency);
    quoteId = issueQuote({
      userId: input.userId,
      fiatCurrency,
      fiatPerUsd: fx.fiatPerUsd,
      source: fx.source,
      asOf: fx.asOf,
      network,
    });
  }

  return { network, target: SETTLE_TARGET, items, skipped, quoteId };
}

/** The listed assets on a network, in display order — for the plan's own logs. */
export function settleableAssets(network: Network): readonly SupportedAsset[] {
  return assetsForNetwork(network);
}
