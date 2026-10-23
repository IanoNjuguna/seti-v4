import Fastify, {
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { walletRoutes } from './routes/wallets.js';
import { handleRoutes } from './routes/handles.js';
import { accountRoutes } from './routes/account.js';
import { savingsRoutes } from './routes/savings.js';
import { publicHandleRoutes } from './routes/public-handles.js';
import { publicPayeeRoutes } from './routes/public-payees.js';
import { transactionRoutes } from './routes/transactions.js';
import { receiptRoutes } from './routes/receipts.js';
import { publicChargeRoutes } from './routes/public-charges.js';
import { arrivalRoutes } from './routes/arrivals.js';
import { referralRoutes } from './routes/referrals.js';
import { networkScopeHook } from './middleware/network-scope.js';

/**
 * Response code for a request the client shaped wrongly.
 *
 * Distinct from `INTERNAL_ERROR` on purpose: a body that fails its route schema
 * is the CLIENT's fault and must be a 4xx, while a fault inside a handler is
 * the server's and must stay a 500. Sharing one code was what let a malformed
 * claim body be reported as a server error.
 */
export const INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY';

/**
 * The stable code and the only sentence a client ever sees for a server fault.
 *
 * A driver error (Prisma, a Postgres connection, an RPC provider) carries the
 * database's own vocabulary in `error.message` and a code like `P2022` — the
 * text the owner saw in the sign-in UI:
 *
 *   Invalid `prisma.user.findUnique()` invocation in backend/src/routes/auth.ts:48
 *   … The column `users.network` does not exist in the current database.
 *
 * That is a fact about Seti's deployment, never about the person using the app,
 * and it is also an information leak (schema, file paths, sometimes a
 * credentialed URL). Every 5xx is therefore answered with this ONE sentence and
 * this ONE code; the real error is logged server-side against `request.id`, and
 * the id is returned so the sentence a user reports resolves to that log line.
 */
export const INTERNAL_ERROR = 'INTERNAL_ERROR';
export const INTERNAL_ERROR_MESSAGE =
  'Something went wrong on our side. Please try again in a moment.';
/** Response header carrying the request id on every response. */
export const REQUEST_ID_HEADER = 'x-request-id';

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
 *   - Everything else keeps the original code selection: Fastify's `statusCode`
 *     if it set one, otherwise 500. But a **5xx** — a genuine throw in a handler,
 *     which has no `statusCode` and MUST stay a 500 — is answered with the stable
 *     `INTERNAL_ERROR` code and one plain sentence, never the message or code the
 *     error carried. Those can be a driver's (Prisma's `P2xxx`, a Postgres
 *     "column does not exist", an RPC provider's URL); the detail is logged
 *     server-side against `request.id` instead. A 4xx a handler set itself
 *     (`statusCode` + `code`) still passes through untouched, so this narrows
 *     nothing that was deliberate.
 *
 * Exported so the check suites can drive the real handler against a route that
 * throws, proving both that a fault still 500s and that the body it returns
 * carries no driver vocabulary.
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
    // An internal (or driver) fault. Log the WHOLE thing against the request id
    // so support can find it; hand the client the stable code and the plain
    // sentence — never `error.message` (the schema, the file path, the SQL) and
    // never `error.code` (Prisma's `P2xxx`). The id travels back in the body so
    // the sentence a user reports maps straight onto this log line.
    request.log.error(
      { err: error, requestId: request.id },
      'request failed with an internal error'
    );
    return reply
      .status(status)
      .header(REQUEST_ID_HEADER, request.id)
      .send({
        error: INTERNAL_ERROR_MESSAGE,
        code: INTERNAL_ERROR,
        requestId: request.id,
      });
  }

  // A handler's own typed 4xx (or a Fastify one). This is unchanged behaviour:
  // the envelope and its authored message pass through exactly as before, so
  // every documented refusal keeps its code and its copy.
  request.log.warn(error);
  return reply.status(status).send({
    error: error.message || 'Internal server error',
    code: error.code || INTERNAL_ERROR,
  });
}

export interface BuildServerOptions {
  /**
   * Override the log destination.
   *
   * Production and dev take the default (JSON to stdout at the level the
   * environment picks). The fault check passes a stream so it can read the lines
   * the server actually writes — the whole point being that the driver detail it
   * withholds from the client IS present, with the request id, in the log.
   */
  logger?: FastifyServerOptions['logger'];
}

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    },
    // Every request gets its own id. Fastify's default is a per-process counter
    // (`req-1`, `req-2`, …), which collides across restarts and two replicas —
    // so a uid a user reads off a failure notice would not find its log line. A
    // UUID is unique across both. The id rides in every log line (pino binds it
    // as `reqId`) and back on the response as `x-request-id`.
    genReqId: () => randomUUID(),
  });

  // Surface the request id on every response, success or failure, so a client
  // (or a support ticket) can quote it and land on the one log line.
  app.addHook('onSend', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
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

  // The session's network is the SERVER's to decide. This hook runs before any
  // route's own hooks (it is registered first) and refuses any request that tries
  // to declare a chain id or a network — the same rule that stops a client
  // supplying a payment amount. See `middleware/network-scope.ts`.
  app.addHook('preHandler', networkScopeHook);

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
  await app.register(savingsRoutes, { prefix: '/savings' });
  // The public half of the same feature: the `seti.live/m/<handle>` and
  // `seti.live/u/<handle>` pages read this signed out, which is why it is its own
  // registration with no auth hook rather than a route inside `handleRoutes`.
  await app.register(publicHandleRoutes, { prefix: '/public/handles' });
  // The pay page's by-address read (#197): whether the address a charge names is a
  // merchant a person reviewed, and when. Public for the same reason a charge is (the
  // payer has no account), in its own file with no auth hook for the same reason as the
  // two public registrations above. Read-only and display-only: its worst failure is
  // showing the unverified tier, which is what every page showed before it existed.
  await app.register(publicPayeeRoutes, { prefix: '/public/payees' });
  // The shared receipt read: no auth hook, gated only by the signed capability
  // token in the query. Registered without a session for the same reason as the
  // public merchant read above — a link the owner hands to a merchant must open
  // for someone who has no Seti account.
  await app.register(receiptRoutes, { prefix: '/receipts' });
  await app.register(transactionRoutes, { prefix: '/transactions' });
  // Money that arrived at the caller's own addresses with no charge behind it. Behind
  // the session, unlike the charge API above: an arrival belongs to the account whose
  // address received it, and the addresses are resolved from the session rather than
  // from the query.
  await app.register(arrivalRoutes, { prefix: '/arrivals' });
  // The charge API: create, read, cancel and read the delivery log. Registered with
  // no auth hook because a charge has no account — the recipient's SIGNATURE is the
  // credential, and a file with no session hook cannot leak one by accident (the same
  // rule `public-handles.ts` follows).
  await app.register(publicChargeRoutes, { prefix: '/public/charges' });

  // Invites. One public route (the code a `seti.live/i/<handle>` link hands out,
  // which a signed-out visitor must be able to get) and one behind the session
  // (who joined). The mix is why this is its own registration rather than a
  // route inside a plugin whose hook is decided once.
  await app.register(referralRoutes, { prefix: '/referrals' });

  return app;
}
