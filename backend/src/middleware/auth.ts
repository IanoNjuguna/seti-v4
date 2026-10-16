import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { verifyPrivySubject } from '../services/auth.js';
import { resolveSessionIdentity } from '../services/session-identity.js';
import { normalizeNetwork, type Network } from '../lib/network.js';
import { servedNetwork } from '../config/networks.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      /**
       * The NETWORK this request is served under — resolved by the SERVER from
       * the account's stored preference, never from the request. A route that
       * scopes by network reads `request.user.network`; there is no code path
       * that reads a network out of the body or the query.
       */
      network: Network;
    };
  }
}

const DEV_TEST_EMAIL = 'dev@seti.test';

/**
 * A Privy access token is a JWT; the dev bypass token is not.
 *
 * This is what lets the bypass coexist with real sign-in. Applying the bypass
 * whenever it was enabled attributed EVERY request to the dev user, so a genuine
 * Privy session could never work on a development machine: the route compared
 * its own id against the dev user's and answered 403.
 */
function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3;
}

/**
 * The dev-bypass user, attached to every request when the bypass is on.
 *
 * Its NETWORK is written explicitly on every attach, and that is deliberate. This
 * account is not a person with a preference — it is a single shared fixture of THIS
 * process, so the network it acts on must be the network this process SERVES. Left
 * to the column default it would be `testnet` on a mainnet-serving box, which is the
 * cross-scope hazard the `network` column exists to prevent: every bypass request
 * would be served under a network this deployment does not serve, and a suite that
 * drives the real routes would be reading handles, wallets and ledger rows from a
 * namespace the app it is testing never uses. (Same rule as the schema doc on an
 * omitted scope: it resolves to what the deployment SERVES, never to a stale
 * default.) It is also why the bypass cannot silently disagree with the box it runs
 * on — the value is re-derived per request rather than remembered.
 */
async function attachDevTestUser(request: FastifyRequest) {
  const user = await prisma.user.upsert({
    where: { email: DEV_TEST_EMAIL },
    update: { network: servedNetwork },
    create: { email: DEV_TEST_EMAIL, network: servedNetwork },
  });

  request.user = {
    id: user.id,
    email: user.email,
    network: normalizeNetwork(user.network, servedNetwork),
  };
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // NOTE: production cannot reach this bypass even if DEV_BYPASS_AUTH were set:
  // `config/env.ts` refuses to boot a production process with it on. This
  // `NODE_ENV === 'development'` gate is the second, independent barrier.
  const bypassAllowed =
    env.NODE_ENV === 'development' && env.DEV_BYPASS_AUTH === 'true';

  const header = request.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  // The bypass is a FALLBACK for local development without Privy, never an
  // override: a request carrying something that looks like a real token is
  // verified for real, so the two paths can be used side by side.
  const carriesRealToken = scheme === 'Bearer' && Boolean(token) && looksLikeJwt(token ?? '');

  if (bypassAllowed && !carriesRealToken) {
    await attachDevTestUser(request);
    return;
  }

  if (scheme !== 'Bearer' || !token) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  try {
    // The identity a session was ESTABLISHED with: the token's subject (the
    // Privy DID), fixed at issuance. Resolving the account from it — and never
    // from a profile Privy reports at request time — is what stops a later change
    // from re-pointing a live session. The account is bound to this subject at
    // `POST /auth/verify`; see `services/session-identity.ts`.
    const privyDid = await verifyPrivySubject(token);
    const identity = await resolveSessionIdentity(privyDid);

    if ('code' in identity) {
      return reply.status(401).send({ error: identity.reason, code: identity.code });
    }

    // The email attached here is the SNAPSHOT stored on the account at
    // establishment — not whatever Privy reports now — so the rest of the API
    // cannot disagree with the identity this session was created as.
    request.user = { id: identity.id, email: identity.email, network: identity.network };
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
