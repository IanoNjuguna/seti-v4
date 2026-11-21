import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveUserFiat } from '../services/payments.js';
import {
  getPolymarketView,
  normalizePolymarketAddress,
  PolymarketRefusalError,
} from '../services/polymarket.js';

/**
 * The Polymarket card's two routes: link a wallet, read what it holds (#599).
 *
 * A READ, and the reason it is a route rather than a client fetch to Polymarket is the
 * conversion. The rows and the headline have to be built at ONE rate so they add up, and
 * that rate is the one this process already publishes for the account's own currency.
 * A browser asking Polymarket directly would have to invent a rate, and the card would
 * then be a second opinion about what a dollar is worth.
 *
 * The address is stored per account rather than passed on every read, because it is a
 * standing fact about the customer, not a query parameter: a card that forgot it on
 * reload would ask someone to paste a 42-character string twice.
 */
const linkSchema = z.object({
  /** Straight from the customer. Validated as an address here, never trusted as one. */
  address: z.string().min(1).max(128),
});

/**
 * How a refusal reaches the card.
 *
 * 422 when the caller's own input is the problem (an address that is not one), 502 when
 * Polymarket is: a retired API version, a timeout, or a payload this build cannot read.
 * The split matters because the app renders them differently — a bad address is
 * something the customer fixes, an outage is something they wait out.
 */
function refusalStatus(code: PolymarketRefusalError['code']): number {
  return code === 'polymarket-address-invalid' ? 422 : 502;
}

export async function polymarketRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/positions', async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { polymarketAddress: true, fiatCurrency: true },
    });

    const fiatCurrency = user?.fiatCurrency ?? (await resolveUserFiat(userId));

    if (!user?.polymarketAddress) {
      return reply.send({ linked: false, fiatCurrency });
    }

    try {
      const view = await getPolymarketView({ address: user.polymarketAddress, fiatCurrency });
      return reply.send(view);
    } catch (error) {
      if (error instanceof PolymarketRefusalError) {
        request.log.warn({ code: error.code }, `polymarket read refused: ${error.message}`);
        return reply.status(refusalStatus(error.code)).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  app.put('/address', async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = linkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        error: 'Paste the address from your Polymarket profile.',
        code: 'polymarket-address-invalid',
      });
    }

    let address: string;
    try {
      address = normalizePolymarketAddress(parsed.data.address);
    } catch (error) {
      if (error instanceof PolymarketRefusalError) {
        return reply.status(refusalStatus(error.code)).send({ error: error.message, code: error.code });
      }
      throw error;
    }

    await prisma.user.update({ where: { id: userId }, data: { polymarketAddress: address } });
    return reply.send({ linked: true, address });
  });

  app.delete('/address', async (request, reply) => {
    const userId = request.user?.id;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    await prisma.user.update({ where: { id: userId }, data: { polymarketAddress: null } });
    return reply.send({ linked: false });
  });
}
