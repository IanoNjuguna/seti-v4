import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  confirmTransactionByHash,
  createTransaction,
  recordConvert,
  recordPayment,
  recordSend,
} from '../services/transactions.js';
import { buildStatement, renderStatement } from '../services/statement.js';
import {
  parseStatementRange,
  isStatementFormat,
  statementFileName,
  STATEMENT_CONTENT_TYPE,
} from '../services/statement-model.js';
import { PaymentRefusalError } from '../services/payment-refusal.js';
import { previewPayment, previewSend, SendRequiresBatchError } from '../services/payments.js';
import { previewConvert, ConvertRefusalError } from '../services/convert.js';
import { toRecentTransaction } from '../services/transaction-view.js';
import { buildReceipt } from '../services/receipt.js';
import { mintReceiptLink } from '../services/receipt-link.js';
import { SUPPORTED_ASSETS } from '../services/chain.js';

/**
 * The asset a client may NAME to spend, if it wants to choose.
 *
 * OPTIONAL on purpose: omitting it is the normal path, and lets the server pick
 * an asset the customer can actually pay from (see `quoteTransfer`). The
 * preview's own `asset` field carries the answer back, and that is what the
 * client signs and records.
 */
const assetRequestSchema = z.string().optional();

/**
 * The asset a RECORD carries. Required, and constrained to the supported set:
 * it is the label reconciled against the receipt, so an unknown string must be a
 * 400 at the boundary rather than an unchecked cast deeper in.
 */
const assetSchema = z.enum(SUPPORTED_ASSETS);

const previewSchema = z.object({
  // KES, not stablecoin units — see PaymentPreviewInput in services/payments.ts.
  amountFiat: z.string().regex(/^\d+(\.\d+)?$/),
  asset: assetRequestSchema,
  merchantId: z.string().min(1),
});

const paySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  asset: assetSchema,
  merchantId: z.string().min(1),
  txHash: z.string().regex(/^0x[a-fA-F0-9]+$/),
  /**
   * The wallet the client signed this payment with — see
   * `RecordPaymentInput.walletAddress`.
   *
   * Optional at the SCHEMA level for the same reason as `quoteId`: a missing
   * declaration must reach the service and be refused with the typed
   * `signer-not-declared` code, which is a client-actionable state, rather than a
   * generic zod 400. The SHAPE is checked here; whether the address is the
   * caller's, and whether the chain agrees it sent this transaction, is the
   * service's job.
   */
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  /**
   * The signed rate quote from `/preview`. Optional at the SCHEMA level so a
   * missing token reaches the service and is refused with the typed
   * `quote-missing` code, rather than a generic zod 400: the refusal is a
   * client-actionable state, and the error envelope already carries codes.
   */
  quoteId: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const sendPreviewSchema = z.object({
  // KES, not stablecoin units — same unit the pay screen takes, see previewSend.
  amountFiat: z.string().regex(/^\d+(\.\d+)?$/),
  asset: assetRequestSchema,
  // Shape only. The checksum is the backend's call (`describeEvmAddress`), and
  // the recipient the client signs must be the one this endpoint returns.
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

/**
 * A convert's preview: two assets named, and the amount in the customer's
 * currency, like every other amount in this product.
 *
 * Both sides are required. A send may omit `asset` and let the server pick one
 * the customer can afford, but a convert IS the pair: a server-chosen side would
 * be picking what the customer ends up holding.
 */
const convertPreviewSchema = z.object({
  assetIn: assetSchema,
  assetOut: assetSchema,
  amountFiat: z.string().regex(/^\d+(\.\d+)?$/),
});

/**
 * A convert's RECORD: what the client signed, and the receipt that proves it.
 *
 * `amountIn` and `minAmountOut` are carried back from the preview so the record
 * path can check the chain against the figures the customer actually agreed to —
 * the input it spent, and the floor it accepted. Neither is trusted: both are
 * compared with the receipt.
 */
const convertSchema = z.object({
  assetIn: assetSchema,
  assetOut: assetSchema,
  amountIn: z.string().regex(/^\d+(\.\d+)?$/),
  minAmountOut: z.string().regex(/^\d+(\.\d+)?$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]+$/),
  /** The wallet the client signed with. See `sendSchema.walletAddress`. */
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  /** The signed rate quote from `/convert/preview`. */
  quoteId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const sendSchema = z.object({
  /** The principal the recipient received, in asset units. */
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  asset: assetSchema,
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]+$/),
  /** The wallet the client signed this send with. See `paySchema.walletAddress`. */
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  /** The signed rate quote from `/send/preview`. See `paySchema.quoteId`. */
  quoteId: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createSchema = z.object({
  userId: z.string().cuid(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  asset: assetSchema,
  counterparty: z.string().min(1),
  type: z.enum(['p2p_send', 'p2p_receive', 'top_up', 'withdrawal', 'fee']),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).default('20'),
  offset: z.string().regex(/^\d+$/).default('0'),
});

const paramsSchema = z.object({
  id: z.string().cuid(),
});

function requireUser(request: FastifyRequest) {
  const user = request.user;
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * The refusal response, in one place for payments and sends.
 *
 * 422 rather than 500: the request was understood and the chain refused to
 * support it, which the app can render as a specific state instead of
 * "something went wrong". The refusal itself is already in audit_logs (keyed by
 * txHash), so this body only has to be actionable for the client.
 */
function refusalResponse(reply: FastifyReply, error: PaymentRefusalError) {
  return reply.status(422).send({
    error: error.message,
    code: error.code,
    txHash: error.txHash,
  });
}

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', async (request) => {
    const user = requireUser(request);
    const { limit, offset } = listQuerySchema.parse(request.query);

    const take = Number(limit);

    // One row beyond the page: enough to answer "is there more?" without a second
    // query and without lying to the client about it.
    //
    // Scoped by the SESSION's network: Activity is one network's ledger. A
    // practice top-up must never appear beside a live payment, and the network
    // comes from the session — never from the request.
    const rows = await prisma.transaction.findMany({
      where: { userId: user.id, network: user.network },
      include: { merchant: true, wallet: true },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      skip: Number(offset),
    });

    const page = rows.slice(0, take);

    /**
     * The SAME row shape the dashboard returns, from the same mapper.
     *
     * The Activity screen and the home card are two views of one ledger; shipping
     * raw rows here would have pushed the naming ("Sent to 0x…", "Deposit") into
     * the browser, where it can drift from the card that already had it.
     */
    return {
      transactions: page.map((row) => toRecentTransaction(row)),
      hasMore: rows.length > take,
    };
  });

  /**
   * The account's own statement, as a file: CSV, XLSX or PDF.
   *
   * The three formats are one document (`services/statement.ts`), serialised three
   * ways, so what a customer opens in a spreadsheet and what they print say the
   * same things in the same columns.
   *
   * ROUTE ORDER — `statement` is a LITERAL and is therefore declared BEFORE every
   * `/:id…` route below. A literal registered after a parametric sibling is a
   * literal the router can hand to the parameter instead, at which point
   * `GET /transactions/statement` is read as `GET /transactions/:id` with the id
   * "statement" — a statement that 404s as an unknown transaction. The check suite
   * asserts this ordering against the built server's own route table rather than
   * trusting the eyeball.
   *
   * AUTH: `authMiddleware` on the whole file, and the statement is the CALLER'S
   * own ledger on the CALLER'S own network — there is no id in the path, so there
   * is no way to ask for somebody else's statement. The response is `private,
   * no-store`: it is a person's entire financial history, and a shared cache that
   * kept a copy would hand it to the next reader of that cache.
   */
  app.get('/statement', async (request, reply) => {
    const user = requireUser(request);
    const query = request.query as { format?: unknown; from?: unknown; to?: unknown };

    // The format is refused by NAME rather than by a schema: it names the three
    // shapes the endpoint serves, which is an answer a client can act on.
    const format = query.format;
    if (!isStatementFormat(format)) {
      return reply.status(400).send({
        error: 'format must be one of csv, xlsx, pdf.',
        code: 'invalid-statement-format',
      });
    }

    const range = parseStatementRange(query.from, query.to);
    if (!range.ok) {
      return reply.status(400).send({ error: range.reason, code: range.code });
    }

    const statement = await buildStatement({
      userId: user.id,
      network: user.network,
      from: range.from,
      to: range.to,
    });

    return reply
      .header('content-type', STATEMENT_CONTENT_TYPE[format])
      .header(
        'content-disposition',
        `attachment; filename="${statementFileName(format, statement.from, statement.to)}"`
      )
      .header('cache-control', 'private, no-store')
      .send(renderStatement(statement, format));
  });

  app.post('/preview', async (request, reply) => {
    const user = requireUser(request);
    const body = previewSchema.parse(request.body);

    const preview = await previewPayment({
      ...body,
      userId: user.id,
      network: user.network,
      type: 'payment',
    });

    return reply.send({ preview });
  });

  app.post('/pay', async (request, reply) => {
    const user = requireUser(request);
    const body = paySchema.parse(request.body);

    let transaction: Awaited<ReturnType<typeof recordPayment>>;
    try {
      transaction = await recordPayment({
        ...body,
        userId: user.id,
        network: user.network,
      });
    } catch (error) {
      if (error instanceof PaymentRefusalError) {
        return refusalResponse(reply, error);
      }
      throw error;
    }

    try {
      await confirmTransactionByHash(body.txHash, user.id, user.network);
    } catch (error) {
      console.error('[transactions/pay] confirmation failed', error);
    }

    return reply.status(201).send({ transaction });
  });

  app.post('/convert/preview', async (request, reply) => {
    const user = requireUser(request);
    const body = convertPreviewSchema.parse(request.body);

    try {
      // `user.network` rather than the served network: a quote is minted for the
      // network the ACCOUNT acts on, and a practice quote must never price a live
      // convert.
      const preview = await previewConvert({ ...body, userId: user.id, network: user.network });
      return reply.send({ preview });
    } catch (error) {
      // Nothing is signed and nothing is written on a preview, so a refusal here
      // is an answer, not an incident: the code is what the app switches on.
      if (error instanceof ConvertRefusalError) {
        return reply.status(422).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  app.post('/convert', async (request, reply) => {
    const user = requireUser(request);
    const body = convertSchema.parse(request.body);

    let transaction: Awaited<ReturnType<typeof recordConvert>>;
    try {
      transaction = await recordConvert({
        ...body,
        userId: user.id,
        network: user.network,
      });
    } catch (error) {
      // The record path's refusals are 422 with a code, exactly like a payment's:
      // nothing was written, and the code is what the app switches on.
      if (error instanceof PaymentRefusalError) {
        return refusalResponse(reply, error);
      }
      throw error;
    }

    try {
      await confirmTransactionByHash(body.txHash, user.id, user.network);
    } catch (error) {
      console.error('[transactions/convert] confirmation failed', error);
    }

    return reply.status(201).send({ transaction });
  });

  app.post('/send/preview', async (request, reply) => {
    const user = requireUser(request);
    const body = sendPreviewSchema.parse(request.body);

    try {
      const preview = await previewSend({ ...body, userId: user.id, network: user.network });
      return reply.send({ preview });
    } catch (error) {
      // No txHash exists yet, so there is nothing to key an audit refusal to —
      // this is a configuration answer, and the code is what the app switches on.
      if (error instanceof SendRequiresBatchError) {
        return reply.status(422).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  app.post('/send', async (request, reply) => {
    const user = requireUser(request);
    const body = sendSchema.parse(request.body);

    let transaction: Awaited<ReturnType<typeof recordSend>>;
    try {
      transaction = await recordSend({
        ...body,
        userId: user.id,
        network: user.network,
      });
    } catch (error) {
      if (error instanceof PaymentRefusalError) {
        return refusalResponse(reply, error);
      }
      throw error;
    }

    try {
      await confirmTransactionByHash(body.txHash, user.id, user.network);
    } catch (error) {
      console.error('[transactions/send] confirmation failed', error);
    }

    return reply.status(201).send({ transaction });
  });

  app.get('/:id/status', async (request, reply) => {
    const user = requireUser(request);
    const { id } = paramsSchema.parse(request.params);

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id, network: user.network },
    });

    if (!transaction) {
      return reply.status(404).send({ error: 'Transaction not found' });
    }

    return reply.send({
      id: transaction.id,
      status: transaction.status,
      txHash: transaction.txHash,
      settledAt: transaction.settledAt,
      failedAt: transaction.failedAt,
    });
  });

  app.get('/:id/receipt', async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };

    // Read from the chain, not from memory. A row that is not the caller's, or that
    // has nothing on chain, gets a 404 rather than someone else's transfer.
    const receipt = await buildReceipt(id, user.id);

    if (!receipt) {
      return reply.code(404).send({ error: 'No receipt for that transaction.' });
    }

    return receipt;
  });

  /**
   * Mint the shareable link for one of the caller's own receipts.
   *
   * The owner's second door, opened deliberately: this is where the capability
   * token is created, and it is created only for a row the caller owns (same
   * precondition as the receipt above). The body carries the PATH, not an
   * absolute URL: the browser knows its own origin, so the link is composed there
   * and works through a tunnel or a preview host without the server guessing it.
   */
  app.post('/:id/receipt-link', async (request, reply) => {
    const user = requireUser(request);
    const { id } = request.params as { id: string };

    const link = await mintReceiptLink(id, user.id);

    if (!link) {
      return reply.code(404).send({ error: 'No receipt for that transaction.' });
    }

    return reply.send({ path: link.path, expiresAt: link.expiresAt.toISOString() });
  });

  app.post('/', async (request, reply) => {
    const user = requireUser(request);
    const body = createSchema.parse(request.body);

    if (body.userId !== user.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const transaction = await createTransaction({ ...body, network: user.network });

    return reply.status(201).send({ transaction });
  });
}
