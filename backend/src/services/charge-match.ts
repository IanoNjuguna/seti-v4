/**
 * The paid side: turning an observed transfer into a decided charge.
 *
 * This module is deliberately thin, and that thinness is the design. Every rule
 * about whether a transfer settles a charge — the payee, the token, the memo, the 1%
 * tolerance, the confirmation — belongs to `classifyCharge` in `services/charge.ts`,
 * which #129 froze and `check:charge` pins at the boundary. Here there is only:
 *
 *  1. which pending charges COULD be about this transfer (a cheap, indexed narrowing
 *     by recipient and asset, plus "the memo mentions the id"),
 *  2. ask the classifier,
 *  3. apply the status it returned, at most once, and let the webhook follow.
 *
 * If a rule ever appears in this file, there are two definitions of `paid` and the
 * difference will be found by a customer. That is why the prefilter is only ever a
 * SUPERSET of the classifier's rules: a transfer it lets through is still refused by
 * the classifier if it does not qualify, and the classifier's refusal is logged.
 *
 * ## Where the memo comes from
 *
 * A TIP-20 transfer carries an optional 32-byte memo (`transferWithMemo`), emitted as
 * `TransferWithMemo(from, to, amount, memo)` beside the ordinary `Transfer`. The
 * memo is `bytes32`, so the charge id is written into it as its UTF-8 bytes padded
 * with zeroes; {@link memoFromBytes32} is the one place that padding is stripped. A
 * plain `Transfer` has no memo at all, so it can never settle a charge — which is
 * correct rather than unfortunate: an anonymous transfer to a merchant's address is
 * not this charge's money, and the classifier refuses it by code
 * (`memo-missing-charge-id`).
 */
import { decodeEventLog, erc20Abi, type TransactionReceipt } from 'viem';
import type { Network } from '../lib/network.js';
import { env } from '../config/env.js';
import { treasuryAddressFor } from '../config/networks.js';
import { logAuditEvent } from './audit.js';
import {
  classifyCharge,
  nextChargeStatus,
  type ChargeFeeInput,
  type ChargeFeeOutcome,
  type ChargeStatus,
  type ObservedFeeLeg,
  type ObservedTransfer,
} from './charge.js';
import { getMerchantFeeSchedule, type FeeRoutingMode, type MerchantFeeSchedule } from './fees.js';
import {
  applyChargeTransition,
  findDueExpiries,
  findPendingCharges,
  toSignedCharge,
  unitsToAmount,
} from './charge-store.js';

/** A transfer the indexer saw, with the asset label of the contract it came from. */
export interface ChargeTransferCandidate extends ObservedTransfer {
  /** The ledger label of the token contract the log was emitted by (`ousd`). */
  asset: string;
}

/** One charge this pass decided. `null` status means "refused; nothing moved". */
export interface ChargeMatchResult {
  chargeId: string;
  txHash: string;
  /** The status the charge moved to, or null when it stayed pending. */
  status: ChargeStatus | null;
  /** The refusal code, when the classifier refused. For logs only. */
  code?: string;
  /**
   * The fee fact for a decided charge, when a decision was made.
   *
   * Reported beside the status rather than folded into it: a result can read
   * `status: 'paid'` with `fee.collected: false`, and that pair is the whole point
   * of the split. Omitted on a refusal, where nothing was decided.
   */
  fee?: ChargeFeeOutcome;
}

/**
 * The fee legs a receipt carries: every Transfer to the treasury in `asset`.
 *
 * A batch is ONE transaction carrying the principal to the recipient and the fee to
 * the treasury, so the receipt is the only place the fee can be observed — and the
 * transfer to the treasury has no memo, no id and nothing else to match on, which
 * is why it has to be read as a transfer rather than looked up as a payment.
 *
 * Decoding, not judging: whether these legs add up to the schedule's fee is
 * `classifyFeeLeg`'s answer. This function's whole job is to make sure the sum
 * cannot be fooled — hence the token contract filter (a Transfer log is emitted by
 * the token contract, so a look-alike event from another contract is not a
 * transfer), the case-insensitive `to` comparison, and the fixed 6-decimal text
 * that every other charge amount uses.
 *
 * The TIP-20 memo variant emits an ordinary `Transfer` beside `TransferWithMemo`,
 * so a fee sent with a memo is found here too. An undecodable log is skipped: it is
 * not evidence of payment, and it must not crash a pass.
 */
export function feeLegsFromReceipt(
  receipt: Pick<TransactionReceipt, 'logs'>,
  input: { token: string; treasury: string; asset: string }
): ObservedFeeLeg[] {
  const token = input.token.toLowerCase();
  const treasury = input.treasury.toLowerCase();

  const legs: ObservedFeeLeg[] = [];

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token) continue;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (decoded.eventName !== 'Transfer') continue;
      if (String(decoded.args.to).toLowerCase() !== treasury) continue;

      legs.push({
        recipient: treasury,
        asset: input.asset,
        // Fixed 6-decimal text, the shape every charge amount uses (and the shape
        // the classifier parses), rather than `formatUnits`'s `"2"`.
        amount: unitsToAmount(decoded.args.value),
      });
    } catch {
      // Not a Transfer we can read: not evidence of a fee, and never a crash.
    }
  }

  return legs;
}

/**
 * Reads the treasury legs of the transaction that carried a principal.
 *
 * Injected into {@link matchChargeTransfers} rather than implemented there, for the
 * same reason `recipientHasCode` is injected into the classifier: the decision stays
 * testable without a node, and the caller that HAS an RPC client is the one that
 * pays for the read. The indexer reads the receipt once per transaction.
 */
export type ChargeFeeLookup = (input: {
  txHash: string;
  asset: string;
}) => Promise<ObservedFeeLeg[]>;

/**
 * The text of a TIP-20 32-byte memo.
 *
 * MOVED, not changed (#184). The implementation lives in `lib/tip20-memo.ts`,
 * which has no imports at all, and is re-exported here so the matcher, the
 * indexer and every existing caller keep the same import path. It was moved for
 * ONE reason: `check:memo-always` in `web/` proves the pay page's builder writes a
 * memo this function can read back, and it has to call this function rather than a
 * copy of it. Loading the matcher's whole module graph to reach a pure string
 * function would drag in the database client and every required environment
 * variable, so the function sits in a file that can be loaded on its own.
 *
 * `bytes32` is right-padded with zeroes, so the decoded string carries NULs after the
 * id. Those are stripped there rather than at the comparison, because the classifier
 * asserts `memo.includes(id)` on a TEXT memo — that is the frozen contract, and
 * teaching it about padding would change what a stored signature means.
 *
 * An unreadable memo yields `''`, which can never carry an id: the fail-closed
 * direction, since an unreadable memo is not evidence of a match.
 */
export { memoFromBytes32 } from '../lib/tip20-memo.js';

/**
 * Match a pass of observed transfers against pending charges.
 *
 * Bounded and batched: pending charges are read ONCE per (asset) per pass, so a
 * backlog of small windows does not turn into one query per log. A pass with no
 * pending charge returns immediately and costs one indexed SELECT.
 */
export async function matchChargeTransfers(input: {
  transfers: ChargeTransferCandidate[];
  network: Network;
  chainId: number;
  now?: Date;
  /**
   * Reads the treasury legs of the transaction that carried a principal.
   *
   * Omitted means "this caller cannot see the receipt", and the fee fact is then
   * `fee-not-observed` — uncollected, on the fail-closed side. The indexer always
   * passes one; a unit fixture that is about something else need not.
   */
  feeLookup?: ChargeFeeLookup;
  /**
   * How this deployment routes the 2%. Defaults to the live config, and a fixture
   * can override it to prove the inside-transfer branch without changing process
   * env.
   */
  feeRouting?: FeeRoutingMode;
  /** The schedule the expectation is measured against. Defaults to the live one. */
  feeSchedule?: MerchantFeeSchedule;
}): Promise<ChargeMatchResult[]> {
  if (input.transfers.length === 0) return [];

  const now = input.now ?? new Date();

  /**
   * The fee leg's three constants, read once per pass rather than once per charge.
   *
   * `routing !== 'batch'` is normalised to `inside-transfer` deliberately: any value
   * that is not the mode where the treasury receives the fee must not be treated as
   * fee-collected, and defaulting an unknown value to `batch` would claim money the
   * deployment is not collecting.
   */
  const feeRouting: FeeRoutingMode =
    input.feeRouting ?? (env.FEE_ROUTING_MODE === 'batch' ? 'batch' : 'inside-transfer');
  const feeTreasury = treasuryAddressFor(input.network);
  const feeSchedule = input.feeSchedule ?? getMerchantFeeSchedule();

  /** One receipt read per transaction, however many charges point at it. */
  const feeLegsByTx = new Map<string, Promise<ObservedFeeLeg[]>>();
  const feeLegsFor = (txHash: string, asset: string): Promise<ObservedFeeLeg[]> => {
    if (!input.feeLookup) return Promise.resolve([]);
    const key = txHash.toLowerCase();
    const cached = feeLegsByTx.get(key);
    if (cached) return cached;
    // A failed read is an empty list, not a thrown pass: the fee fact must fail
    // CLOSED (uncollected), and the payment must still be recorded.
    const pending = input.feeLookup({ txHash, asset }).catch(() => []);
    feeLegsByTx.set(key, pending);
    return pending;
  };

  const byAsset = new Map<string, Set<string>>();
  for (const transfer of input.transfers) {
    const recipients = byAsset.get(transfer.asset) ?? new Set<string>();
    recipients.add(transfer.recipient.toLowerCase());
    byAsset.set(transfer.asset, recipients);
  }

  /** `${asset}:${recipient}` → the pending charges a transfer there could settle. */
  const candidates = new Map<string, Awaited<ReturnType<typeof findPendingCharges>>>();

  for (const [asset, recipients] of byAsset) {
    const rows = await findPendingCharges({
      network: input.network,
      asset,
      recipients: [...recipients],
    });

    for (const row of rows) {
      const key = `${asset}:${row.recipient.toLowerCase()}`;
      const list = candidates.get(key) ?? [];
      list.push(row);
      candidates.set(key, list);
    }
  }

  const results: ChargeMatchResult[] = [];

  for (const transfer of input.transfers) {
    const key = `${transfer.asset}:${transfer.recipient.toLowerCase()}`;
    const rows = candidates.get(key);
    if (!rows || rows.length === 0) continue;

    for (const row of rows) {
      // Prefilter only: the id has to be IN the memo for this transfer to be about
      // this charge at all. A memo that does not mention it is skipped WITHOUT a
      // classification — otherwise every pending charge at a busy address would be
      // re-refused on every 15-second pass, and the log would fill with a fact that
      // cannot change. The classifier's `memo-missing-charge-id` refusal is its own
      // contract and is pinned by `check:charge`.
      if (!transfer.memo.includes(row.publicId)) continue;

      /**
       * The fee observation for THIS transaction.
       *
       * Built even when the caller passed no lookup, so the difference between
       * "looked and found nothing" and "did not look" is carried by the classifier
       * rather than guessed here. The treasury address and the routing mode are the
       * deployment's, not the transfer's.
       */
      const fee: ChargeFeeInput | undefined = input.feeLookup
        ? {
            routing: feeRouting,
            treasury: feeTreasury,
            legs: await feeLegsFor(transfer.txHash, transfer.asset),
            schedule: feeSchedule,
          }
        : undefined;

      const decision = await classifyCharge({
        charge: toSignedCharge(row),
        transfer,
        chainId: input.chainId,
        now,
        fee,
      });

      if (!decision.ok) {
        results.push({
          chargeId: row.publicId,
          txHash: transfer.txHash,
          status: null,
          code: decision.code,
        });
        continue;
      }

      const next = nextChargeStatus(row.status, decision);
      if (!next) {
        results.push({
          chargeId: row.publicId,
          txHash: transfer.txHash,
          status: null,
          code: 'charge-not-pending',
        });
        continue;
      }

      const applied = await applyChargeTransition({
        row,
        to: next,
        txHash: transfer.txHash,
        received: transfer.amount,
        fee: { collected: decision.fee.collected, reason: decision.fee.reason },
        now,
      });

      // `null` means another actor got there first — a replayed transfer, a second
      // replica, a cancel. Nothing moved, so nothing is reported and nothing is
      // webhooked; the winner already did both.
      if (!applied) continue;

      results.push({ chargeId: row.publicId, txHash: transfer.txHash, status: next, fee: decision.fee });

      // A paid charge whose fee did not arrive is the exact thing this pass exists
      // to SURFACE. It is not an error — the payment is real — so it is a warning
      // with the reason code, never a refusal and never silence.
      if (!decision.fee.collected) {
        const expected =
          decision.fee.expectedUnits === null
            ? 'not measured'
            : `${decision.fee.expectedUnits} units`;
        const observed =
          decision.fee.observedUnits === null
            ? 'nothing at the treasury'
            : `${decision.fee.observedUnits} units`;
        console.warn(
          `[charges] ${row.publicId} is ${next} with the fee uncollected ` +
            `(${decision.fee.reason}): expected ${expected}, saw ${observed} (${transfer.txHash})`
        );
      }

      await logAuditEvent({
        action: 'charge.settled',
        txHash: transfer.txHash,
        metadata: {
          chargeId: row.publicId,
          status: next,
          amount: row.amount,
          received: transfer.amount,
          asset: row.asset,
          recipient: row.recipient,
          deltaUnits: decision.deltaUnits.toString(),
          toleranceUnits: decision.toleranceUnits.toString(),
          // The fee leg as its own audit fact, with the arithmetic that decided it,
          // so a ledger question can be answered after the fact without a fresh
          // chain read.
          feeCollected: decision.fee.collected,
          feeUncollectedReason: decision.fee.reason,
          feeExpectedUnits: decision.fee.expectedUnits?.toString() ?? null,
          feeObservedUnits: decision.fee.observedUnits?.toString() ?? null,
        },
      });
    }
  }

  return results;
}

/**
 * Expire the pending charges whose deadline has passed.
 *
 * Runs on the indexer tick beside the stuck-transaction sweep, for the same reason
 * that sweep lives there: a charge nobody reads would otherwise sit `pending`
 * forever and its `charge.expired` webhook would never fire. Reading a charge also
 * expires it on the spot (`charge-store.ts`), so the API is right without an indexer;
 * this is what makes the WEBHOOK right without a reader.
 */
export async function sweepExpiredCharges(input: {
  limit?: number;
  now?: Date;
} = {}): Promise<{ checked: number; expired: ChargeStatus[] }> {
  const now = input.now ?? new Date();
  const due = await findDueExpiries(input.limit ?? 50, now);

  const expired: ChargeStatus[] = [];

  for (const row of due) {
    const applied = await applyChargeTransition({ row, to: 'expired', now });
    if (!applied) continue;

    expired.push('expired');

    await logAuditEvent({
      action: 'charge.expired',
      metadata: {
        chargeId: row.publicId,
        expiresAt: row.expiresAtRaw,
        recipient: row.recipient,
        amount: row.amount,
      },
    });
  }

  return { checked: due.length, expired };
}
