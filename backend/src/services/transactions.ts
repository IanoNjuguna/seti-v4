import { prisma } from '../lib/prisma.js';
import type { TransactionType } from '../types/index.js';

interface CreateTransactionInput {
  userId: string;
  amount: string;
  asset: string;
  counterparty: string;
  type: TransactionType;
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function createTransaction(input: CreateTransactionInput) {
  const wallet = await prisma.wallet.findFirst({
    where: { userId: input.userId, asset: input.asset },
  });

  if (!wallet) {
    throw new Error(`No ${input.asset} wallet found for user`);
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      walletId: wallet.id,
      type: input.type,
      status: 'pending',
      amount: input.amount,
      asset: input.asset,
      counterparty: input.counterparty,
      description: input.description,
      metadata: (input.metadata ?? {}) as never,
    },
  });

  // TODO: queue on-chain transaction + Bridge/Stripe off-ramp here.
  // For the scaffold, leave status as pending.

  return transaction;
}
