import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { getHomeDashboard } from '../services/wallet.js';

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

}
