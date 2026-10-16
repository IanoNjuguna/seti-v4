import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { getWalletsByUser, registerWallet } from '../services/wallet-registry.js';
import { describeEvmAddress } from '../lib/address.js';
import { PRIMARY_ASSET } from '../services/chain.js';

const registerSchema = z.object({
  chain: z.string().default('tempo'),
  asset: z.string().default(PRIMARY_ASSET),
  address: z.string(),
  keyId: z.string().optional(),
});

export async function walletRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/users/:id/wallets', async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);

    if (request.user && request.user.id !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const wallets = await getWalletsByUser(id, request.user?.network);
    return { wallets };
  });

  app.post('/users/:id/wallets', async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);

    if (request.user && request.user.id !== id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const body = registerSchema.parse(request.body);

    // Named reason, not a bare "Invalid EVM address": a mis-checksummed address
    // is one character from usable, and the caller cannot tell that from a typo.
    const problem = describeEvmAddress(body.address);
    if (problem) {
      return reply.status(400).send({ error: problem });
    }

    const wallet = await registerWallet({
      userId: id,
      chain: body.chain,
      asset: body.asset,
      address: body.address,
      keyId: body.keyId,
      // The SESSION's network — a wallet is registered FOR the network the
      // account is acting on, and the practice and live addresses are separate.
      network: request.user?.network,
    });

    return reply.status(201).send({ wallet });
  });
}
