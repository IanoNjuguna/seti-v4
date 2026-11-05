import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import {
  getSavingsSummary,
  quoteSavingsDeposit,
  quoteSavingsWithdraw,
  SavingsFundingError,
  SavingsInputError,
  SavingsNotLiveError,
} from '../services/savings.js';
import { recordSavingsDeposit, recordSavingsWithdrawal } from '../services/transactions.js';
import { walletAddressFor } from '../services/savings.js';
import { getSavingsRewards } from '../services/savings-rewards.js';
import { PaymentRefusalError } from '../services/payment-refusal.js';
import { refusalResponse } from './refusal-response.js';

const depositSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]+$/),
  /** Which asset funded it; the quote chose it from the customer's balances. */
  assetIn: z.enum(['ousd', 'pathusd', 'usdt0', 'usdc.e']).optional(),
  /** The OUSD the customer spent, in OUSD units. */
  amountIn: z.string().regex(/^\d+(\.\d+)?$/),
  /** What the vault received, in pathUSD units. */
  depositAmount: z.string().regex(/^\d+(\.\d+)?$/),
  /** The share floor that was signed. */
  minShares: z.string().regex(/^\d+(\.\d+)?$/),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  /** The frozen rate from `/savings/quote`. */
  quoteId: z.string().optional(),
});

const withdrawQuoteSchema = z.object({
  amountFiat: z.string().regex(/^\d+(\.\d+)?$/),
});

const withdrawSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]+$/),
  /** The shares redeemed, in share units. */
  shares: z.string().regex(/^\d+(\.\d+)?$/),
  /** The OUSD floor that was signed. */
  minSwapOut: z.string().regex(/^\d+(\.\d+)?$/),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  quoteId: z.string().optional(),
});

const quoteSchema = z.object({
  /** The amount the customer typed, in THEIR currency — as everywhere in this app. */
  amountFiat: z.string().regex(/^\d+(\.\d+)?$/),
});

/**
 * The savings routes' three answers, and the one that used to be a shrug.
 *
 * #137 item 8: a chain-side failure must surface a CODE and one plain sentence, never
 * the generic "Could not complete that. Nothing was moved." Everything that was not
 * typed used to fall into a 422 carrying a raw viem message, which the client could not
 * translate — so a dropped RPC read and an operator's mistake looked identical to the
 * customer, and both looked like their own fault.
 *
 *   - closed on purpose -> 503 `savings-not-live`, unchanged;
 *   - the amount they typed -> 422 with its own code, so the field can say what is wrong;
 *   - anything else, including the chain -> 502 `savings-chain-unavailable` with one
 *     sentence that says the money did not move.
 */
function savingsRefusal(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof SavingsNotLiveError) {
    return reply.status(503).send({ error: error.message, code: error.code });
  }
  if (error instanceof SavingsInputError) {
    return reply.status(422).send({ error: error.message, code: error.code });
  }
  /*
   * The customer's holdings cannot reach the vault's asset (#335). A 422 with its own
   * code, because the fix is theirs to make — hold something convertible, or try a size
   * the book can fill — and a 502 would call a liquidity fact an outage and tell them to
   * retry a request that fails identically.
   */
  if (error instanceof SavingsFundingError) {
    reply.log.warn({ unpriced: error.unpriced }, 'savings deposit has no convertible funding asset');
    return reply.status(422).send({ error: error.message, code: error.code });
  }
  reply.log.error({ err: error }, 'savings request failed');
  return reply.status(502).send({
    error: 'We could not reach the vault just now. Nothing was moved.',
    code: 'savings-chain-unavailable',
  });
}

/**
 * Savings: what the account has put aside, and what it is worth now.
 *
 * A read only. Depositing and withdrawing are the customer's own signatures against
 * the vault — Seti never holds the position, so it can never take it out from under
 * them. That is also why this route cannot say "deposit succeeded": it does not
 * deposit.
 *
 * `available: false` is a normal answer on a network with no vault, and the surface
 * must render that as "savings are not here yet" rather than as an empty balance.
 */
export async function savingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', async (request: FastifyRequest) => {
    const user = request.user;
    // `authMiddleware` rejects an unauthenticated request before this runs, so a
    // missing user here is a wiring bug, not a client error.
    if (!user) throw new Error('savings route reached without an authenticated user');

    const summary = await getSavingsSummary({ userId: user.id, network: user.network });

    return { savings: summary };
  });

  /**
   * The Merkl campaign's claimable rewards for this wallet (#322).
   *
   * A read, and a payload: `amount` is the campaign's cumulative figure, the Distributor
   * subtracts what was already paid, and `claimableAmount` is `amount - claimed` with
   * pending excluded. The customer signs the claim themselves, so this route never needs
   * an operator and never moves anything.
   *
   * `claimableAmount` is in token units because that is what the claim signs, and
   * `claimableFiat` is the same figure in the customer's currency (#331): the screen
   * prints money, not a number whose unit the reader has to supply.
   *
   * No rewards is a normal answer, not an error: `claimable: false` with a reason, so the
   * screen offers no button instead of an error.
   */
  app.get('/rewards', async (request: FastifyRequest) => {
    const user = request.user;
    if (!user) throw new Error('savings route reached without an authenticated user');

    const address = await walletAddressFor(user.id, user.network);
    const rewards = await getSavingsRewards({ userId: user.id, address, network: user.network });
    return { rewards };
  });

  /**
   * Price a deposit: the swap into the vault's asset, the approval, and the shares
   * the vault should mint. Nothing is signed here.
   */
  app.post('/quote', async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user) throw new Error('savings route reached without an authenticated user');

    const body = quoteSchema.parse(request.body);

    try {
      const quote = await quoteSavingsDeposit({
        userId: user.id,
        amountFiat: body.amountFiat,
        network: user.network,
      });
      return reply.send({ quote });
    } catch (error) {
      return savingsRefusal(reply, error);
    }
  });

  /**
   * Record a deposit the customer signed: one transaction, three calls, and every
   * leg checked against the receipt before a row exists.
   */
  app.post('/deposit', async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user) throw new Error('savings route reached without an authenticated user');

    const body = depositSchema.parse(request.body);

    try {
      const transaction = await recordSavingsDeposit({
        ...body,
        userId: user.id,
        network: user.network,
      });
      return reply.status(201).send({ transaction });
    } catch (error) {
      if (error instanceof SavingsNotLiveError) {
        return reply.status(503).send({ error: error.message, code: error.code });
      }
      if (error instanceof PaymentRefusalError) return refusalResponse(reply, error);
      return savingsRefusal(reply, error);
    }
  });

  /** Price a withdrawal: shares out, the vault's own redeem quote, and the way home. */
  app.post('/withdraw/quote', async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user) throw new Error('savings route reached without an authenticated user');

    const body = withdrawQuoteSchema.parse(request.body);

    try {
      const quote = await quoteSavingsWithdraw({
        userId: user.id,
        amountFiat: body.amountFiat,
        network: user.network,
      });
      return reply.send({ quote });
    } catch (error) {
      return savingsRefusal(reply, error);
    }
  });

  /** Record a withdrawal the customer signed, from all three legs. */
  app.post('/withdraw', async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user) throw new Error('savings route reached without an authenticated user');

    const body = withdrawSchema.parse(request.body);

    try {
      const transaction = await recordSavingsWithdrawal({
        ...body,
        userId: user.id,
        network: user.network,
      });
      return reply.status(201).send({ transaction });
    } catch (error) {
      if (error instanceof PaymentRefusalError) return refusalResponse(reply, error);
      return savingsRefusal(reply, error);
    }
  });
}