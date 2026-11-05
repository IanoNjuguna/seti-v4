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
import { formatUnits, parseUnits } from 'viem';
import { servedNetwork } from '../config/networks.js';
import { getUserBalance } from './balance.js';
import { getFxQuote, resolveUserFiat } from './payments.js';
import { normalizeNetwork, type Network } from '../lib/network.js';
import { isValidEvmAddress } from '../lib/address.js';
import { ASSET_DECIMALS, type SupportedAsset } from '../config/assets.js';
import { publicClientFor, estimateNetworkFee } from './chain.js';

const EARN_API = 'https://api.tempo.xyz/v1/earn';

/**
 * The vault customer money goes into, per network. Absent means savings are off.
 *
 * SENTORA OUSD MAIN on Tempo, and it is the only vault savings uses (#322). Chosen over
 * the pathUSD Earn vault that used to sit here because it is 44.5M deep against that
 * vault's ~$150, it takes OUSD (the token every Seti balance is already in, so a deposit
 * needs no swap and a withdrawal leaves no dust), and it carries a funded Merkl campaign
 * that pays 3.5994% until 2027-01-06.
 *
 * WHAT IT COSTS. The vault's own yield measured 0.0000% over seven days, so the whole of
 * that 3.6% is the campaign, and the campaign has an end date. Plain ERC-4626: the vault
 * contract IS the share token, shares are 18dp, and neither `deposit` nor `redeem` takes
 * a floor (the builders take `vaultInterface: 'erc4626'` for that).
 */
export const SAVINGS_VAULT: Partial<Record<Network, string>> = {
  mainnet: '0x0D136e26B4D9e4836fc5cb202baeb49Cb6f5df48',
};

/**
 * The asset the chosen vault takes. Savings are denominated in it.
 *
 * OUSD now, which is the same token a customer's balance is already in: the deposit's
 * swap leg and the withdrawal's way home both disappear, and with them the two hops of
 * churn (#318) and the dust every exit used to leave (#319).
 */
export const SAVINGS_ASSET: SupportedAsset = 'ousd';

/**
 * The vault's SHARE token, per network.
 *
 * A constant like the vault, and for the same reason: it is the contract whose Transfer
 * events prove shares were minted to the customer, so it must not be something a caller
 * can name.
 *
 * IT IS THE VAULT ADDRESS HERE, and that is not a copy-paste slip: the Sentora OUSD Main
 * vault is plain ERC-4626, so the vault contract itself is the ERC-20 share token. Read
 * `name()`, `symbol()`, `decimals()` and `totalSupply()` off that address and they answer
 * `Sentora OUSD Main`, `senOUSDmain`, `18` and the share count.
 */
export const SAVINGS_SHARE_TOKEN: Partial<Record<Network, string>> = {
  mainnet: '0x0D136e26B4D9e4836fc5cb202baeb49Cb6f5df48',
};

/**
 * The vault, read from the chain rather than from Tempo Earn.
 *
 * Tempo's Earn API answers `earn_vault_not_found` for the Morpho vault (#322), so every
 * figure savings needs comes from the contract: the share price is
 * `convertToAssets(1e18) / 1e18`, and a position is the share token's balance of the
 * signing wallet. The vault IS the share token, so both calls go to one address.
 *
 * Returns null rather than throwing: an unreadable vault is a state the summary reports
 * (`status: 'unreadable'`) and must not crash a page for.
 */
const ERC4626_READ_ABI = [
  {
    name: 'convertToAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'shares' }],
    outputs: [{ type: 'uint256', name: 'assets' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'holder' }],
    outputs: [{ type: 'uint256', name: 'shares' }],
  },
] as const;

async function readVaultOnChain(
  vault: `0x${string}`,
  holder: `0x${string}` | null,
  network: Network
): Promise<{ sharePrice: number; shares: bigint } | null> {
  try {
    const client = publicClientFor(network);
    const [perShare, held] = await Promise.all([
      client.readContract({
        address: vault,
        abi: ERC4626_READ_ABI,
        functionName: 'convertToAssets',
        args: [10n ** 18n],
      }),
      holder
        ? client.readContract({
            address: vault,
            abi: ERC4626_READ_ABI,
            functionName: 'balanceOf',
            args: [holder],
          })
        : Promise.resolve(BigInt(0)),
    ]);

    return { sharePrice: Number(formatUnits(perShare, ASSET_DECIMALS)), shares: BigInt(held) };
  } catch {
    return null;
  }
}

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
  /**
   * Whether saving is open at all. False means the surface shows "coming soon" and the
   * API refuses deposits; withdrawals stay available so no position can be trapped.
   */
  live: boolean;
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
  instantLiquidity?: string | null;
  capabilities?: {
    syncRedeem?: boolean;
    asyncRedeem?: boolean;
    exactWithdraw?: boolean;
  };
  state?: { depositsPaused?: boolean; isAccountingAligned?: boolean };
}

/** The two read functions a withdrawal needs from the vault. */
const VAULT_REDEEM_ABI = [
  {
    name: 'previewRedeem',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'shares' }],
    outputs: [{ type: 'uint256', name: 'assets' }],
  },
] as const;

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

  // What can actually be saved, which is not the same as what is OUSD. The customer
  // holds whatever the payment arrived in; this figure has to agree with the balance
  // on home or the screen tells them they are broke while showing they are not.
  let spendable = 0;
  for (const asset of DEPOSIT_FUNDING_ASSETS) {
    const { balance } = await getUserBalance(input.userId, asset, network);
    spendable += Number(balance);
  }
  const spendableFiat = (spendable * fiatPerUsd).toFixed(2);

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
    live: SAVINGS_LIVE,
  };

  if (!vaultAddress || !address) return empty;

  /*
   * Read from the CHAIN, not from Tempo Earn. Tempo answers `earn_vault_not_found` for
   * this vault: it is a Morpho vault and that API only knows Earn vaults (#322). Share
   * price is `convertToAssets(1e18) / 1e18`, the position is the share token's balance of
   * the signing wallet, and the vault IS the share token.
   */
  const vaultHex = vaultAddress as `0x${string}`;
  const holderHex = address as `0x${string}`;
  const onChain = await readVaultOnChain(vaultHex, holderHex, network);

  // A vault we cannot read is a vault we cannot offer: no deposit button on a paused or
  // unreadable vault, because the tap would fail after the customer has typed an amount.
  if (!onChain) return { ...empty, status: 'unreadable' };

  const sharePrice = onChain.sharePrice;
  const shares = onChain.shares;
  // Shares are 18dp and the asset is 6dp, so one conversion settles the position's worth.
  const perShare = BigInt(Math.round(sharePrice * 10 ** ASSET_DECIMALS));
  const positionAssets = (shares * perShare) / 10n ** 18n;
  const savedUnits = Number(formatUnits(positionAssets, ASSET_DECIMALS));

  // No earnings figure: a cost basis is the vendor's to attribute, this vault has none
  // exposed, and "unmeasurable" is not "zero". The surface says so.
  const measured: SavingsSummary['earnings'] = null;

  return {
    network,
    available: true,
    status: 'ok',
    vault: {
      address: vaultAddress,
      asset: SAVINGS_ASSET,
      // Share price is a ratio, and this is the first place it is a ratio we computed
      // rather than a vendor's formatted string.
      sharePrice: String(sharePrice),
      // An ERC-4626 vault exposes no pause flag we read, and deposits are gated by
      // `SAVINGS_LIVE` anyway. Withdrawals are never gated: closing deposits must never
      // trap a position.
      depositsPaused: false,
    },
    spendableFiat,
    fiatCurrency,
    savedValue: formatUnits(positionAssets, ASSET_DECIMALS),
    savedFiat: (savedUnits * fiatPerUsd).toFixed(2),
    shares: formatUnits(shares, 18),
    earnings: measured,
    // The vault's own yield measured 0.0000% over seven days (#322). The campaign APR is
    // a separate surface with its own end date; this field is the vault's rate, and it is
    // null rather than 0 so the screen says "unavailable" instead of "0%".
    apy: null,
    canDeposit: SAVINGS_LIVE,
    canWithdraw: shares > BigInt(0),
    live: SAVINGS_LIVE,
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
  /**
   * The network fee this deposit will pay, in the funding asset's units, already
   * reserved out of `spendableFiat` and out of `hasEnoughBalance` (#137, item 7).
   */
  networkFee: string;
  /** Whether that fee was measured or is a conservative reserve. */
  networkFeeSource: 'estimate' | 'reserve';
  /** The spendable balance converted to fiat, for the "is this more than I have" line. */
  spendableFiat: string;
}

/**
 * The assets that can fund a deposit in ONE hop.
 *
 * `pathusd` is the vault's own asset, so it needs no swap at all; `ousd` and `usdc.e`
 * each reach it in a single swap.
 *
 * `usdt0` belongs here too, and the reason is worth writing down because the opposite
 * was true earlier today: on mainnet it now has a book BOTH ways, measured at 1–2bps
 * flat from 10 units to 50,000 (`usdt0 → pathusd` 2bps, `usdt0 → ousd` 1bps). The
 * earlier "no market anywhere" reading was accurate when it was taken and is stale
 * now. A network that does not LIST the token still refuses on its own, which is what
 * practice does — that is a listing question, not a liquidity one.
 */
const DEPOSIT_FUNDING_ASSETS: SupportedAsset[] = ['pathusd', 'ousd', 'usdc.e', 'usdt0'];

/**
 * Which asset pays for a deposit, given the balances and the amount.
 *
 * A deposit consumes ONE asset in ONE hop, so the rule is: the first funding asset
 * that covers the amount, else the one holding the most — which is the balance the
 * customer would reach for, and therefore the balance the "you have X" line must
 * name. Pulled out as a pure function because it is the whole of the bug in #126:
 * the screen priced everything off OUSD while the customer held pathUSD.
 */
export function chooseDepositAsset(
  funding: { asset: SupportedAsset; balance: bigint }[],
  amountIn: bigint
): { asset: SupportedAsset; balance: bigint } | null {
  if (funding.length === 0) return null;

  const covering = funding.find((candidate) => candidate.balance >= amountIn);
  if (covering) return covering;

  return funding.reduce((largest, candidate) =>
    candidate.balance > largest.balance ? candidate : largest
  );
}

/**
 * Whether deposits are open.
 *
 * They closed on 2026-10-21, and the reason is worth keeping next to the switch:
 * every Earn vault on Tempo reports `verified: false`, `apy.net 0.000000`, and the
 * whole fleet holds about $152 — see #137 for the eight conditions that reopen them.
 * The code below is not disabled, it is gated: one env var restores the flow, so the
 * only thing between a customer and an unverified vault is a value in a config file
 * rather than a memory.
 *
 * Default OFF. A missing variable must fail closed: silence is how a feature nobody
 * meant to launch gets launched.
 */
export const SAVINGS_LIVE = process.env.SAVINGS_ENABLED === 'true';

/** A refusal with a code, so the app can say why and not guess. */
export class SavingsNotLiveError extends Error {
  readonly code = 'savings-not-live';

  constructor() {
    super(
      'Saving is not open yet. The vault does not pay a rate we can stand behind today.'
    );
    this.name = 'SavingsNotLiveError';
  }
}

/** A refusal the customer can act on: the amount they typed, as typed. */
export class SavingsInputError extends Error {
  readonly code = 'savings-amount-invalid';

  constructor(message: string) {
    super(message);
    this.name = 'SavingsInputError';
  }
}

/** The tolerance on both legs of a deposit, in basis points. */
export const SAVINGS_TOLERANCE_BPS = 50;

/**
 * The share floor for a deposit: what the vault will mint, less the tolerance.
 *
 * `amountOut` is RAW 6-decimal units, while `sharePrice` is a ratio in TOKEN units.
 * Dividing the raw figure by the ratio and then scaling again is the bug in #134: it
 * multiplied the floor by 1e6, so the signed minimum was ~995,000x the shares the
 * vault mints and every deposit reverted on its own slippage guard. Converting to
 * tokens FIRST is the whole fix.
 *
 * Pure, exported and asserted by `check:save`, because the failure mode is invisible:
 * a wrong floor still produces a number, and nothing on chain complains until the
 * customer's transaction reverts.
 */
export function sharesForDeposit(amountOut: bigint, sharePrice: number): bigint {
  if (sharePrice <= 0) return BigInt(0);
  const tokens = Number(formatUnits(amountOut, ASSET_DECIMALS));
  const expectedShares = tokens / sharePrice;
  return (
    (BigInt(Math.floor(expectedShares * 1e6)) * BigInt(10_000 - SAVINGS_TOLERANCE_BPS)) /
    BigInt(10_000)
  );
}

/**
 * Whether a balance can fund this deposit AND its network fee.
 *
 * THE TRANSACTION PAYS ITS GAS IN THE ASSET IT SPENDS (#137, item 7). A quote that only
 * asks `balance >= amountIn` therefore prices an amount the customer cannot actually
 * sign when it is close to the whole balance: the deposit itself is fine and the
 * transaction runs out of the very asset it is moving. The fee is small (0.000178
 * pathUSD on the deposit that was measured) and it is exactly the size of the failure.
 *
 * Pure and exported so `check:save` can hold the relationship at the whole balance and
 * one unit under it, rather than trusting a number in a quote nobody re-derives.
 */
export function depositFitsWithFee(balance: bigint, amountIn: bigint, fee: bigint): boolean {
  return balance >= amountIn + fee;
}

/** What is left to deposit once the fee is reserved out of the balance. */
export function spendableAfterFee(balance: bigint, fee: bigint): bigint {
  return balance > fee ? balance - fee : BigInt(0);
}

export async function quoteSavingsDeposit(input: {
  userId: string;
  amountFiat: string;
  network?: Network;
}): Promise<SavingsDepositQuote> {
  if (!SAVINGS_LIVE) throw new SavingsNotLiveError();

  const network = normalizeNetwork(input.network, servedNetwork);
  const vault = SAVINGS_VAULT[network];
  if (!vault) throw new Error(`Savings are not offered on ${network}.`);

  const amountFiat = Number(input.amountFiat);
  if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
    throw new SavingsInputError('The amount to save must be a positive number.');
  }

  const fiatCurrency = await resolveUserFiat(input.userId);
  const fx = await getFxQuote(fiatCurrency);
  const fiatPerUsd = fx.fiatPerUsd;

  const amountIn = parseUnits((amountFiat / fiatPerUsd).toFixed(ASSET_DECIMALS), ASSET_DECIMALS);

  /*
   * Which asset pays, decided from balances rather than assumed.
   *
   * A deposit consumes ONE asset in ONE hop, so the candidates are the ones that can
   * reach the vault directly; an asset with no book is filtered out here rather than
   * signing a swap that cannot fill. The first candidate that covers the amount wins,
   * and when none does, the one holding the most — that keeps `hasEnoughBalance` and
   * its "you have X" line pointing at the balance the customer would use.
   */
  const funding: { asset: SupportedAsset; balance: bigint }[] = [];
  for (const asset of DEPOSIT_FUNDING_ASSETS) {
    const hasMarket = asset === SAVINGS_ASSET || isAllowedPair(asset, SAVINGS_ASSET, network);
    if (!hasMarket) continue;
    const { balance } = await getUserBalance(input.userId, asset, network);
    funding.push({ asset, balance: parseUnits(balance, ASSET_DECIMALS) });
  }

  const chosen = chooseDepositAsset(funding, amountIn);
  if (!chosen) throw new Error(`No asset can reach ${SAVINGS_ASSET} on ${network}.`);
  const assetIn = chosen.asset;

  // Already the vault's asset: nothing to swap, and the deposit is exact.
  const { amountOut, minAmountOut } =
    assetIn === SAVINGS_ASSET
      ? { amountOut: amountIn, minAmountOut: amountIn }
      : await quoteDexConvert({
          assetIn,
          assetOut: SAVINGS_ASSET,
          amountIn,
          network,
        });

  // Shares are priced by the vault, not by us: at a share price of P, one unit buys
  // 1/P shares. The floor is the same 50bps the swap gets, so a vault fee taken at
  // deposit cannot reduce the position below what the customer was shown.
  const vaultRecord = await readVaultOnChain(
    vault as `0x${string}`,
    null,
    network
  );
  const sharePrice = vaultRecord?.sharePrice ?? 0;
  const minShares = sharesForDeposit(amountOut, sharePrice);

  /*
   * The network fee, reserved before anything is called "enough" (#137, item 7).
   *
   * A Tempo transaction pays its gas in the asset it spends, so a deposit priced at the
   * whole balance cannot be signed: the transfer succeeds and the fee has nothing left.
   * The estimate is the same `estimateNetworkFee` the convert quote uses, in the funding
   * asset's own units, so the reservation is measured rather than assumed.
   */
  const feeEstimate = await estimateNetworkFee(assetIn, network);
  const networkFee = parseUnits(feeEstimate.feeAsset, ASSET_DECIMALS);

  const hasEnoughBalance = depositFitsWithFee(chosen.balance, amountIn, networkFee);
  const spendableTotal = funding.reduce((sum, candidate) => sum + candidate.balance, BigInt(0));
  // What the customer can actually put in, which is the balance less one fee. The screen
  // prints this as "available", so its maximum and the quote's limit are the same figure.
  const spendableFiat = (
    Number(formatUnits(spendableAfterFee(spendableTotal, networkFee), ASSET_DECIMALS)) * fiatPerUsd
  ).toFixed(2);

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
    assetIn,
    swapOut: formatUnits(amountOut, ASSET_DECIMALS),
    minSwapOut: formatUnits(minAmountOut, ASSET_DECIMALS),
    minShares: formatUnits(minShares, ASSET_DECIMALS),
    sharePrice: String(sharePrice),
    vault,
    quoteId,
    hasEnoughBalance,
    networkFee: formatUnits(networkFee, ASSET_DECIMALS),
    networkFeeSource: feeEstimate.source,
    spendableFiat,
  };
}

/**
 * What taking money OUT would do, before anything is signed.
 *
 * A withdrawal is three calls in one Tempo transaction — approve the SHARE token,
 * `redeem(shares, recipient, assetMin)`, then swap the vault's asset back into OUSD:
 *
 *   1. `previewRedeem(shares)` is the vault's own quote, including its fees. That is
 *      the number to trust, not share price × shares, which ignores a withdrawal
 *      fee the vault may charge.
 *   2. `redeem` takes `(uint256, address, uint256)` — NOT the ERC-4626 signature —
 *      so the floor is an asset minimum, not a share one.
 *   3. The swap home carries its own floor, so a moving book cannot under-deliver on
 *      the way back to the spendable asset.
 *
 * An immediate redemption needs liquidity, so this refuses when the vault does not
 * support synchronous redeem. A queued withdrawal is a different product: it has a
 * request, a claim, and a wait, and pretending one is the other is how a savings
 * screen breaks a promise.
 */
export interface SavingsWithdrawQuote {
  network: Network;
  fiatCurrency: string;
  fiatAmount: string;
  /** The shares to redeem, in share units. */
  shares: string;
  /** What the vault says those shares are worth, in its asset units. */
  assetOut: string;
  /** The floor on the redeem, in the vault's asset units. */
  minAssets: string;
  /** The OUSD the swap home must deliver, and its floor. */
  swapOut: string;
  minSwapOut: string;
  /**
   * What that payout is worth in the customer's currency. Computing it here keeps the
   * exchange rate in one place: the screen shows the vault's honest quote, not the
   * number that was typed.
   */
  fiatOut: string;
  vault: string;
  shareToken: string;
  quoteId: string;
  /** True only when the vault redeems immediately. A queued exit is not offered. */
  canWithdraw: boolean;
  /** Vault-wide liquidity, when the vault reports it. Not an account-specific quote. */
  instantLiquidity: string | null;
  /** The account's whole position, for a "withdraw everything" affordance. */
  positionShares: string;
}

export async function quoteSavingsWithdraw(input: {
  userId: string;
  amountFiat: string;
  network?: Network;
}): Promise<SavingsWithdrawQuote> {
  const network = normalizeNetwork(input.network, servedNetwork);
  const vault = SAVINGS_VAULT[network];
  const shareToken = SAVINGS_SHARE_TOKEN[network];
  if (!vault || !shareToken) throw new Error(`Savings are not offered on ${network}.`);

  const amountFiat = Number(input.amountFiat);
  if (!Number.isFinite(amountFiat) || amountFiat <= 0) {
    throw new Error('The amount to withdraw must be a positive number.');
  }

  const chainId = network === 'mainnet' ? 4217 : 42431;
  const vaultRecord = await earnGet<EarnVault>(`/vaults/${vault}?chainId=${chainId}`);
  const address = await walletAddressFor(input.userId, network);

  const fiatCurrency = await resolveUserFiat(input.userId);
  const fx = await getFxQuote(fiatCurrency);
  const fiatPerUsd = fx.fiatPerUsd;

  const sharePrice = Number(vaultRecord?.sharePrice?.formatted ?? '1');
  const synced = vaultRecord?.capabilities?.syncRedeem === true;

  // Shares to redeem for this fiat amount. The vault's own preview is the authority
  // on what they are worth, so this only decides HOW MANY.
  const assetsWanted = amountFiat / fiatPerUsd;
  const shares = sharePrice > 0 ? assetsWanted / sharePrice : 0;
  const shareAmount = parseUnits(shares.toFixed(ASSET_DECIMALS), ASSET_DECIMALS);

  let assetOut = BigInt(0);
  if (address && shareAmount > BigInt(0)) {
    try {
      // The ABI's return type is `uint256`, so viem already types this as bigint.
      assetOut = await publicClientFor(network).readContract({
        address: vault as `0x${string}`,
        abi: VAULT_REDEEM_ABI,
        functionName: 'previewRedeem',
        args: [shareAmount],
      });
    } catch {
      assetOut = BigInt(0);
    }
  }

  const minAssets = (assetOut * BigInt(10_000 - SAVINGS_TOLERANCE_BPS)) / BigInt(10_000);

  // The swap home: the vault's asset back to OUSD, priced on the same book the
  // deposit came through.
  let swapOut = BigInt(0);
  let minSwapOut = BigInt(0);
  if (assetOut > BigInt(0) && isAllowedPair(SAVINGS_ASSET, 'ousd', network)) {
    const quoted = await quoteDexConvert({
      assetIn: SAVINGS_ASSET,
      assetOut: 'ousd',
      amountIn: assetOut,
      network,
    });
    swapOut = quoted.amountOut;
    minSwapOut = quoted.minAmountOut;
  }

  const position = address
    ? await earnGet<{ shareBalance: string }>(`/vaults/${vault}/positions/${address}?chainId=${chainId}`)
    : null;

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
    shares: formatUnits(shareAmount, ASSET_DECIMALS),
    assetOut: formatUnits(assetOut, ASSET_DECIMALS),
    minAssets: formatUnits(minAssets, ASSET_DECIMALS),
    swapOut: formatUnits(swapOut, ASSET_DECIMALS),
    minSwapOut: formatUnits(minSwapOut, ASSET_DECIMALS),
    fiatOut: (Number(formatUnits(swapOut, ASSET_DECIMALS)) * fiatPerUsd).toFixed(2),
    vault,
    shareToken,
    quoteId,
    canWithdraw: synced && assetOut > BigInt(0),
    instantLiquidity: vaultRecord?.instantLiquidity ?? null,
    positionShares: position ? formatUnits(BigInt(position.shareBalance), ASSET_DECIMALS) : '0',
  };
}
