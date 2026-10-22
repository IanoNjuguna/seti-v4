import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'wallet.reveal'
  | 'wallet.freeze'
  | 'transaction.broadcast'
  | 'transaction.confirm'
  | 'transaction.fail'
  | 'payment.recorded'
  /** A send to a person that was recorded after both legs verified on-chain. */
  | 'send.recorded'
  /**
   * A practice send that settled on-chain BEFORE its row existed was written into
   * the ledger after the fact by `cli/backfill-sends.ts`.
   *
   * Deliberately distinct from `send.recorded`: a reconciliation must be able to
   * tell a reconstructed row from one recorded as it happened, because a backfill
   * prices in the currency at the rate in force WHEN IT RUNS, not at signing time.
   * `metadata.backfill` is always `true` and `metadata.reason` states why the row
   * was missing.
   */
  | 'send.backfilled'
  /**
   * A convert that was recorded after BOTH legs verified on-chain: the input
   * reached the DEX and the output reached the signing wallet, at or above the
   * floor the customer signed.
   */
  | 'convert.recorded'
  /**
   * A savings deposit that verified on all three legs: the OUSD left, the pathUSD
   * reached the vault, and the vault minted shares to the signing wallet.
   */
  | 'savings.deposit.recorded'
  /** A savings withdrawal that verified on all three legs and paid OUSD back. */
  | 'savings.withdrawal.recorded'
  /** A payment that was refused before any row was written. See payment-refusal.ts. */
  | 'payment.rejected'
  | 'offramp.initiate'
  | 'offramp.complete'
  | 'settings.update'
  /**
   * A claim that matched a held brand was parked, then approved — the held-brand
   * list was removed (#139), so nothing writes this any more. Kept in the union so
   * the rows written before that removal still parse and still say what happened.
   */
  | 'handle.brand.approved'
  /**
   * A name was TAKEN DOWN: the row deleted so the string is free again, with the
   * reason recorded here — the only record once the row is gone. Works on any
   * handle row, whatever state it is in (`refuseHandleClaim`).
   */
  | 'handle.brand.refused'
  /**
   * A parked claim was not decided within 30 days, so it released itself — the
   * held-brand list was removed (#139), so nothing writes this any more. Kept in
   * the union for the rows written before that removal.
   */
  | 'handle.brand.expired'
  /**
   * The terms version in force was recorded against a NEWLY CREATED account.
   *
   * Written once, at creation, by `services/signup.ts` — so the row's `createdAt`
   * is when the account came into being, and `metadata.termsVersion` is the
   * version the customer was shown when they accepted. An account that already
   * existed gets no second row: re-recording on every sign-in would turn a
   * one-time consent record into a login log and make "when did this account
   * first accept these Terms?" unanswerable.
   *
   * `metadata.acceptedVersion` is the version the CLIENT claimed, kept only as
   * the cross-check's evidence; the record that matters is `termsVersion`, which
   * is always the server's own.
   */
  | 'user.consent-recorded'
  /**
   * A brand proved a name was its own and took it over. The evidence and the
   * reason the previous holder was released ride in `metadata`, and the released
   * claim is preserved in `handle_releases`.
   */
  | 'handle.brand.reassigned'
  /**
   * On a switch to live, a name the account already holds while practising was
   * written on the live network as a `reserved` hold, giving the account FIRST
   * REFUSAL on it so a practice name is not stealable in the gap.
   */
  | 'handle.first-refusal'
  /**
   * The charge path (`services/charge-store.ts`, `charge-match.ts`).
   *
   * A charge has no user: it is created by a wallet signature and settled by a
   * transfer. `charge.settled` carries the transfer that decided it (so `txHash` is
   * the column support searches), and the other three say what happened to the
   * charge itself — created, lapsed, or cancelled by its recipient.
   */
  | 'charge.created'
  | 'charge.settled'
  | 'charge.expired'
  | 'charge.cancelled'
  /** One webhook delivery decided: the delivery log, mirrored into the audit trail. */
  | 'charge.webhook.delivered';

export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  ip?: string;
  /**
   * On-chain transaction hash this event concerns, when there is one.
   *
   * Promoted out of `metadata` into its own column so that "everything that
   * happened to this payment" is one indexed lookup by the hash the customer
   * pastes, rather than an unindexed JSON scan across every event.
   */
  txHash?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      ip: input.ip ?? null,
      txHash: input.txHash ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
