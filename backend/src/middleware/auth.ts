import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { verifyPrivyToken } from '../services/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
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

async function attachDevTestUser(request: FastifyRequest) {
  const user = await prisma.user.upsert({
    where: { email: DEV_TEST_EMAIL },
    update: {},
    create: { email: DEV_TEST_EMAIL },
  });

  request.user = { id: user.id, email: user.email };
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
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
    const verified = await verifyPrivyToken(token);
    if (!verified.email) {
      return reply.status(401).send({ error: 'Account must have an email' });
    }

    // Resolve local user. In a real system we might cache this in a session.
    const user = await prisma.user.findUnique({
      where: { email: verified.email },
    });

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    request.user = { id: user.id, email: user.email };
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
