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
 * What the balance rows say about ONE amount.
 *
 * `pickSpendAsset` used to answer this with an asset label and no verdict, and
 * that label was "the richest" whenever nothing covered the amount. Naming a real
 * balance read as correct, and it is what let a quote name an asset that cannot
 * fund the transfer, get signed, and revert inside the token contract with
 * `InsufficientBalance` — translated for the customer as "not enough to cover this
 * payment" (`web/lib/pay/classify-payment-error.ts`), beside a balance card that
 * SUMS across assets (`sumBalancesInFiat`) and says there is enough. True of the
 * account and false of the number the customer is looking at.
 *
 * So the answer is a decision, not a label, and two of its four cases stop the
 * preview before a signature exists:
 *
 * - `covered` — one asset's own balance is at least the amount. The only case that
 *   signs, because a payment spends exactly ONE asset and this is which one.
 * - `under-funded` — the amount was PINNED to an asset (the client named it, or a
 *   check suite did) whose balance is short. Refused with that asset named in the
 *   reason, never quietly switched for one that covers: a switch means the
 *   customer signs a transfer in a token they did not choose, and every figure on
 *   the receipt came from an asset other than the one that left.
 * - `spread` — no single balance covers it, but the SUM across balances does. The
 *   money is real and the payment is impossible in one leg, so the refusal says
 *   the money is in more than one balance instead of naming an asset that cannot
 *   fund it.
 * - `short` — nothing covers it and the sum does not either. Deliberately NOT a
 *   refusal: this customer is simply short. The preview prices what they can see
 *   and `hasEnoughBalance` gives the answer they already read as "add money".
 *   Refusing here would swap a true sentence for one about splitting money that
 *   is not there.
 */
export type SpendAssetChoice =
  | { kind: 'covered'; asset: SupportedAsset }
  | { kind: 'under-funded'; asset: SupportedAsset }
  | { kind: 'spread'; asset: SupportedAsset }
  | { kind: 'short'; asset: SupportedAsset };

/**
 * Decide which asset pays this amount, from balance rows the caller already read.
 *
 * **Row order is the preference**, which is why this takes rows rather than a map:
 * the caller puts `PRIMARY_ASSET` first, so the primary asset pays whenever it
 * alone can, and the chain's remaining assets keep their display order after it.
 * Without that ordering a payment would bill whichever asset happened to be
 * richest, and one asset would collect all the spending, the fee legs and the gas
 * while the others never move.
 *
 * `pinned` is the asset the caller ASKED for. It is honoured only when it covers
 * the amount; otherwise the answer is `under-funded`, which the preview turns into
 * a refusal. The other assets are still read before that verdict, because
 * `under-funded` and `short` are told apart by whether the money exists somewhere
 * else — and only one of those two is worth refusing.
 *
 * Pure, and separated from the reads, so the whole table above can be proven
 * against fixed balances with no chain and no database: the same split
 * `sumBalancesInFiat` uses. `balance-assets.check.ts` is the proof.
 */
export function chooseSpendAsset(
  rows: ReadonlyArray<{ asset: SupportedAsset; balance: string }>,
  requiredAsset: number,
  pinned?: SupportedAsset
): SpendAssetChoice {
  // A balance is in the asset's own units, so it compares to the amount directly.
  // A malformed read becomes zero rather than NaN: NaN would poison the sum below
  // and turn "the money is spread" into "the money is gone".
  const balances = rows.map((row) => {
    const value = Number(row.balance);
    return { asset: row.asset, value: Number.isFinite(value) ? value : 0 };
  });

  // Fail closed on a required amount that is not a number: nothing can cover it,
  // so it resolves like an account holding nothing and `hasEnoughBalance` says no.
  const required = Number.isFinite(requiredAsset) ? requiredAsset : Number.POSITIVE_INFINITY;

  const total = balances.reduce((sum, entry) => sum + entry.value, 0);

  if (pinned) {
    const held = balances.find((entry) => entry.asset === pinned)?.value ?? 0;
    if (held >= required) return { kind: 'covered', asset: pinned };
    return { kind: total >= required ? 'under-funded' : 'short', asset: pinned };
  }

  const covering = balances.find((entry) => entry.value >= required);
  if (covering) return { kind: 'covered', asset: covering.asset };

  const richest = balances.reduce(
    (best, entry) => (entry.value > best.value ? entry : best),
    balances[0] ?? { asset: PRIMARY_ASSET, value: 0 }
  );

  // Two balances, not one: if the sum covers and no single balance does, the money
  // is necessarily held in more than one of them.
  return { kind: total >= required ? 'spread' : 'short', asset: richest.asset };
}

/**
 * Which of the customer's assets should pay this transfer, and whether one can.
 *
 * `PRIMARY_ASSET` first, then the chain's remaining assets in display order, and
 * `chooseSpendAsset` decides from there. This is the read half: one balance per
 * listed asset, scoped to `network`, because a practice payment checked against a
 * live balance (or the reverse) refuses payments the customer can afford and
 * admits ones they cannot.
 *
 * Every listed asset is read, not just the primary one. That was already true —
 * what changed is what the other balances are FOR. They are no longer only a
 * fallback to pay from; they are what tells "the money is in another balance"
 * apart from "the money is not there", and that is the difference between a
 * refusal that names the real problem and a priced preview that says "not enough"
 * beside a card that says otherwise.
 *
 * The caller still decides what to do with the verdict. This reads and chooses; it
 * does not authorise, and nothing here signs.
 */
export async function pickSpendAsset(
  userId: string,
  requiredAsset: number,
  network: Network = servedNetwork,
  pinned?: SupportedAsset
): Promise<SpendAssetChoice> {
  const listed = assetsForNetwork(network);
  const ordered = [PRIMARY_ASSET, ...listed.filter((asset) => asset !== PRIMARY_ASSET)].filter(
    (asset) => listed.includes(asset)
  );

  const rows = await Promise.all(
    ordered.map(async (asset) => ({
      asset,
      balance: (await getUserBalance(userId, asset, network)).balance,
    }))
  );

  return chooseSpendAsset(rows, requiredAsset, pinned);
}
