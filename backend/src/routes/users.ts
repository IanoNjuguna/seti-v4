import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getHomeDashboard } from '../services/wallet.js';

const paramsSchema = z.object({
  id: z.string().cuid(),
});

export async function userRoutes(app: FastifyInstance) {
  app.get('/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);

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

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const dashboard = await getHomeDashboard(id);
    return dashboard;
  });
}
