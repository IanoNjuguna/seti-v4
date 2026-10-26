import { prisma } from '../lib/prisma.js';
import {
  getOnChainBalance,
  assetsForNetwork,
  PRIMARY_ASSET,
  type SupportedAsset,
} from './chain.js';
import { symbolFor } from '../config/assets.js';
import type { AssetBalanceRow } from '../types/index.js';
import { servedNetwork } from '../config/networks.js';
import type { Network } from '../lib/network.js';
import { isValidEvmAddress } from '../lib/address.js';
import type { Hex } from 'viem';

export interface BalanceResult {
  /** Which asset was read. A LABEL for logs and internal routing, never a filter. */
  asset: SupportedAsset;
  /** The amount, in the asset's own units. Internal: the customer sees a fiat total. */
  balance: string;
}

/** A balance read for ONE asset. Internal: the customer is shown a fiat total. */
export async function getUserBalance(
  userId: string,
  asset: SupportedAsset = PRIMARY_ASSET,
  network: Network = servedNetwork
): Promise<BalanceResult> {
  // A wallet row is an ADDRESS, and an address holds every token — so the asset
  // must not filter which row we find. Filtering by it meant a user whose wallet
  // was registered as `ousd` had no balance in `pathusd` at all, because the row
  // simply wasn't found and this returned 0.00. Prefer a row that names the asset
  // (historical rows do), but fall back to any active wallet and read the token
  // at its address. The `asset` below is a LABEL on an address that holds all of
  // them; it is never a filter on what the address holds.
  //
  // Scoped by NETWORK: a practice balance is not a live balance, and reading the
  // wrong row means reading a balance off the wrong chain.
  const wallet =
    (await prisma.wallet.findFirst({ where: { userId, asset, status: 'active', network } })) ??
    (await prisma.wallet.findFirst({
      where: { userId, status: 'active', network },
      orderBy: { createdAt: 'asc' },
    }));

  if (!wallet) {
    return { asset, balance: '0.00' };
  }

  if (!isValidEvmAddress(wallet.address)) {
    return { asset, balance: '0.00' };
  }

  try {
    const balance = await getOnChainBalance(wallet.address as Hex, asset, network);
    return { asset, balance };
  } catch (error) {
    console.error('[balance] failed to read on-chain balance', error);
    return { asset, balance: '0.00' };
  }
}

/**
 * One entry per asset the served chain lists: what the total is MADE OF.
 *
 * The total alone was the whole contract for a long time, and it is a correct
 * total: `getUserTotalBalanceInFiat` reads every listed asset and adds them. What a
 * customer could not do was find out which stablecoin their money arrived in, and
 * what the markets move would have to say about which asset it takes. This is that
 * missing half.
 */
/** Same shape as `AssetBalanceRow` in `types/index.ts`, narrowed to a supported asset. */
export type SupportedAssetBalanceRow = AssetBalanceRow & { asset: SupportedAsset };

/** Ordering value for a row: malformed is last, not first, and never NaN. */
function orderValue(amount: string): number {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}

/**
 * The rows, one per listed asset, largest first and zeros last.
 *
 * Zeros are KEPT, deliberately. A customer holding only USDT0 has three real zeros,
 * and dropping them would make the breakdown disagree with the total that counts
 * them — the same class of bug as reading one asset and calling it the balance.
 *
 * The reader is the same shape the total uses, so a caller can produce both from ONE
 * set of reads and the two cannot drift apart.
 */
export async function assetBalanceRows(
  read: (asset: SupportedAsset) => Promise<{ asset: SupportedAsset; balance: string }>,
  assets: readonly SupportedAsset[]
): Promise<SupportedAssetBalanceRow[]> {
  const read_rows = await Promise.all(
    assets.map(async (asset, index) => {
      const { balance } = await read(asset);
      return { index, row: { asset, symbol: symbolFor(asset), amount: balance } };
    })
  );

  return read_rows
    .sort((a, b) => {
      const difference = orderValue(b.row.amount) - orderValue(a.row.amount);
      return difference !== 0 ? difference : a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** The rows for one customer, read on the network their wallet belongs to. */
export async function getUserAssetBalances(
  userId: string,
  network: Network = servedNetwork
): Promise<SupportedAssetBalanceRow[]> {
  return assetBalanceRows(
    (asset) => getUserBalance(userId, asset, network),
    assetsForNetwork(network)
  );
}

/**
 * One fiat total from per-asset stablecoin balances — the arithmetic of the
 * balance card, isolated so it can be proven without a chain or a database.
 *
 * Every supported asset is 1:1 USD, so this is ONE conversion at ONE rate, not
 * four: a quote per asset would be four chances to disagree and four numbers to
 * refresh. The caller passes the rate from the same `getFxQuote()` the pay screen
 * uses, so the home card and the pay screen cannot quote different figures for
 * the same money.
 *
 * Zeros are ordinary: an account holding only USDT0 sums three zero balances and
 * one real one. That is the shape of the bridged-deposit bug this replaces — the
 * money was there, the read said 0.00 because it only looked at two assets.
 */
export function sumBalancesInFiat(
  balances: ReadonlyArray<{ asset: SupportedAsset; balance: string }>,
  fiatPerUsd: number
): string {
  const totalUsd = balances.reduce((sum, entry) => {
    const value = Number(entry.balance);
    // A malformed balance is not zero: counting it as zero would silently drop
    // real money from a customer's total. NaN propagates, and the caller sees it.
    return sum + (Number.isFinite(value) ? value : Number.NaN);
  }, 0);

  const rate = Number.isFinite(fiatPerUsd) ? fiatPerUsd : 0;
  return (totalUsd * rate).toFixed(2);
}

/**
 * One fiat total from a list of assets, read through a caller-supplied reader.
 *
 * This is the summing LOOP, extracted so its behaviour — read EVERY listed asset,
 * sum them in one currency, convert ONCE — can be proven against a fixed set of
 * balances without a chain or a database. `getUserTotalBalanceInFiat` is the
 * production call; `balance-assets.check.ts` is the proof.
 *
 * The reader is called once per asset and the results are summed in full. A
 * read that fails arrives as `'0.00'` from `getUserBalance` (which logs and
 * fails soft) — the total then understates rather than throwing, which is the
 * same behaviour the card has always had.
 */
export async function totalBalanceInFiat(
  read: (asset: SupportedAsset) => Promise<{ asset: SupportedAsset; balance: string }>,
  assets: readonly SupportedAsset[],
  fiatPerUsd: number
): Promise<string> {
  const balances = await Promise.all(assets.map((asset) => read(asset)));
  return sumBalancesInFiat(balances, fiatPerUsd);
}

/** A row that carries its own value, in the currency the total is quoted in. */
export type ValuedAssetBalanceRow = SupportedAssetBalanceRow & { value: string };

/**
 * The home card's rows AND its total, from one read at one rate.
 *
 * The card puts a figure on top and lists what it is made of underneath, so the two
 * have to be the same arithmetic: `balance` here is the SUM OF THE ROWS AS SHOWN, not
 * a second total computed from the underlying amounts. That distinction is the whole
 * point. Rounding each row to a cent and then rounding the whole can land a cent
 * apart, and a screen whose rows add up to a different figure from the one at the top
 * contradicts itself — the customer cannot tell which half to believe, and the half
 * they check by adding will be the one that looks wrong.
 *
 * The rate is passed in, never defaulted: a hardcoded rate made the card quote a
 * different figure from the pay screen, which uses the live `getFxQuote()` rate. The
 * caller passes the rate from that same quote, so both surfaces price the same money
 * identically.
 *
 * A malformed balance becomes NaN in its row and therefore in the total, for the
 * reason `sumBalancesInFiat` gives: counting it as zero would hide money, and the
 * caller must see the fault rather than a tidy number that is missing some of it.
 */
export function homeBalanceInFiat(
  rows: readonly SupportedAssetBalanceRow[],
  fiatPerUsd: number
): { assets: ValuedAssetBalanceRow[]; balance: string } {
  const rate = Number.isFinite(fiatPerUsd) ? fiatPerUsd : 0;

  const assets = rows.map((row) => {
    const amount = Number(row.amount);
    const fiat = (Number.isFinite(amount) ? amount : Number.NaN) * rate;
    return { ...row, value: fiat.toFixed(2) };
  });

  const balance = assets.reduce((sum, row) => sum + Number(row.value), 0).toFixed(2);

  return { assets, balance };
}

/**
 * Total balance across every asset THIS CHAIN lists, in fiat.
 *
 * The rate is passed in rather than defaulted. A hardcoded rate here meant the
 * home dashboard quoted a different KES figure from the pay screen, which uses
 * the live `getFxQuote()` rate — two numbers for the same balance in one app.
 * Callers should pass the rate from that same quote.
 *
 * The asset list is the CHAIN's, not the product's: USDT0 is mainnet-only, and
 * asking the practice chain about a token its registry does not carry is a read
 * that can only return nonsense.
 */
export async function getUserTotalBalanceInFiat(
  userId: string,
  fiatPerUsd: number,
  network: Network = servedNetwork
): Promise<string> {
  return totalBalanceInFiat(
    (asset) => getUserBalance(userId, asset, network),
    assetsForNetwork(network),
    fiatPerUsd
  );
}

/**
 * Which of the customer's assets should pay this transfer.
 *
 * `PRIMARY_ASSET` first, then the chain's remaining assets in display order — the
 * first whose balance covers `requiredAsset`. This is what makes a payment work
 * from any of the four: without it the client signed the primary asset and a
 * customer whose money had arrived as USDT0 was told they had nothing, even though
 * their balance card showed the money.
 *
 * When nothing covers the amount, the LARGEST balance is returned rather than the
 * primary one, so the subsequent sufficiency check fails against the money the
 * customer actually has instead of against an empty asset. The caller still decides
 * whether that is enough; this chooses, it does not authorise.
 */
export async function pickSpendAsset(
  userId: string,
  requiredAsset: number,
  network: Network = servedNetwork
): Promise<SupportedAsset> {
  const listed = assetsForNetwork(network);
  const ordered = [PRIMARY_ASSET, ...listed.filter((asset) => asset !== PRIMARY_ASSET)].filter(
    (asset) => listed.includes(asset)
  );

  const balances = await Promise.all(
    ordered.map(async (asset) => ({ asset, value: Number((await getUserBalance(userId, asset, network)).balance) }))
  );

  const covering = balances.find((entry) => Number.isFinite(entry.value) && entry.value >= requiredAsset);
  if (covering) return covering.asset;

  const richest = balances.reduce(
    (best, entry) => (entry.value > best.value ? entry : best),
    balances[0] ?? { asset: PRIMARY_ASSET, value: 0 }
  );

  return richest.asset;
}
