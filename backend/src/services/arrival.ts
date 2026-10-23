/**
 * The other half of the charge path: money that reaches a merchant's address with
 * no charge behind it.
 *
 * Seti is non-custodial, so a payer can always send straight to the address on a
 * merchant's QR or handle page and never open our link. The money is real, the
 * merchant has been paid, and no charge was satisfied because there was nothing to
 * satisfy: the transfer carries no memo, and it may belong to no charge at all.
 * Before this module, that transfer was invisible. A merchant's order stayed open
 * on a payment that actually happened, which is a worse outcome than a missing fee.
 *
 * ## What this decides, and what it refuses to decide
 *
 * ONE question: is this transfer money that NO charge accounts for? The answer is
 * yes unless a charge at that recipient is already settled by this very
 * transaction, in which case the money is that charge's and the charge path
 * already recorded it (`services/charge-match.ts`).
 *
 * It deliberately does NOT ask "which charge was this probably for". A transfer
 * that arrives without a memo cannot be told apart from an unrelated transfer of
 * the same amount to the same merchant, so attaching it by amount would be a
 * guess dressed as a fact, and a merchant told "your charge is paid" on that guess
 * would ship goods for someone else's payment. A charge is paid only against a
 * receipt the classifier accepted (#184 owns that case, and #155 is the case where
 * no charge is involved at all).
 *
 * The consequence, stated plainly: an arrival is a FACT about money and an
 * ABSENCE of attribution. There is no `chargeId` here, not even a nullable one,
 * because a field that can hold a charge invites someone to fill it in.
 *
 * ## Why the decision is a refusal or an arrival, and nothing else
 *
 * There is no `possible-payment` state, no confidence score, and no `paid`. A
 * status enum would grow a state every surface has to render and merchants would
 * learn to read as money owed to them; a recorded arrival is simply what the chain
 * said, with the attribution left to the merchant who can ask their customer.
 *
 * The copy below is part of the contract: it is written to the MERCHANT, it says
 * what is known, and `arrival.check.ts` fails if it starts claiming a payment. The
 * API sends it, so a surface renders the product's words rather than inventing a
 * fourth sentence for the same fact.
 */
import { parseUnits } from 'viem';
import { ASSET_DECIMALS } from '../config/assets.js';
import type { ChargeStatus } from './charge.js';
import type { PaymentRefusalCode } from './payment-refusal.js';

/**
 * How many addresses one indexing window watches for arrivals.
 *
 * The same shape as the charge matcher's cap, for the same reason: the address list
 * is what keeps the log query narrow (an RPC `to` filter, never a scan of the
 * chain), and a deployment with more watched addresses than this has a different
 * problem. Past the cap the extra addresses wait for a later window instead of
 * turning one tick into an unbounded query.
 */
export const ARRIVAL_WATCH_LIMIT = 500;

/**
 * A transfer the indexer saw land on an address Seti knows belongs to a merchant.
 *
 * Deliberately not a `Transaction` and not a `ChargeTransferCandidate`: those carry
 * an intent. This carries what the chain recorded, and nothing else.
 */
export interface ObservedArrival {
  txHash: string;
  /** The `to` the chain recorded, lower-cased for comparison and storage. */
  recipient: string;
  /** The `from` the chain recorded. Kept so a merchant can ask their customer. */
  sender: string;
  /** The Seti ledger label of the token contract that emitted the log (`ousd`). */
  asset: string;
  /** Decimal token units, as a string, the shape every other amount is stored in. */
  amount: string;
  /**
   * The block the log was emitted in, so an arrival can be found on a scanner.
   *
   * Null when the log carried none: a block number is a reference a merchant may
   * follow, so an unobserved one stays empty rather than being filled in.
   */
  blockNumber: bigint | null;
  /** The receipt exists and succeeded. A log in a mined block is confirmed. */
  confirmed: boolean;
}

/**
 * What we already know about ONE charge at this recipient.
 *
 * `amount` and `status` are present because the store reads whole rows and a
 * caller should not have to project them away, NOT because this module compares
 * them. {@link classifyArrival} reads exactly one field of this type: `txHash`.
 * Passing an amount in and never looking at it is the point; the honest answer to
 * "is this probably this charge" is that we cannot know.
 */
export interface ArrivalCharge {
  id: string;
  recipient: string;
  asset: string;
  amount: string;
  status: ChargeStatus;
  /** The transfer that settled it, when one has. The one field this module reads. */
  txHash: string | null;
}

/** The arrival path's refusal codes. Part of the ONE taxonomy, like the charge's. */
export type ArrivalRefusalCode =
  /**
   * The transfer is already a charge's money: some charge at this recipient
   * records this exact transaction as the one that settled it.
   *
   * Not an error and not a gap. The charge path recorded the payment, the fee
   * verdict and the webhook; recording an arrival for the same transaction would
   * count one transfer twice and tell the merchant their money is both a charge
   * payment and an unattributed arrival.
   */
  | 'arrival-is-charge-settlement'
  /** The chain has no usable receipt for the transfer yet. */
  | 'receipt-unavailable'
  /** The amount is not a usable decimal token amount, so it is not a value to store. */
  | 'amount-invalid';

/** Compile-time proof these codes are PART of the payment taxonomy, not beside it. */
type ArrivalRefusalsArePaymentRefusals = ArrivalRefusalCode extends PaymentRefusalCode
  ? true
  : never;
const _refusalTaxonomy: ArrivalRefusalsArePaymentRefusals = true;

/** What the classifier concluded about one observed transfer. */
export type ArrivalDecision =
  | {
      kind: 'arrival';
      /**
       * Always `false`, spelled out rather than implied.
       *
       * No charge means no fee was computed, so there is nothing Seti could have
       * collected. It is in the decision so a caller cannot record an arrival and
       * a fee in the same breath.
       */
      feeCollected: false;
    }
  | {
      kind: 'refuse';
      /** The machine-readable reason. Branch on THIS, never on `reason`. */
      code: ArrivalRefusalCode;
      /** One sentence for a log. Never the contract. */
      reason: string;
    };

/** A refusal in the shape the taxonomy uses: code plus one sentence. */
function refuse(code: ArrivalRefusalCode, reason: string): ArrivalDecision {
  return { kind: 'refuse', code, reason };
}

/** Decimal token units, or null when the string is not a usable amount. */
function amountUnits(amount: string): bigint | null {
  if (typeof amount !== 'string' || amount.trim() === '') return null;
  try {
    const units = parseUnits(amount.trim(), ASSET_DECIMALS);
    return units >= 0n ? units : null;
  } catch {
    return null;
  }
}

/**
 * Decide whether an observed transfer is an arrival with no charge behind it.
 *
 * PURE: no chain read, no database, no clock, no user. The store hands in the
 * charges it already read; this function answers from them.
 *
 * The gates, in order, and why there are only three:
 *
 *  1. **Is it confirmed?** An unmined transfer has not arrived. Same code the
 *     payment and charge paths use (`receipt-unavailable`).
 *  2. **Is the amount usable?** A row whose value cannot be read is not a record
 *     of money, and storing it would put an unreadable figure in front of a
 *     merchant. (`amount-invalid`.)
 *  3. **Has a charge at this recipient already taken this transaction?** If so the
 *     money is that charge's, and the charge path owns it. (`arrival-is-charge-settlement`.)
 *
 * Anything else is an arrival. Note what is NOT a gate: the amount of any charge,
 * its status, its asset, and how close any of those are to what arrived. A charge
 * that happens to be open at this address and to owe the amount that arrived is
 * still not evidence about THIS transfer, and treating it as evidence is how a
 * merchant is told a payment they never received has been settled.
 *
 * A charge settled by a DIFFERENT transaction does not close the door either: the
 * money that arrived now is new money, and a second charge paid by someone else
 * yesterday says nothing about it.
 */
export function classifyArrival(input: {
  transfer: ObservedArrival;
  /**
   * Every charge at this transfer's recipient that the caller read, in any status.
   *
   * Read for one purpose: to find a charge whose `txHash` IS this transfer. The
   * rest of each row is deliberately ignored.
   */
  chargesAtRecipient: readonly ArrivalCharge[];
}): ArrivalDecision {
  const { transfer, chargesAtRecipient } = input;

  // 1. The chain has to have it.
  if (!transfer.confirmed) {
    return refuse(
      'receipt-unavailable',
      `Transfer ${transfer.txHash} is not confirmed yet, so it has not arrived.`
    );
  }

  // 2. An amount we cannot read is not a value to record.
  if (amountUnits(transfer.amount) === null) {
    return refuse(
      'amount-invalid',
      `Transfer ${transfer.txHash} carries "${transfer.amount}", which is not an amount.`
    );
  }

  // 3. A charge that this very transaction settled already owns this money.
  const settledBy = chargesAtRecipient.find(
    (charge) => typeof charge.txHash === 'string' && charge.txHash === transfer.txHash
  );

  if (settledBy) {
    return refuse(
      'arrival-is-charge-settlement',
      `Transfer ${transfer.txHash} settled charge ${settledBy.id}, so the charge path records it.`
    );
  }

  return { kind: 'arrival', feeCollected: false };
}

/** One arrival as a merchant-facing surface renders it: the chain's facts, nothing added. */
export interface ArrivalCopy {
  /** A chip or badge: one or two words. */
  label: string;
  /** The headline. */
  headline: string;
  /** One sentence saying what is known, and what is not. */
  detail: string;
}

/**
 * What an arrival SAYS, in one place, for every surface.
 *
 * The rules the wording follows, and `arrival.check.ts` enforces them:
 *
 * - It never says a charge was paid, settled, verified or confirmed. We did not
 *   check a charge against this transfer, so none of those words is available.
 * - It says what is known: money arrived at your address, and Seti recorded no fee
 *   on it, because a fee only exists on a charge.
 * - It says what is NOT known: what the transfer was for. Only the sender can say,
 *   and the merchant is the one who can ask them.
 */
export const ARRIVAL_COPY: ArrivalCopy = {
  label: 'No charge',
  headline: 'Money arrived with no Seti charge behind it',
  detail:
    'A transfer reached your address that no Seti charge accounts for, so Seti recorded no fee on it. What the transfer was for is not something Seti can see.',
};

/**
 * Words a merchant-facing arrival must never carry.
 *
 * A payment claim is the one thing this surface cannot make, and the cheapest way
 * to keep it that way is to refuse the vocabulary outright rather than to review
 * the sentence once. Every string in {@link ARRIVAL_COPY} is checked against this
 * list, so a future edit that describes an arrival as money owed fails the check
 * instead of shipping.
 */
export const ARRIVAL_FORBIDDEN_CLAIMS: readonly string[] = [
  'paid',
  'settled',
  'verified',
  'confirmed',
  'receipt',
  'invoice',
];
