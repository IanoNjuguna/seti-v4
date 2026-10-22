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
import { hexToString, type Hex } from 'viem';
import type { Network } from '../lib/network.js';
import { logAuditEvent } from './audit.js';
import {
  classifyCharge,
  nextChargeStatus,
  type ChargeStatus,
  type ObservedTransfer,
} from './charge.js';
import {
  applyChargeTransition,
  findDueExpiries,
  findPendingCharges,
  toSignedCharge,
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
}

/**
 * The text of a TIP-20 32-byte memo.
 *
 * `bytes32` is right-padded with zeroes, so the decoded string carries NULs after the
 * id. Those are stripped here rather than at the comparison, because the classifier
 * asserts `memo.includes(id)` on a TEXT memo — that is the frozen contract, and
 * teaching it about padding would change what a stored signature means.
 *
 * An unreadable memo yields `''`, which can never carry an id: the fail-closed
 * direction, since an unreadable memo is not evidence of a match.
 */
export function memoFromBytes32(memo: string | null | undefined): string {
  if (typeof memo !== 'string' || memo.length < 2) return '';
  try {
    return stripTrailingNul(hexToString(memo as Hex, { size: 32 }));
  } catch {
    return '';
  }
}

/** Drop the zero padding a `bytes32` memo carries after its text, without a regex. */
function stripTrailingNul(text: string): string {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 0) end -= 1;
  return text.slice(0, end);
}

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
}): Promise<ChargeMatchResult[]> {
  if (input.transfers.length === 0) return [];

  const now = input.now ?? new Date();

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

      const decision = await classifyCharge({
        charge: toSignedCharge(row),
        transfer,
        chainId: input.chainId,
        now,
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
        now,
      });

      // `null` means another actor got there first — a replayed transfer, a second
      // replica, a cancel. Nothing moved, so nothing is reported and nothing is
      // webhooked; the winner already did both.
      if (!applied) continue;

      results.push({ chargeId: row.publicId, txHash: transfer.txHash, status: next });

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
