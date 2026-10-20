import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { getHomeDashboard } from '../services/wallet.js';
import { getAnalytics } from '../services/analytics.js';
import { resolveUserFiat } from '../services/payments.js';
import { normalizeNetwork } from '../lib/network.js';

const paramsSchema = z.object({
  id: z.string().cuid(),
});

function assertOwnsResource(request: FastifyRequest, reply: FastifyReply, id: string): boolean {
  const user = request.user;
  if (!user || user.id !== id) {
    reply.status(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);

    if (request.user && request.user.id !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { wallets: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { user };
  });

  app.get('/:id/home', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);

    if (!assertOwnsResource(request, reply, id)) return;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const dashboard = await getHomeDashboard(id, request.user?.network);
    return dashboard;
  });

  /**
   * What the money did over the last week and the last month.
   *
   * Answers in the customer's own currency, converted once at the current rate from
   * amounts that are 1:1 USD — the same rule the balance follows, so a summary and the
   * card can never quote two different figures for the same money.
   *
   * Scoped to the account's network: a practice payment is not part of a live summary.
   */
  app.get('/:id/analytics', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);

    if (!assertOwnsResource(request, reply, id)) return;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const currency = await resolveUserFiat(id);
    return getAnalytics(id, currency, normalizeNetwork(user.network));
  });
}
