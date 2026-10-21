/**
 * Savings: the account's idle money earning what Tempo's Earn vaults pay.
 *
 * ## What this is, in one line
 *
 * Money the customer puts aside sits in a Tempo Earn vault (Morpho on Tempo),
 * keeps its own balance, and can be withdrawn — the Cash App shape: available and
 * saved are two figures, and neither is a surprise.
 *
 * ## Why a vault and not a chain read we do ourselves
 *
 * A position is shares of a vault, and the vault's own accounting is the truth
 * about what a share is worth. Tempo exposes that as read endpoints, including
 * earnings with a cost basis and a measurement window — so this service reads
 * Tempo's answers rather than re-deriving them from share prices, which is the
 * one calculation that would drift from the vault.
 *
 * ## Why the summary says "unavailable" instead of zero
 *
 * Two states are honest and one is a lie: an APY can be `null` when no component is
 * measurable, and earnings can come back `incomplete_cost_basis` when the vault
 * cannot attribute a cost basis (a transfer in, for instance). Both are reported as
 * unavailable here. A savings screen that prints 0.00% is telling a customer they
 * earn nothing, which is a different claim from "we cannot measure this yet".
 *
 * ## Why the vault is a constant
 *
 * Picking a vault is a RISK decision, not a parameter: the curator, the collateral
 * and the share price history are somebody's judgement about where customer money
 * sits. Ours is the large Sentora pathUSD vault — ~150M pathUSD of assets, share
 * price 1.000004, deposits open — chosen because pathUSD ↔ OUSD is 0–1bps on the
 * DEX, so the way in and out of savings costs ~2bps against a stable share. The
 * USDC.e vaults hold a bridged asset and one carries a 1.067 share price, which is
 * a different product.
 */

import { prisma } from '../lib/prisma.js';
import { isAllowedPair, quoteDexConvert } from './convert.js';
import { issueQuote } from './quote.js';
import { parseUnits } from 'viem';
import { servedNetwork } from '../config/networks.js';
import { getUserBalance } from './balance.js';
import { getFxQuote, resolveUserFiat } from './payments.js';
import { normalizeNetwork, type Network } from '../lib/network.js';
import { isValidEvmAddress } from '../lib/address.js';
import { ASSET_DECIMALS, type SupportedAsset } from '../config/assets.js';
import { formatUnits } from 'viem';

const EARN_API = 'https://api.tempo.xyz/v1/earn';

/** The vault customer money goes into, per network. Absent means savings are off. */
export const SAVINGS_VAULT: Partial<Record<Network, string>> = {
  mainnet: '0x79a5ee4e9fb8bc3a6c0dc13525ec8ed4872de07a',
};

/** The asset the chosen vault takes. Savings are denominated in it, not in OUSD. */
export const SAVINGS_ASSET: SupportedAsset = 'pathusd';

/**
 * The vault's SHARE token, per network.
 *
 * A constant like the vault, and for the same reason: it is the contract whose
 * Transfer events prove shares were minted to the customer, so it must not be
 * something a caller can name. Mainnet shares are `tvSENPATHUSDTest1E` at this
 * address (the vault's own label carries "Test", which is Tempo's naming — it is
 * the live, funded vault).
 */
export const SAVINGS_SHARE_TOKEN: Partial<Record<Network, string>> = {
  mainnet: '0x20c000000000000000000000732df315102e4518',
};

export interface SavingsEarnings {
  /** Lifetime earnings in the vault's asset units. */
  lifetime: string;
  /** `complete` when the vault can price the position; otherwise earn is unknown. */
  status: 'complete' | 'incomplete_cost_basis';
  /** Lifetime earnings in the customer's currency, or null when unmeasurable. */
  lifetimeFiat: string | null;
}

export interface SavingsSummary {
  network: Network;
  /** False on a network with no vault: the surface says savings are not here yet. */
  available: boolean;
  /**
   * Why `available` is false, when it is:
   *  - `ok` — the vault answered.
   *  - `not-offered` — this network has no savings vault, and never has.
   *  - `unreadable` — a vault exists but Tempo's Earn API could not be read on this
   *    request. Distinct from `not-offered` on purpose: "we could not reach it" and
   *    "it is not here" are different sentences, and only one of them is worth a
   *    retry button. Found when a transient fetch timeout made a live vault look
   *    absent.
   */
  status: 'ok' | 'not-offered' | 'unreadable';
  vault: {
    address: string;
    asset: SupportedAsset;
    /** The asset value of one share, as the vault reports it. */
    sharePrice: string;
    depositsPaused: boolean;
  } | null;
  /** Spendable balance, in the customer's currency — OUSD, the settlement asset. */
  spendableFiat: string;
  fiatCurrency: string;
  /** What the position is worth now, in the vault's asset units. */
  savedValue: string;
  /** The same figure in the customer's currency. */
  savedFiat: string;
  /** Share count. NEVER an amount of stablecoins — see the doc comment. */
  shares: string;
  earnings: SavingsEarnings | null;
  /** Null when the vault publishes no measurable rate. Rendered as "unavailable". */
  apy: string | null;
  canDeposit: boolean;
  canWithdraw: boolean;
}

interface EarnPosition {
  shareBalance: string;
  value: string;
  assetBalance: string;
}

interface EarnEarnings {
  lifetimeEarnings: string;
  currentValue: string;
  totalDeposited: string;
  status: 'complete' | 'incomplete_cost_basis';
}

interface EarnVault {
  sharePrice?: { formatted?: string };
  state?: { depositsPaused?: boolean; isAccountingAligned?: boolean };
}

/** A read from Tempo's Earn API, or null — a failed read is "unknown", not "zero". */
async function earnGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${EARN_API}${path}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** The address that holds this account's money on this network. */
async function walletAddressFor(userId: string, network: Network): Promise<string | null> {
  const wallet = await prisma.wallet.findFirst({
    where: { userId, status: 'active', network },
    orderBy: { createdAt: 'asc' },
  });

  if (!wallet || !isValidEvmAddress(wallet.address)) return null;
  return wallet.address;
}

/**
 * One customer's savings, as the surface needs it — or an honest "not available".
 *
 * Everything here is a READ. Depositing and withdrawing are the customer's own
 * signatures against the vault (see the plan on #86); this service never writes.
 */
export async function getSavingsSummary(input: {
  userId: string;
  network?: Network;
}): Promise<SavingsSummary> {
  const network = normalizeNetwork(input.network, servedNetwork);
  const fiatCurrency = await resolveUserFiat(input.userId);
  const fx = await getFxQuote(fiatCurrency);
  const fiatPerUsd = fx.fiatPerUsd;

  const { balance } = await getUserBalance(input.userId, 'ousd', network);
  const spendableFiat = (Number(balance) * fiatPerUsd).toFixed(2);

  const vaultAddress = SAVINGS_VAULT[network];
  const address = await walletAddressFor(input.userId, network);

  const empty: SavingsSummary = {
    network,
    available: false,
    status: 'not-offered',
    vault: null,
    spendableFiat,
    fiatCurrency,
    savedValue: '0',
    savedFiat: '0.00',
    shares: '0',
    earnings: null,
    apy: null,
    canDeposit: false,
    canWithdraw: false,
  };

  if (!vaultAddress || !address) return empty;

  const [vault, position, earnings] = await Promise.all([
    earnGet<EarnVault>(`/vaults/${vaultAddress}?chainId=${network === 'mainnet' ? 4217 : 42431}`),
    earnGet<EarnPosition>(
      `/vaults/${vaultAddress}/positions/${address}?chainId=${network === 'mainnet' ? 4217 : 42431}`
    ),
    earnGet<EarnEarnings>(
      `/vaults/${vaultAddress}/earnings/${address}?chainId=${network === 'mainnet' ? 4217 : 42431}`
    ),
  ]);

  // A vault we cannot read is a vault we cannot offer: no deposit button on a
  // paused or unreadable vault, because the tap would fail after the customer has
  // already typed an amount.
  // The vault exists (we named it) but did not answer: a read failure, not an
  // absence. The surface can offer a retry for this and must not for the other.
  if (!vault) return { ...empty, status: 'unreadable' };

  const paused = vault.state?.depositsPaused === true;
  const aligned = vault.state?.isAccountingAligned !== false;

  const savedValue = position?.value ?? '0';
  const savedUnits = Number(formatUnits(BigInt(savedValue), ASSET_DECIMALS));
  const shares = position?.shareBalance ?? '0';

  const measured =
    earnings && earnings.status === 'complete'
      ? {
          lifetime: formatUnits(BigInt(earnings.lifetimeEarnings), ASSET_DECIMALS),
          status: earnings.status,
          lifetimeFiat: (
            Number(formatUnits(BigInt(earnings.lifetimeEarnings), ASSET_DECIMALS)) * fiatPerUsd
          ).toFixed(2),
        }
      : earnings
        ? {
            lifetime: '0',
            status: earnings.status,
            // Unmeasurable is not zero: the surface must say so.
            lifetimeFiat: null,
          }
        : null;

  return {
    network,
    available: true,
    status: 'ok',
    vault: {
      address: vaultAddress,
      asset: SAVINGS_ASSET,
      sharePrice: vault.sharePrice?.formatted ?? '1',
      depositsPaused: paused,
    },
    spendableFiat,
    fiatCurrency,
    savedValue: formatUnits(BigInt(savedValue), ASSET_DECIMALS),
    savedFiat: (savedUnits * fiatPerUsd).toFixed(2),
    shares: formatUnits(BigInt(shares), ASSET_DECIMALS),
    earnings: measured,
    // Tempo's vault responses carry no measurable rate for this vault today. Null
    // here is rendered as "unavailable", never as 0%.
    apy: null,
    canDeposit: !paused && aligned,
    canWithdraw: BigInt(shares) > BigInt(0),
  };
}

/**
 * What saving an amount would do, before anything is signed.
 *
 * A deposit is THREE calls in one Tempo transaction, and this prices all of them:
 *
 *   1. `swapExactAmountIn` OUSD → pathUSD on the DEX, because there is no OUSD
 *      vault and OUSD is what the customer actually holds;
 *   2. `approve` the vault for that pathUSD;
 *   3. `deposit(amount, recipient, shareMin)` on the vault.
 *
 * One signature, atomic: the customer taps once and either all three land or none
 * do. That is why this is one quote rather than a swap endpoint and a deposit
 * endpoint — a customer who swapped and then failed to deposit would be holding the
 * wrong asset with no way to know why.
 *
 * The floor is carried on both legs for the same reason the convert path carries
 * one: the book and the vault price at a moment, and the signature should bind the
 * customer to bounds they can see rather than to whatever lands.
 */
export interface SavingsDepositQuote {
  network: Network;
  fiatCurrency: string;
  /** What the customer typed, in their currency. */
  fiatAmount: string;
  /** The OUSD that leaves the spendable balance. */
  amountIn: string;
  assetIn: SupportedAsset;
  /** The pathUSD the swap must deliver. The vault takes this. */
  swapOut: string;
  minSwapOut: string;
  /** The floor on shares minted, so a vault fee cannot quietly eat the deposit. */
  minShares: string;
  sharePrice: string;
  vault: string;
  /** Signed frozen rate, so the ledger is written from the rate the quote showed. */
  quoteId: string;
  hasEnoughBalance: boolean;
  /** The spendable balance converted to fiat, for the "is this more than I have" line. */
  spendableFiat: string;
}

/** The tolerance on both legs of a deposit, in basis points. */
export const SAVINGS_TOLERANCE_BPS = 50;

export async function quoteSavingsDeposit(input: {
  userId: string;
  amountFiat: string;
  network?: Network;
}): Promise<SavingsDepositQuote> {
  const network = normalizeNetwork(input.network, servedNetwork);
  const vault = SAVINGS_VAULT[network];
  if (!vault) throw new Error(`Savings are not offered on ${network}.`);

  const amountFiat = Number(input.amountFiat);
  if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
    throw new Error('The amount to save must be a positive number.');
  }

  const fiatCurrency = await resolveUserFiat(input.userId);
  const fx = await getFxQuote(fiatCurrency);
  const fiatPerUsd = fx.fiatPerUsd;

  // OUSD → pathUSD has a book on mainnet; on a network without one the whole
  // deposit is refused here rather than signing a swap that cannot fill.
  if (!isAllowedPair('ousd', SAVINGS_ASSET, network)) {
    throw new Error(`No market for ${'ousd'} → ${SAVINGS_ASSET} on ${network}.`);
  }

  const amountIn = parseUnits((amountFiat / fiatPerUsd).toFixed(ASSET_DECIMALS), ASSET_DECIMALS);
  const { amountOut, minAmountOut } = await quoteDexConvert({
    assetIn: 'ousd',
    assetOut: SAVINGS_ASSET,
    amountIn,
    network,
  });

  // Shares are priced by the vault, not by us: at a share price of P, one unit buys
  // 1/P shares. The floor is the same 50bps the swap gets, so a vault fee taken at
  // deposit cannot reduce the position below what the customer was shown.
  const vaultRecord = await earnGet<EarnVault>(`/vaults/${vault}?chainId=${network === 'mainnet' ? 4217 : 42431}`);
  const sharePrice = Number(vaultRecord?.sharePrice?.formatted ?? '1');
  const expectedShares = sharePrice > 0 ? Number(amountOut) / sharePrice : 0;
  const minShares =
    (BigInt(Math.floor(expectedShares * 1e6)) * BigInt(10_000 - SAVINGS_TOLERANCE_BPS)) / BigInt(10_000);

  const { balance } = await getUserBalance(input.userId, 'ousd', network);
  const hasEnoughBalance = parseUnits(balance, ASSET_DECIMALS) >= amountIn;

  const quoteId = issueQuote({
    userId: input.userId,
    fiatCurrency,
    fiatPerUsd,
    source: fx.source,
    asOf: fx.asOf,
    network,
  });

  return {
    network,
    fiatCurrency,
    fiatAmount: amountFiat.toFixed(2),
    amountIn: formatUnits(amountIn, ASSET_DECIMALS),
    assetIn: 'ousd',
    swapOut: formatUnits(amountOut, ASSET_DECIMALS),
    minSwapOut: formatUnits(minAmountOut, ASSET_DECIMALS),
    minShares: formatUnits(minShares, ASSET_DECIMALS),
    sharePrice: String(sharePrice),
    vault,
    quoteId,
    hasEnoughBalance,
    spendableFiat: (Number(balance) * fiatPerUsd).toFixed(2),
  };
}
