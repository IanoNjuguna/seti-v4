import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { verifyPrivyToken, isPrivyConfigured, PrivyTokenVerificationError } from '../services/auth.js';
import type { VerifiedUser } from '../services/auth.js';
import { registerWallet, resolveWalletAddress } from '../services/wallet-registry.js';
import { bindSessionIdentity } from '../services/session-identity.js';
import { createAccount } from '../services/signup.js';
import { logAuditEvent } from '../services/audit.js';
import { PRIMARY_ASSET, servedNetwork } from '../services/chain.js';

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
  /**
   * The terms version the client displayed and had accepted at sign-up.
   *
   * Optional, and EVIDENCE rather than the record: what is written to the audit
   * row is this server's own version (`services/consent.ts`). It is checked, and
   * a client that accepted a different version is refused rather than recorded —
   * see `createAccount` in `services/signup.ts`, which runs the check before
   * anything is written. Optional because a client that sends nothing is not
   * claiming to have accepted a different version, and demanding the field would
   * make an older client unable to sign in at all.
   */
  acceptedTermsVersion: z.string().min(1).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  /**
   * Verify a Privy-issued auth token and create or update the local user.
   * The mobile app obtains the token from Privy first, then sends it here.
   *
   * A token this server cannot verify is REFUSED: `401 { code: 'unauthorized'
   * }`, the code the app already knows how to act on. It is never reported as a
   * server fault — see the mapping below, and `PrivyTokenVerificationError` in
   * `services/auth.ts` for why the two are different events.
   */
  app.post('/verify', async (request, reply) => {
    if (!isPrivyConfigured()) {
      return reply.status(503).send({ error: 'Authentication provider is not configured' });
    }

    const parsed = verifySchema.parse(request.body);

    // A token this server cannot verify is the CALLER's failure and is answered
    // as one: `401 unauthorized`, the code the web app already knows, which
    // clears the stored session and asks the person to sign in again.
    //
    // Left uncaught, the throw fell through to the shared error handler as an
    // untyped fault, and the API answered `500 INTERNAL_ERROR` — "Seti had a
    // problem on our side, and nothing was changed" — for every sign-in,
    // including one whose token was merely malformed. That sentence was a
    // statement about Seti that was not true, it told the person nothing they
    // could act on, and it hid the only useful fact (the token was refused)
    // behind a sentence that reads like a retryable outage.
    //
    // ONLY the verification failure is mapped here. `verifyPrivyToken` can also
    // throw afterwards — a token that DID verify, followed by a broken profile
    // read — and that is genuinely ours: it still throws, and it is still the
    // 500 it is. Mapping it too would blame the caller for a fault of ours,
    // which is the same mistake in the other direction.
    let verified: VerifiedUser;
    try {
      verified = await verifyPrivyToken(parsed.token);
    } catch (error) {
      if (!(error instanceof PrivyTokenVerificationError)) throw error;

      request.log.warn(
        {
          code: error.code,
          sdkMessage: error.sdkMessage,
          cause: error.cause,
        },
        'sign-in refused: the Privy token did not verify'
      );

      return reply
        .status(error.statusCode)
        .send({ error: error.message, code: error.code });
    }

    const email = verified.email;
    if (!email) {
      return reply.status(400).send({ error: 'Privy account must have an email' });
    }

    // Resolve the account by the identity the session is ESTABLISHED with — the
    // Privy subject — BEFORE the email. A returning account whose Privy email has
    // changed is still the same account, and its ledger must not move; the email
    // is only the entry key for an identity Seti has not seen before. See
    // `services/session-identity.ts`.
    let user = await prisma.user.findUnique({
      where: { privyDid: verified.privyDid },
    });

    if (user) {
      // A returning account is stamped with the network this deployment SERVES, on
      // every sign-in. That field decides which rows the app reads and writes, and
      // it was previously set only by the Practice ⇄ Live switch or the dev bypass —
      // so an account created while this box served practice would keep reading
      // practice rows on a live deployment and look empty. Re-derived, not
      // remembered, for the same reason the bypass does it per request.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { phone: verified.phone ?? user.phone, network: servedNetwork },
      });
    } else {
      // Creating the account is where the consent record is written, and it can
      // happen exactly once per account — see `services/signup.ts` for why an
      // `upsert` could not answer "did this create anything?".
      const account = await createAccount({
        email,
        phone: verified.phone,
        acceptedVersion: parsed.acceptedTermsVersion,
        ip: request.ip,
      });

      if (!account.ok) {
        request.log.warn(
          { privyDid: verified.privyDid, code: account.code },
          `sign-up refused: ${account.code}`
        );
        return reply.status(409).send({ error: account.reason, code: account.code });
      }

      user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });

      // Bind the account to the subject this session is established with, so
      // every later request resolves by it — never by the email Privy reports
      // then. A subject already held by another account is refused, not moved.
      const bound = await bindSessionIdentity(user.id, verified.privyDid);
      if (!bound.ok) {
        return reply.status(409).send({ error: bound.reason });
      }
    }

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
    // lookups. One Tempo address holds every supported asset, and the unique index on
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

    // The dev account acts on the network this process SERVES, for the same
    // reason `attachDevTestUser` writes it: it is a fixture of this box, not a
    // person with a preference, and a row left on the column default would serve
    // every dev-bypass request under a network this deployment does not serve.
    const user = await prisma.user.upsert({
      where: { email: 'dev@seti.test' },
      update: { network: servedNetwork },
      create: { email: 'dev@seti.test', network: servedNetwork },
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
