import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { verifyPrivyToken, isPrivyConfigured } from '../services/auth.js';
import { registerWallet, resolveWalletAddress } from '../services/wallet-registry.js';
import { logAuditEvent } from '../services/audit.js';
import { PRIMARY_ASSET } from '../services/chain.js';

const verifySchema = z.object({
  token: z.string().min(1),
  /**
   * The embedded wallet the CLIENT will sign with.
   *
   * Declared by the browser and then verified against Privy's own wallet list, so
   * it cannot be forged — but it has to come from the client, because only the
   * browser knows which of a user's wallets `useWallets()` picked. Leaving it out
   * is fine: the server then falls back to Privy's view. See
   * `resolveWalletAddress` for the fallback order.
   */
  walletAddress: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  /**
   * Verify a Privy-issued auth token and create or update the local user.
   * The mobile app obtains the token from Privy first, then sends it here.
   */
  app.post('/verify', async (request, reply) => {
    if (!isPrivyConfigured()) {
      return reply.status(503).send({ error: 'Authentication provider is not configured' });
    }

    const parsed = verifySchema.parse(request.body);
    const verified = await verifyPrivyToken(parsed.token);

    const email = verified.email;
    if (!email) {
      return reply.status(400).send({ error: 'Privy account must have an email' });
    }

    let user = await prisma.user.upsert({
      where: { email },
      update: {
        phone: verified.phone ?? undefined,
      },
      create: {
        email,
        phone: verified.phone,
      },
    });

    // Which wallet this account moves money from. Verified, never minted — see
    // `resolveWalletAddress`.
    const resolved = resolveWalletAddress(parsed.walletAddress, verified);

    if ('complaint' in resolved) {
      request.log.warn(
        { privyDid: verified.privyDid, declared: parsed.walletAddress },
        `wallet resolution failed: ${resolved.complaint}`
      );
      return reply.status(400).send({ error: resolved.complaint });
    }

    // `asset` labels the row's primary token — it is NOT a filter for later
    // lookups. One Tempo address holds pathUSD and OUSD, and the unique index on
    // `address` allows only one row per address, so this column cannot name every
    // asset the wallet can move. Filtering a lookup on it refuses transfers the
    // address can make (the `No active pathusd wallet found` refusal came from
    // exactly that).
    await registerWallet({
      userId: user.id,
      chain: 'tempo',
      asset: PRIMARY_ASSET,
      address: resolved.address,
    });

    user = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { wallets: true },
    });

    await logAuditEvent({
      userId: user.id,
      action: 'user.login',
      ip: request.ip,
      metadata: {
        privyDid: verified.privyDid,
        registeredWallet: resolved.address,
        declaredWallet: parsed.walletAddress ?? null,
      },
    });

    return { user };
  });

  /**
   * Who the bearer token belongs to, as the SERVER resolves it.
   *
   * A browser cannot be trusted to remember who it signed in as: the pair it
   * keeps (`seti-auth-user` + `seti-auth-token`) can be stale, edited, or lifted
   * from another account, and the app then shows one identity while calling the
   * API as another. This route exists so the client never has to trust the pair:
   * it presents the token and the server answers with the account the token
   * actually resolves to.
   *
   * It runs the SAME `authMiddleware` every other route runs, deliberately — not
   * a second token flow. That is what guarantees this endpoint cannot disagree
   * with the rest of the API about who a token is, and it is why the dev bypass
   * (`DEV_BYPASS_AUTH=true` + `NODE_ENV=development`) resolves here exactly as it
   * does on `/transactions`. A token the middleware refuses is a 401 here, which
   * is the signal the browser clears its stored session on.
   *
   * Registered with a route-level `preHandler` rather than a plugin-wide hook, so
   * `/verify`, `/dev` and the deprecated `/register` stay public.
   */
  app.get('/me', { preHandler: authMiddleware }, async (request, reply) => {
    const caller = request.user;
    if (!caller) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // The middleware answers with the identity only ({ id, email }); the full
    // record is what the client shows, and it is read fresh so nothing the token
    // does not own is ever returned.
    const user = await prisma.user.findUnique({
      where: { id: caller.id },
      include: { wallets: true },
    });

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    return { user };
  });

  /**
   * Development-only bypass login.
   * Returns a dummy token and the seeded dev user so the app can be tested
   * without configuring Privy. Only available when DEV_BYPASS_AUTH=true.
   */
  app.post('/dev', async (request, reply) => {
    const bypassAllowed =
      process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true';
    if (!bypassAllowed) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const user = await prisma.user.upsert({
      where: { email: 'dev@seti.test' },
      update: {},
      create: { email: 'dev@seti.test' },
    });

    // Ensure the dev user has an active wallet so balance/payment flows work.
    //
    // This MUST be an address no other user holds: `Wallet.address` is globally
    // unique, and this used to reuse the seeded `demo@seti.app` address, so the
    // dev login failed with a P2002 the moment the seed ran — every time, for
    // every dev login, with an error that named `wallet.create()` rather than
    // the collision. It is a placeholder, not a real key: nothing signs with it.
    const devWalletAddress = '0x' + 'de'.repeat(20);
    await registerWallet({
      userId: user.id,
      chain: 'tempo',
      asset: PRIMARY_ASSET,
      address: devWalletAddress,
    });

    const userWithWallet = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { wallets: true },
    });

    return { user: userWithWallet, token: 'dev-bypass-token' };
  });

  // Deprecated: kept for local development seeding only.
  app.post('/register', async (request, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        phone: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
      .parse(request.body);

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const user = await prisma.user.create({ data: body });
    return reply.status(201).send({ user });
  });
}
