/**
 * The receipt: what actually happened on chain, annotated with what we recorded.
 *
 * The chain is the authority. A receipt is therefore built by READING it — block,
 * hash, every token movement, the gas payment — and merging in the one thing only
 * we know: what it was worth in the customer's currency, at the rate in force when
 * the row was written. Nothing here is remembered from the request that created the
 * transfer; if the chain disagrees with our row, the chain wins, which is the point
 * of showing a receipt at all.
 *
 * Modelled on Tempo's explorer receipt, with two deliberate differences: the fee is
 * named in the customer's words ("Platform fee", "Network fee"), never our internal
 * ones, and the fiat figures come from the fx rate stored on the row, so an old
 * receipt still explains itself.
 */
import {
  decodeEventLog,
  getAddress,
  parseAbiItem,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { prisma } from '../lib/prisma.js';
import {
  FEE_AMM_ADDRESS,
  assetDecimals,
  assetForContract,
  servedNetwork,
  formatUnits,
  getBlockTimestamp,
  getTransactionReceipt,
} from './chain.js';
import { networkConfigFor, treasuryAddressFor } from '../config/networks.js';
import { NETWORK_LABEL, normalizeNetwork, type Network } from '../lib/network.js';
import type { SupportedAsset } from '../config/networks.js';

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

/**
 * What a movement is, in the customer's terms.
 *
 * `gas` is the one that matters: a transaction paying its fee in a stablecoin pays
 * gas as an ordinary Transfer to Tempo's fee address, so without this classification
 * the customer's own gas would be listed as a payment to a stranger.
 */
export type ReceiptLegRole = 'payment' | 'platform-fee' | 'gas';

export interface ReceiptLeg {
  /** 1-based, in the order the transaction executed them. */
  index: number;
  role: ReceiptLegRole;
  /** The human name for the role — already in the customer's vocabulary. */
  label: string;
  asset: string;
  tokenAddress: string;
  from: string;
  to: string;
  /** Exact, in the token's own units — the number the chain moved. */
  amount: string;
  /** True when this leg is the customer's own money, either direction. */
  mine: boolean;
}

/** Options for {@link classifyReceiptLegs}. */
export interface ClassifyLegsOptions {
  /**
   * The account's own address, compared case-insensitively (an address is stored
   * in whatever casing registered it). Decides the `mine` flag on every leg.
   */
  mineAddress: string;
  /**
   * The treasury of the RECEIPT'S network — a practice receipt's platform-fee leg
   * must be recognised against the practice treasury, not the live one. An empty
   * string DISABLES fee detection rather than matching every leg.
   */
  treasuryAddress: string;
  /** Human label for the principal (`payment`) leg. Defaults to 'Recipient'. */
  principalLabel?: string;
  /**
   * The network the RECEIPT is on. Required for a correct answer whenever the
   * asset could be bridged USDC: its contract address differs per chain, so a
   * leg decoded against the served network's address map would not be recognised
   * and would vanish from the receipt. Defaults to the served network only for
   * callers that have already established the two are the same.
   */
  network?: Network;
}

/**
 * Decodes a receipt's token movements into the legs the product speaks about,
 * classified as `payment` / `platform-fee` / `gas`.
 *
 * The ONE decoder for a receipt's legs: `buildReceipt` renders it, and any tool
 * that must reason about the same receipt — a backfill reconciling a batch, a
 * check — calls it instead of re-implementing the classification. A second
 * decoder is how two readers of the same receipt come to disagree about which
 * leg was the fee.
 *
 * A Tempo transaction pays its own gas in a stablecoin, so its gas is an ordinary
 * Transfer to `FEE_AMM_ADDRESS`; without the gas classification the account's own
 * gas reads as a payment to a stranger.
 */
export function classifyReceiptLegs(
  receipt: TransactionReceipt,
  options: ClassifyLegsOptions
): ReceiptLeg[] {
  const mine = options.mineAddress.toLowerCase();
  const treasury = options.treasuryAddress.toLowerCase();
  const principalLabel = options.principalLabel ?? 'Recipient';
  const legs: ReceiptLeg[] = [];

  const logNetwork = options.network ?? servedNetwork;

  for (const log of receipt.logs) {
    const asset = assetForContract(log.address, logNetwork);
    if (!asset) continue;

    let decoded;
    try {
      decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });
    } catch {
      // Not a Transfer — a log this token emitted for another event. Skip it.
      continue;
    }

    // decodeEventLog types these from the parsed ABI item, so no assertion is needed —
    // an assertion here would be rejected by lint as well as lying about the types.
    const { from, to, value } = decoded.args;
    const toLower = to.toLowerCase();
    const gas = toLower === FEE_AMM_ADDRESS.toLowerCase();
    const platformFee = !gas && treasury.length > 0 && toLower === treasury;

    legs.push({
      index: legs.length + 1,
      role: gas ? 'gas' : platformFee ? 'platform-fee' : 'payment',
      label: gas ? 'Network fee' : platformFee ? 'Platform fee' : principalLabel,
      asset,
      tokenAddress: log.address,
      from: getAddress(from),
      to: getAddress(to),
      amount: formatUnits(value, assetDecimals[asset]),
      mine: gas
        ? from.toLowerCase() === mine
        : from.toLowerCase() === mine || toLower === mine,
    });
  }

  return legs;
}

export interface ReceiptDocument {
  hash: string;
  /**
   * The network this receipt is from — `testnet` (Practice) or `mainnet` (Live),
   * with its product word in `networkLabel`.
   *
   * EVERY receipt names its network, so a link shared with someone else is never
   * ambiguous about which chain moved the money. A practice receipt and a live
   * one can carry the same shape and different chains; without this the reader
   * has no way to tell them apart.
   */
  network: Network;
  networkLabel: string;
  blockNumber: number;
  timestamp: string;
  status: 'confirmed' | 'failed';
  from: string;
  legs: ReceiptLeg[];
  /** The gas line, itemised separately — as the explorer shows it. */
  networkFee: { asset: string; amount: string; fiatAmount: string | null };
  /** What the customer's side of this transfer came to, gas excluded. */
  total: { asset: string; amount: string; fiatAmount: string; fiatCurrency: string | null };
  ledger: {
    direction: 'in' | 'out';
    fiatAmount: number;
    /**
     * Nullable on purpose: rows written before the currency was stored have none, and
     * the receipt must say so rather than invent the customer's currency for them.
     */
    fiatCurrency: string | null;
    platformFeeFiat: number | null;
    fxRate: number | null;
    fxRateSource: string | null;
    fxRateAsOf: string | null;
    title: string;
  };
  explorerUrl: string;
}

/**
 * Builds the receipt for one of the caller's own rows.
 *
 * Returns null when the row is not theirs or has nothing on chain — the route turns
 * that into a 404, so a receipt can never be a way to read someone else's transfer.
 */
export async function buildReceipt(
  transactionId: string,
  userId: string
): Promise<ReceiptDocument | null> {
  const row = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    include: { merchant: true, wallet: true },
  });

  if (!row?.txHash) return null;

  const rowNetwork = normalizeNetwork(row.network);

  // The RECEIPT's own network, not the served one: this row may be a practice
  // payment while the deployment serves live, and reading the served chain for its
  // hash is what made receipts refuse to load. `rowNetwork` was already computed
  // here for the treasury leg; it is now what the chain reads use too.
  const receipt = await getTransactionReceipt(row.txHash as Hex, rowNetwork);

  // The treasury of THIS receipt's network — a practice receipt's platform-fee
  // leg must be recognised against the practice treasury, not the live one.
  //
  // The legs are decoded by the ONE shared classifier below, so this receipt and
  // any tool that reasons about a receipt read the same legs the same way.
  const legs = classifyReceiptLegs(receipt, {
    mineAddress: row.wallet?.address ?? '',
    treasuryAddress: treasuryAddressFor(rowNetwork),
    principalLabel: row.merchant?.name ?? 'Recipient',
    // The receipt's own network, the same one the receipt was read from.
    network: rowNetwork,
  });

  const gasLegs = legs.filter((leg) => leg.role === 'gas');
  const mineLegs = legs.filter((leg) => leg.mine && leg.role !== 'gas');
  const primaryAsset = (row.asset as SupportedAsset) ?? 'ousd';
  const fxRate = row.fxRate ? Number(row.fxRate) : null;

  const sum = (items: ReceiptLeg[]) =>
    items
      .filter((leg) => leg.asset === primaryAsset)
      .reduce((total, leg) => total + Number(leg.amount), 0);

  const gasAmount = gasLegs
    .filter((leg) => leg.asset === primaryAsset)
    .reduce((total, leg) => total + Number(leg.amount), 0);

  return {
    hash: row.txHash,
    network: rowNetwork,
    networkLabel: NETWORK_LABEL[rowNetwork],
    blockNumber: Number(receipt.blockNumber),
    timestamp: (await getBlockTimestamp(receipt.blockNumber, rowNetwork)).toISOString(),
    status: receipt.status === 'success' ? 'confirmed' : 'failed',
    from: getAddress(receipt.from),
    legs,
    networkFee: {
      asset: primaryAsset,
      amount: String(gasAmount),
      // Quoted at the rate this row was written with, so the figure is the one the
      // customer was shown — not today's.
      fiatAmount: fxRate ? String(gasAmount * fxRate) : null,
    },
    total: {
      asset: primaryAsset,
      amount: String(sum(mineLegs)),
      fiatAmount: String(row.fiatAmount ?? sum(mineLegs) * (fxRate ?? 0) + (row.feeAmount ? Number(row.feeAmount) : 0)),
      fiatCurrency: row.fiatCurrency,
    },
    ledger: {
      // Set which way the money went; never inferred here.
      direction: row.type === 'p2p_receive' || row.type === 'top_up' ? 'in' : 'out',
      fiatAmount: Number(row.fiatAmount ?? 0),
      fiatCurrency: row.fiatCurrency,
      platformFeeFiat: row.feeAmount ? Number(row.feeAmount) : null,
      fxRate,
      fxRateSource: row.fxRateSource,
      fxRateAsOf: row.fxRateAsOf ? row.fxRateAsOf.toISOString() : null,
      title: row.merchant?.name ?? (row.type === 'p2p_receive' ? 'Received' : 'Sent'),
    },
    explorerUrl: `${networkConfigFor(rowNetwork).explorerUrl}/receipt/${row.txHash}`,
  };
}
