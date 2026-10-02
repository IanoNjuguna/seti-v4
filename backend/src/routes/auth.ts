import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // Placeholder auth routes. Replace with Privy/Passkey session flow.

  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const user = await prisma.user.create({ data: body });
    return reply.status(201).send({ user });
  });

  app.post('/login', async (_request, reply) => {
    return reply.status(501).send({ error: 'Use Privy embedded wallet login' });
  });
}
