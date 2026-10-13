import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { walletRoutes } from './routes/wallets.js';
import { handleRoutes } from './routes/handles.js';
import { accountRoutes } from './routes/account.js';
import { publicHandleRoutes } from './routes/public-handles.js';
import { transactionRoutes } from './routes/transactions.js';
import { receiptRoutes } from './routes/receipts.js';

/**
 * Response code for a request the client shaped wrongly.
 *
 * Distinct from `INTERNAL_ERROR` on purpose: a body that fails its route schema
 * is the CLIENT's fault and must be a 4xx, while a fault inside a handler is
 * the server's and must stay a 500. Sharing one code was what let a malformed
 * claim body be reported as a server error.
 */
export const INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY';

/** Fastify's own codes for a body it could not parse before any handler ran. */
const CONTENT_TYPE_PARSER_ERROR_PREFIX = 'FST_ERR_CTP_';

/**
 * The one error handler for the API.
 *
 * The envelope (`{ error, code }`) is the contract every route already speaks,
 * so a client error that never reached a handler still arrives in the same
 * shape. The split is deliberate and narrow:
 *
 *   - A `ZodError` is a route schema refusing client input (the claim body,
 *     a query string, a path param). It has no `statusCode`, so before this
 *     branch existed it fell through to the 500 default and a merely
 *     badly-shaped request was reported as a server fault. It is a 400.
 *   - A content-type-parser error (`FST_ERR_CTP_*`) means the body was not even
 *     parseable — same story, the client's fault, a typed 400 (Fastify already
 *     assigns 400 to a bad JSON body; a wrong media type keeps its 415 but
 *     carries the same typed code so the envelope is consistent).
 *   - Everything else keeps the original behaviour: Fastify's `statusCode` if
 *     it set one, otherwise 500 `INTERNAL_ERROR`. A genuine throw in a handler
 *     has no `statusCode` and MUST stay a 500 — this is not a widened catch.
 *
 * Exported so `server.check.ts` can drive the real handler against a route that
 * throws, proving that branch still 500s.
 */
export function apiErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof ZodError) {
    request.log.warn({ err: error }, 'request rejected: body failed its route schema');
    return reply.status(400).send({
      error: 'Request body is malformed.',
      code: INVALID_REQUEST_BODY,
    });
  }

  if (
    typeof error.code === 'string' &&
    error.code.startsWith(CONTENT_TYPE_PARSER_ERROR_PREFIX)
  ) {
    request.log.warn({ err: error }, 'request rejected: body could not be parsed');
    return reply.status(error.statusCode ?? 400).send({
      error: 'Request body could not be parsed.',
      code: INVALID_REQUEST_BODY,
    });
  }

  const status = error.statusCode ?? 500;
  if (status >= 500) {
    request.log.error(error);
  } else {
    request.log.warn(error);
  }
  return reply.status(status).send({
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
  });
}

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

  app.setErrorHandler(apiErrorHandler);

  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(userRoutes, { prefix: '/users' });
  // Registers `/users/:id/wallets` exactly as declared in routes/wallets.ts.
  // A `/wallets` prefix here produced the doubled path
  // `/wallets/users/:id/wallets`, which no client ever called and which read as
  // a typo in every log line.
  await app.register(walletRoutes);
  await app.register(handleRoutes, { prefix: '/handles' });
  // The account read the onboarding gate is built on: which handles the caller
  // holds (so "onboarded" is DERIVED from data) and which mode they are in. Its
  // own registration because it is about the ACCOUNT, not about the namespace
  // `handleRoutes` owns.
  await app.register(accountRoutes, { prefix: '/account' });
  // The public half of the same feature: the `seti.live/m/<handle>` and
  // `seti.live/u/<handle>` pages read this signed out, which is why it is its own
  // registration with no auth hook rather than a route inside `handleRoutes`.
  await app.register(publicHandleRoutes, { prefix: '/public/handles' });
  // The shared receipt read: no auth hook, gated only by the signed capability
  // token in the query. Registered without a session for the same reason as the
  // public merchant read above — a link the owner hands to a merchant must open
  // for someone who has no Seti account.
  await app.register(receiptRoutes, { prefix: '/receipts' });
  await app.register(transactionRoutes, { prefix: '/transactions' });

  return app;
}
