import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createTransaction } from '../services/transactions.js';

const paySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  asset: z.string().default('ousd'),
  counterparty: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function transactionRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const { userId, limit = '20', offset = '0' } = request.query as {
      userId?: string;
      limit?: string;
      offset?: string;
    };

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { merchant: true },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    return { transactions };
  });

  app.post('/pay', async (request, reply) => {
    const body = paySchema.parse(request.body);
    // TODO: authenticate user from session/JWT instead of body
    const userId = (request.body as { userId?: string }).userId;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    const transaction = await createTransaction({
      ...body,
      userId,
      type: 'payment',
    });

    return reply.status(201).send({ transaction });
  });
}
