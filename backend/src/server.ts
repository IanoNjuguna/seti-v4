import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { walletRoutes } from './routes/wallets.js';
import { merchantRoutes } from './routes/merchants.js';
import { publicMerchantRoutes } from './routes/public-merchants.js';
import { transactionRoutes } from './routes/transactions.js';
import { receiptRoutes } from './routes/receipts.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    },
  });

  // Cross-origin policy.
  //
  // Development reflects any origin, so localhost:3000/3001/3100 and a tunnel
  // URL all work with no configuration. Everywhere else the allow-list is
  // explicit, because a tunnelled or deployed front end has an origin the
  // server cannot guess — and the old `origin: false` denied it silently: the
  // browser reports a generic failure and the request never reaches a handler,
  // which reads like the API is down rather than misconfigured.
  //
  // An unset/empty list preserves the previous production behaviour: no
  // cross-origin access at all. Same-origin deployments need no entry here.
  const corsAllowedOrigins = (env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : corsAllowedOrigins,
    credentials: true,
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      error: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
    });
  });

  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(userRoutes, { prefix: '/users' });
  // Registers `/users/:id/wallets` exactly as declared in routes/wallets.ts.
  // A `/wallets` prefix here produced the doubled path
  // `/wallets/users/:id/wallets`, which no client ever called and which read as
  // a typo in every log line.
  await app.register(walletRoutes);
  await app.register(merchantRoutes, { prefix: '/merchants' });
  // The public half of the same feature: the `seti.live/m/<handle>` page reads
  // this signed out, which is why it is its own registration with no auth hook
  // rather than a route inside `merchantRoutes`.
  await app.register(publicMerchantRoutes, { prefix: '/public/merchants' });
  // The shared receipt read: no auth hook, gated only by the signed capability
  // token in the query. Registered without a session for the same reason as the
  // public merchant read above — a link the owner hands to a merchant must open
  // for someone who has no Seti account.
  await app.register(receiptRoutes, { prefix: '/receipts' });
  await app.register(transactionRoutes, { prefix: '/transactions' });

  return app;
}
