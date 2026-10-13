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
  /** A payment that was refused before any row was written. See payment-refusal.ts. */
  | 'payment.rejected'
  | 'offramp.initiate'
  | 'offramp.complete'
  | 'settings.update'
  /**
   * A claim that matched a held brand was parked, then approved. The binding is
   * the claimant's own signature; approval only makes it live. See held-brands.ts.
   */
  | 'handle.brand.approved'
  /**
   * A parked claim was refused: the string was FREED (the row deleted) and the
   * reason recorded here, which is the only record once the row is gone.
   */
  | 'handle.brand.refused'
  /**
   * A parked claim was not decided within PARK_EXPIRY_DAYS, so it released
   * itself: the string freed and the reason recorded here.
   */
  | 'handle.brand.expired'
  /**
   * A brand proved a name was its own and took it over. The evidence and the
   * reason the previous holder was released ride in `metadata`, and the released
   * claim is preserved in `handle_releases`.
   */
  | 'handle.brand.reassigned';

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
