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
  | 'settings.update';

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
