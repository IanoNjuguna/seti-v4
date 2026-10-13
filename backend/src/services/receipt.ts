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
import { decodeEventLog, getAddress, parseAbiItem, type Hex } from 'viem';
import { prisma } from '../lib/prisma.js';
import {
  FEE_AMM_ADDRESS,
  assetDecimals,
  assetForContract,
  formatUnits,
  getBlockTimestamp,
  getTransactionReceipt,
} from './chain.js';
import { network } from '../config/networks.js';
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

export interface ReceiptDocument {
  hash: string;
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

  const receipt = await getTransactionReceipt(row.txHash as Hex);
  const mine = (row.wallet?.address ?? '').toLowerCase();
  const treasury = (process.env.SETI_TREASURY_ADDRESS ?? '').toLowerCase();

  const legs: ReceiptLeg[] = [];

  for (const log of receipt.logs) {
    const asset = assetForContract(log.address);
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
      label: gas ? 'Network fee' : platformFee ? 'Platform fee' : (row.merchant?.name ?? 'Recipient'),
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
    blockNumber: Number(receipt.blockNumber),
    timestamp: (await getBlockTimestamp(receipt.blockNumber)).toISOString(),
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
    explorerUrl: `${network.explorerUrl}/receipt/${row.txHash}`,
  };
}
