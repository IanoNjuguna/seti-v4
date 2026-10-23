/**
 * Where an unmatched arrival is KEPT, and the reads that put it in front of a
 * merchant.
 *
 * `services/arrival.ts` decides what an arrival IS and what it says; this file is
 * the only place an arrival row is written. The same split as
 * `charge.ts` / `charge-store.ts`, and for the same reason: a rule that appears in
 * two files is two rules, and the difference is found by a customer.
 *
 * ## There is no charge column, on purpose
 *
 * An arrival is money with NO charge behind it. The table therefore has nowhere to
 * put a charge id, not even a nullable one, so "this arrival was quietly attached
 * to a pending charge" is not a bug someone could introduce with an UPDATE: it is a
 * migration. A future "the merchant says this was charge 123" is a separate,
 * deliberate feature with its own signature and its own audit trail, and it does not
 * start by widening this row.
 *
 * ## Why one row per (transaction, recipient, asset, network)
 *
 * A transfer is a transfer: the indexer re-scans overlapping windows on a
 * retry or a restart, and a replay must not turn one payment into two arrivals the
 * merchant reads twice. The unique key is the idempotency, not a check-then-write,
 * so two replicas racing produce one row and one audit event.
 *
 * ## Who a row belongs to at READ time
 *
 * The row stores the ADDRESS, never a user id. A handle can be renamed, moved or
 * released, and an address is the thing that received the money. The read resolves
 * the caller's addresses from what they hold now (their wallets and their live
 * handle claims), so an arrival follows the address, which is the only honest
 * answer to "whose money is this".
 */
import { prisma } from '../lib/prisma.js';
import { ASSET_DECIMALS } from '../config/assets.js';
import type { Network } from '../lib/network.js';
import {
  ARRIVAL_COPY,
  classifyArrival,
  type ArrivalCharge,
  type ArrivalCopy,
  type ObservedArrival,
} from './arrival.js';
import { logAuditEvent } from './audit.js';
import type { AddressArrival } from '@prisma/client';

/** One arrival the pass recorded, or refused with the code that stopped it. */
export interface RecordedArrival {
  txHash: string;
  recipient: string;
  asset: string;
  amount: string;
  /** The row's id when it was written, null when it was already there or refused. */
  id: string | null;
  /** The refusal code, when the classifier or the database stopped it. */
  code?: string;
}

/** A stored row, as a surface renders it: facts only. */
export interface ArrivalView {
  txHash: string;
  /** The address that received the money. */
  recipient: string;
  /** Who sent it, as the chain recorded. The one handle on asking them. */
  from: string;
  asset: string;
  /** Decimal token units, exactly as the chain moved them. */
  amount: string;
  /** The block, when the log carried one. Null means unknown, never zero. */
  blockNumber: string | null;
  /** When this pass first recorded it. */
  seenAt: string;
}

/**
 * The row, as the object a surface renders.
 *
 * There is no `status` and no `charge` key, and their absence is the feature: a
 * client cannot render a state this row does not have. `copy` carries the product's
 * words for why it exists ({@link ARRIVAL_COPY}).
 */
export function toArrivalView(row: AddressArrival): ArrivalView {
  return {
    txHash: row.txHash,
    recipient: row.recipient,
    from: row.fromAddress,
    asset: row.asset,
    amount: row.amount,
    blockNumber: row.blockNumber?.toString() ?? null,
    seenAt: row.createdAt.toISOString(),
  };
}

/**
 * Record a pass of observed transfers as arrivals, or refuse them.
 *
 * The charge rows are read ONCE per distinct recipient, not once per transfer: a
 * window carries a handful of transfers to a handful of addresses, and a query per
 * log is how a tick becomes a slow query. The classifier then decides each one from
 * what was read, and this function's only job is to write what it decided.
 *
 * `charges` is read with NO status filter. A settled charge is exactly the row that
 * has to be seen: it is what stops its own transaction being recorded again as an
 * unattributed arrival.
 */
export async function recordArrivals(input: {
  arrivals: ObservedArrival[];
  network: Network;
  now?: Date;
}): Promise<RecordedArrival[]> {
  if (input.arrivals.length === 0) return [];

  const now = input.now ?? new Date();

  const recipients = [...new Set(input.arrivals.map((arrival) => arrival.recipient.toLowerCase()))];

  const chargeRows = await prisma.charge.findMany({
    where: { network: input.network, recipient: { in: recipients } },
    select: {
      publicId: true,
      recipient: true,
      asset: true,
      amount: true,
      status: true,
      txHash: true,
    },
  });

  /** `recipient` → the charges at it, in the shape the classifier takes. */
  const chargesByRecipient = new Map<string, ArrivalCharge[]>();
  for (const row of chargeRows) {
    const key = row.recipient.toLowerCase();
    const list = chargesByRecipient.get(key) ?? [];
    list.push({
      id: row.publicId,
      recipient: key,
      asset: row.asset,
      amount: row.amount,
      status: row.status,
      txHash: row.txHash,
    });
    chargesByRecipient.set(key, list);
  }

  const results: RecordedArrival[] = [];

  for (const transfer of input.arrivals) {
    const recipient = transfer.recipient.toLowerCase();

    const decision = classifyArrival({
      transfer: { ...transfer, recipient },
      chargesAtRecipient: chargesByRecipient.get(recipient) ?? [],
    });

    if (decision.kind === 'refuse') {
      results.push({
        txHash: transfer.txHash,
        recipient,
        asset: transfer.asset,
        amount: transfer.amount,
        id: null,
        code: decision.code,
      });
      continue;
    }

    let row: AddressArrival;

    try {
      row = await prisma.addressArrival.create({
        data: {
          network: input.network,
          asset: transfer.asset,
          recipient,
          fromAddress: transfer.sender.toLowerCase(),
          amount: transfer.amount,
          txHash: transfer.txHash,
          blockNumber: transfer.blockNumber,
          createdAt: now,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Seen before: a re-scanned window, a replay, or a second replica. One
        // arrival, one audit event, and the winner already wrote both.
        results.push({
          txHash: transfer.txHash,
          recipient,
          asset: transfer.asset,
          amount: transfer.amount,
          id: null,
          code: 'already-recorded',
        });
        continue;
      }
      throw error;
    }

    results.push({
      txHash: transfer.txHash,
      recipient,
      asset: transfer.asset,
      amount: transfer.amount,
      id: row.id,
    });

    await logAuditEvent({
      action: 'arrival.recorded',
      txHash: transfer.txHash,
      metadata: {
        recipient,
        asset: transfer.asset,
        amount: transfer.amount,
        // The fact this event exists to record, stated where a reconciliation
        // query can count it: money arrived, no charge, no fee.
        chargeId: null,
        feeCollected: false,
        network: input.network,
      },
    });
  }

  return results;
}

/** True when this is Prisma's unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === 'P2002';
}

/**
 * The addresses one indexing window watches for arrivals.
 *
 * Two kinds, and both are PROVEN to belong to someone who means to be paid:
 *
 *  1. the recipient of a charge Seti holds, because that key signed a request for
 *     money;
 *  2. the address of a LIVE handle claim (`reviewStatus: null`, a stored
 *     signature), because a claim is a signature over "pay me here".
 *
 * An address that is only a `Merchant.payoutAddress` is NOT watched: that column is
 * an unsigned string on a profile, and reporting money against a claim nobody signed
 * is precisely the class of guess this module refuses.
 *
 * Capped, and the union is taken in memory: two indexed reads with a `distinct`
 * each, not a `UNION` over a table that has no reason to exist.
 */
export async function watchedArrivalRecipients(
  network: Network,
  limit: number
): Promise<string[]> {
  const [chargeRows, handleRows] = await Promise.all([
    prisma.charge.findMany({
      where: { network },
      distinct: ['recipient'],
      select: { recipient: true },
      orderBy: { recipient: 'asc' },
      take: limit,
    }),
    prisma.handle.findMany({
      where: { network, reviewStatus: null, claimSignature: { not: null } },
      distinct: ['address'],
      select: { address: true },
      orderBy: { address: 'asc' },
      take: limit,
    }),
  ]);

  const addresses = new Set<string>();
  for (const row of chargeRows) addresses.add(row.recipient.toLowerCase());
  for (const row of handleRows) addresses.add(row.address.toLowerCase());

  return [...addresses].slice(0, limit);
}

/**
 * The addresses the CALLER holds, for a merchant-facing read.
 *
 * Their active wallets on this network, and the addresses of their live handle
 * claims. Read from what the account holds NOW: a handle moved to someone else
 * takes its arrivals with it, because the money went to the address and the address
 * is what the account holds or does not.
 */
export async function ownedArrivalAddresses(
  userId: string,
  network: Network
): Promise<string[]> {
  const [wallets, handles] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId, network, status: 'active' },
      select: { address: true },
    }),
    prisma.handle.findMany({
      where: { userId, network, reviewStatus: null, claimSignature: { not: null } },
      select: { address: true },
    }),
  ]);

  const addresses = new Set<string>();
  for (const row of wallets) addresses.add(row.address.toLowerCase());
  for (const row of handles) addresses.add(row.address.toLowerCase());

  return [...addresses];
}

/** One page of a merchant's arrivals, newest first. */
export async function listArrivals(input: {
  network: Network;
  recipients: string[];
  limit: number;
  offset: number;
}): Promise<AddressArrival[]> {
  if (input.recipients.length === 0) return [];

  return prisma.addressArrival.findMany({
    where: { network: input.network, recipient: { in: input.recipients } },
    orderBy: { createdAt: 'desc' },
    take: input.limit,
    skip: input.offset,
  });
}

/** How much money arrived with no charge, per asset. The leak, measured. */
export interface ArrivalSummary {
  asset: string;
  count: number;
  /** Decimal token units, summed as integers at {@link ASSET_DECIMALS}. */
  amount: string;
}

/**
 * Count and value of arrivals for a set of addresses, per asset.
 *
 * Per asset rather than one total, because the total of two different tokens is a
 * number that means nothing. Summed in base units and formatted back, never through
 * a float: this is the figure a merchant reconciles against.
 */
export async function summariseArrivals(input: {
  network: Network;
  recipients: string[];
}): Promise<ArrivalSummary[]> {
  if (input.recipients.length === 0) return [];

  const rows = await prisma.addressArrival.findMany({
    where: { network: input.network, recipient: { in: input.recipients } },
    select: { asset: true, amount: true },
  });

  const scale = BigInt(10) ** BigInt(ASSET_DECIMALS);
  const totals = new Map<string, { count: number; units: bigint }>();

  for (const row of rows) {
    const current = totals.get(row.asset) ?? { count: 0, units: 0n };
    const units = parseUnitsOrZero(row.amount);
    totals.set(row.asset, { count: current.count + 1, units: current.units + units });
  }

  return [...totals.entries()]
    .map(([asset, total]) => ({
      asset,
      count: total.count,
      amount: formatUnitsFixed(total.units, scale),
    }))
    .sort((left, right) => left.asset.localeCompare(right.asset));
}

/** Base units of a stored amount string, or 0 when it cannot be read. */
function parseUnitsOrZero(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const padded = fraction.padEnd(ASSET_DECIMALS, '0').slice(0, ASSET_DECIMALS);
  try {
    return BigInt(`${whole || '0'}${padded}`);
  } catch {
    return 0n;
  }
}

/** Base units back to a fixed 6-decimal string, the shape every amount column keeps. */
function formatUnitsFixed(units: bigint, scale: bigint): string {
  const whole = units / scale;
  const fraction = (units % scale).toString().padStart(ASSET_DECIMALS, '0');
  return `${whole}.${fraction}`;
}

/** The words a surface renders for an arrival, from the one place they live. */
export function arrivalCopy(): ArrivalCopy {
  return ARRIVAL_COPY;
}
