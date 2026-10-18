/**
 * Handle claims, against live Postgres and REAL EIP-712 signatures.
 *
 * Run with:  npm run check:claim
 * Requires:  docker compose up -d  (the `seti-postgres` container)
 *
 * Why this is driven by real signatures: the entire feature is "a handle is only
 * attached to an address by that address's key". Mocking the crypto would test
 * the mock. Every claim and every forgery below is signed with a throwaway key
 * generated here, and each refusal is a refusal of a signature that genuinely
 * does not verify.
 *
 * The HTTP half registers only the handle routes, not the whole server, so this
 * suite does not depend on unrelated services being in a working state.
 *
 * IMPORTANT: every row this file touches belongs to a fixture user
 * (`check-claim-*@seti.test`), a fixture handle/merchant (`Check Claim …`), or
 * the one placeholder wallet it registers for the dev bypass user. Real handles
 * and real merchants are snapshotted before and checked after — a handle points
 * at where a customer's money lands.
 */
import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { servedNetwork } from './chain.js';
import { findHandleByMerchantId } from './handles.js';
import { registerWallet } from './wallet-registry.js';
import {
  HandleClaimError,
  HANDLE_CLAIM_PRIMARY_TYPE,
  HANDLE_CLAIM_TYPES,
  PURPOSE_FOR_KIND,
  claimHandle,
  describeMerchantName,
  handleClaimDomain,
  handleClaimVerifies,
  merchantHandle,
  toHandleIdentityView,
  type HandleKind,
} from './handle-claims.js';
import type { HandleClaimMessage } from './handle-claims.js';
import { handleRoutes } from '../routes/handles.js';

const FIXTURE_EMAIL_A = 'check-claim-a@seti.test';
const FIXTURE_EMAIL_B = 'check-claim-b@seti.test';
const DEV_EMAIL = 'dev@seti.test';

const NAME_MAIN = 'Check Claim Cafe';
const NAME_ROUTE = 'Check Claim Route';
const NAME_UNVERIFIED = 'Check Claim Unverified';
const NAME_TAMPERED = 'Check Claim Tampered';
/**
 * The name this suite expects to be REFUSED.
 *
 * It used to borrow the seeded `javahouse` row, which exists on a developer's
 * machine and never in CI, so the refusal had nothing to refuse there. What is
 * being pinned is that an UNSIGNED, backfilled row still holds its string, so
 * the suite creates that row itself, with no signature, and cleanup removes it
 * with the other fixtures.
 */
const NAME_HELD = 'Check Claim Held';

/** Every handle the fixture names derive, so cleanup can be scoped by string. */
const FIXTURE_NAME_PREFIX = 'Check Claim';
const HANDLE_WHERE = {
  OR: [
    { handle: { startsWith: 'checkclaim', mode: 'insensitive' as const } },
    { name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const } },
  ],
};
/** The business profiles those claims mint. */
const MERCHANT_WHERE = {
  name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const },
};

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = String(actual) === String(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(58)} ${String(actual)}${ok ? '' : ` (expected ${String(expected)})`}`
  );
}

function nonce(): string {
  return randomBytes(16).toString('hex');
}

async function signClaim(
  account: PrivateKeyAccount,
  message: HandleClaimMessage
): Promise<`0x${string}`> {
  return account.signTypedData({
    domain: handleClaimDomain(),
    types: HANDLE_CLAIM_TYPES,
    primaryType: HANDLE_CLAIM_PRIMARY_TYPE,
    message: { ...message },
  });
}

/** Run a claim and report the typed refusal it produced, if any. */
async function refusalOf(
  fn: () => Promise<unknown>
): Promise<{ code: string; message: string } | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof HandleClaimError) {
      return { code: error.code, message: error.message };
    }
    throw error;
  }
}

/** Sign exactly the message that is submitted, then claim it as `userId`. */
async function attemptClaim(
  userId: string,
  account: PrivateKeyAccount,
  kind: HandleKind,
  name: string,
  address: string
) {
  const message: HandleClaimMessage = {
    name,
    address,
    purpose: PURPOSE_FOR_KIND[kind],
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const signature = await signClaim(account, message);
  return refusalOf(() => claimHandle({ userId, kind, ...message, signature }));
}

async function cleanup() {
  await prisma.handle.deleteMany({ where: HANDLE_WHERE });
  await prisma.merchant.deleteMany({ where: MERCHANT_WHERE });

  const users = await prisma.user.findMany({
    where: { email: { in: [FIXTURE_EMAIL_A, FIXTURE_EMAIL_B] } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  if (ids.length > 0) {
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  const owner = privateKeyToAccount(generatePrivateKey());
  const forger = privateKeyToAccount(generatePrivateKey());
  const routeAccount = privateKeyToAccount(generatePrivateKey());

  const realHandlesBefore = await prisma.handle.count({ where: { NOT: HANDLE_WHERE } });

  await cleanup();
  await prisma.wallet.deleteMany({ where: { address: routeAccount.address } });

  const userA = await prisma.user.create({ data: { email: FIXTURE_EMAIL_A } });
  const userB = await prisma.user.create({ data: { email: FIXTURE_EMAIL_B } });

  await registerWallet({ userId: userA.id, chain: 'tempo', asset: 'ousd', address: owner.address });
  await registerWallet({ userId: userB.id, chain: 'tempo', asset: 'ousd', address: forger.address });

  // The two rows this suite asserts ABOUT rather than through a claim. Both are
  // named with the fixture prefix so `cleanup()` owns them: nothing here depends
  // on the seed, and a developer's database is not load-bearing.
  const heldOwner = privateKeyToAccount(generatePrivateKey());
  await prisma.handle.create({
    data: {
      handle: merchantHandle(NAME_HELD),
      network: servedNetwork,
      kind: 'business',
      name: NAME_HELD,
      address: heldOwner.address,
    },
  });

  // A merchant row that predates the network dimension: it lives on `testnet`,
  // which is what the platform-id resolver has to be asked for.
  const legacyMerchant = await prisma.merchant.create({
    data: { id: 'checkclaimlegacy', name: 'Check Claim Legacy' },
  });
  await prisma.handle.create({
    data: {
      handle: 'checkclaimlegacy',
      network: 'testnet',
      kind: 'business',
      name: 'Check Claim Legacy',
      address: heldOwner.address,
      merchantId: legacyMerchant.id,
    },
  });

  // A minimal server carrying only the handle routes: the HTTP assertions below
  // are about this feature's wiring, and building the whole API would make the
  // suite fail for reasons that have nothing to do with a claim.
  const app = Fastify();
  await app.register(handleRoutes, { prefix: '/handles' });
  await app.ready();

  const resolve = async (q: string) => {
    const response = await app.inject({
      method: 'GET',
      url: `/handles/resolve?q=${encodeURIComponent(q)}`,
    });
    return { status: response.statusCode, body: response.json<Record<string, unknown>>() };
  };
  const resolvedHandle = (body: Record<string, unknown>) => body.handle as Record<string, unknown>;

  // -------------------------------------------------------------------------
  // The name rule — the same rule for a username and a business name
  // -------------------------------------------------------------------------
  console.log('the name rule:');
  check('a plain name is accepted', describeMerchantName('Java House'), 'null');
  check("punctuation inside a name is accepted", describeMerchantName("Mama's Kitchen & Bar"), 'null');
  check('an empty name is refused', describeMerchantName('') !== null, true);
  check('whitespace alone is refused', describeMerchantName('   ') !== null, true);
  check('punctuation alone is refused', describeMerchantName('!!!') !== null, true);
  check('an over-long name is refused', describeMerchantName('a'.repeat(65)) !== null, true);
  check('a control character is refused', describeMerchantName('Java\u0000House') !== null, true);
  check('a padded name is trimmed, not refused', describeMerchantName('  Java House  '), 'null');

  // -------------------------------------------------------------------------
  // (a) A valid claim is stored, signature and all, and re-verifies
  // -------------------------------------------------------------------------
  console.log('\n(a) a valid claim:');
  const mainIssuedAt = new Date().toISOString();
  const mainMessage: HandleClaimMessage = {
    name: NAME_MAIN,
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: mainIssuedAt,
    nonce: nonce(),
  };
  const mainSignature = await signClaim(owner, mainMessage);

  const claimed = await claimHandle({
    userId: userA.id,
    kind: 'business',
    ...mainMessage,
    signature: mainSignature,
  });

  check('the name is stored', claimed.name, NAME_MAIN);
  check('the handle is stored', claimed.handle, merchantHandle(NAME_MAIN));
  check('the kind is stored', claimed.kind, 'business');
  check('the purpose is stored', claimed.purpose, 'merchant-name');
  check('the address is stored (checksummed)', claimed.address, owner.address);
  check('the SIGNATURE is stored verbatim', claimed.claimSignature, mainSignature);
  check('the issued-at is stored verbatim', claimed.claimIssuedAt, mainIssuedAt);
  check('the nonce is stored', claimed.claimNonce, mainMessage.nonce);
  check('and it re-verifies from the stored signature', await handleClaimVerifies(claimed), true);

  // -------------------------------------------------------------------------
  // (b) A signature produced by a DIFFERENT key is refused
  // -------------------------------------------------------------------------
  console.log('\n(b) a signature from another key:');
  const wrongKey = await attemptClaim(userA.id, forger, 'business', 'Check Claim Forged', owner.address);
  check('a signature by another key is refused', wrongKey?.code, 'signature-mismatch');
  check('and the refusal names the real signer', wrongKey?.message.includes(forger.address), true);

  // -------------------------------------------------------------------------
  // (b2) A signature made for one PURPOSE cannot claim the other
  // -------------------------------------------------------------------------
  console.log('\n(b2) a signature made for the other purpose:');
  const asUsername: HandleClaimMessage = {
    name: 'Check Claim Cross Purpose',
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.person,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const usernameSignature = await signClaim(owner, asUsername);

  const replayedAsBusiness = await refusalOf(() =>
    claimHandle({
      userId: userA.id,
      kind: 'business',
      name: asUsername.name,
      address: asUsername.address,
      issuedAt: asUsername.issuedAt,
      nonce: asUsername.nonce,
      signature: usernameSignature,
    })
  );
  check('a username signature is refused as a business claim', replayedAsBusiness?.code, 'purpose-mismatch');

  const asBusiness: HandleClaimMessage = {
    name: 'Check Claim Cross Purpose 2',
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const businessSignature = await signClaim(owner, asBusiness);

  const replayedAsUsername = await refusalOf(() =>
    claimHandle({
      userId: userA.id,
      kind: 'person',
      name: asBusiness.name,
      address: asBusiness.address,
      issuedAt: asBusiness.issuedAt,
      nonce: asBusiness.nonce,
      signature: businessSignature,
    })
  );
  check('a merchant-name signature is refused as a username claim', replayedAsUsername?.code, 'purpose-mismatch');
  check(
    'the two kinds sign different purposes',
    PURPOSE_FOR_KIND.person === PURPOSE_FOR_KIND.business,
    false
  );
  check(
    'and the two kinds are not interchangeable as strings',
    PURPOSE_FOR_KIND.person,
    'username'
  );

  // -------------------------------------------------------------------------
  // (c) A message tampered with AFTER signing is refused
  // -------------------------------------------------------------------------
  console.log('\n(c) a tampered message:');
  const originalMessage: HandleClaimMessage = {
    name: 'Check Claim Original',
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const originalSignature = await signClaim(owner, originalMessage);

  const tamper = (override: Partial<HandleClaimMessage>) =>
    refusalOf(() =>
      claimHandle({
        userId: userA.id,
        kind: override.purpose === PURPOSE_FOR_KIND.person ? 'person' : 'business',
        name: originalMessage.name,
        address: originalMessage.address,
        issuedAt: originalMessage.issuedAt,
        nonce: originalMessage.nonce,
        ...override,
        signature: originalSignature,
      })
    );

  check('changing the NAME after signing is refused', (await tamper({ name: 'Check Claim Swapped' }))?.code, 'signature-mismatch');
  check('changing the ADDRESS after signing is refused', (await tamper({ address: forger.address }))?.code, 'signature-mismatch');
  check('changing the NONCE after signing is refused', (await tamper({ nonce: nonce() }))?.code, 'signature-mismatch');
  check('changing the PURPOSE after signing is refused', (await tamper({ purpose: PURPOSE_FOR_KIND.person }))?.code, 'purpose-mismatch');

  // -------------------------------------------------------------------------
  // (d) An address the caller does not own is refused
  // -------------------------------------------------------------------------
  console.log('\n(d) an address the caller does not own:');
  const notOwned = await attemptClaim(userB.id, owner, 'business', 'Check Claim Not Mine', owner.address);
  check('a genuine signature from a wallet you do not own is refused', notOwned?.code, 'address-not-owned');

  const crossAccount = await attemptClaim(userA.id, forger, 'business', 'Check Claim Not Mine 2', forger.address);
  check('signing for a foreign address is refused as not owned', crossAccount?.code, 'address-not-owned');

  // -------------------------------------------------------------------------
  // (e) A handle already claimed by another address is refused
  // -------------------------------------------------------------------------
  console.log('\n(e) a handle already claimed:');
  const rival = await attemptClaim(userB.id, forger, 'business', NAME_MAIN, forger.address);
  check('a handle claimed by another address is refused', rival?.code, 'handle-taken');
  check('and the refusal names the current holder', rival?.message.includes(owner.address), true);

  const stillHeld = await prisma.handle.findFirstOrThrow({
    where: { handle: merchantHandle(NAME_MAIN) },
  });
  check('the original holder is not overwritten', stillHeld.address, owner.address);

  const held = await attemptClaim(userA.id, owner, 'business', NAME_HELD, owner.address);
  check('an unsigned backfilled handle still reserves its name', held?.code, 'handle-taken');

  const heldAfter = await prisma.handle.findFirstOrThrow({
    where: { handle: merchantHandle(NAME_HELD) },
  });
  check('and the refused row is left exactly as it was', heldAfter.address, heldOwner.address);
  check('and still carries no signature', heldAfter.claimSignature, 'null');

  const badName = await refusalOf(() =>
    claimHandle({
      userId: userA.id,
      kind: 'business',
      name: '!!!',
      address: owner.address,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
      signature: mainSignature,
    })
  );
  check('a malformed name is refused with its own code', badName?.code, 'invalid-handle-name');

  // A reserved word never reaches the signature check: it is refused on the rule.
  const reserved = await refusalOf(() =>
    claimHandle({
      userId: userA.id,
      kind: 'person',
      name: 'Pay',
      address: owner.address,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
      signature: '0x00',
    })
  );
  check('a reserved word is refused', reserved?.code, 'reserved-handle');

  // -------------------------------------------------------------------------
  // The signed name must be the normalised one
  // -------------------------------------------------------------------------
  console.log('\nspacing in a signed name:');
  const spacedMessage: HandleClaimMessage = {
    name: 'Check Claim  Spaced',
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const spacedSignature = await signClaim(owner, spacedMessage);
  const unnormalised = await refusalOf(() =>
    claimHandle({ userId: userA.id, kind: 'business', ...spacedMessage, signature: spacedSignature })
  );
  check('a name signed with doubled spaces is refused', unnormalised?.code, 'signature-mismatch');

  const canonicalMessage: HandleClaimMessage = { ...spacedMessage, name: 'Check Claim Spaced' };
  const normalisedClaim = await claimHandle({
    userId: userA.id,
    kind: 'business',
    ...canonicalMessage,
    signature: await signClaim(owner, canonicalMessage),
  });
  check('the normalised form is accepted', normalisedClaim.name, 'Check Claim Spaced');
  check('and verifies', await handleClaimVerifies(normalisedClaim), true);

  // -------------------------------------------------------------------------
  // (g, part 1) A handle with no signature is never verified
  // -------------------------------------------------------------------------
  console.log('\n(g) an unverified binding is never verified:');
  const unverified = await prisma.handle.create({
    data: {
      handle: merchantHandle(NAME_UNVERIFIED),
      kind: 'business',
      name: NAME_UNVERIFIED,
      address: owner.address,
      // On the network this suite's claims land on — the network this deployment
      // SERVES, which is what the claim path defaults to. A row left on the column
      // default would sit in the other network's namespace, and the resolver below
      // (which is network-scoped, as it must be for a business name) would 404 on a
      // fixture that is meant to be found.
      network: servedNetwork,
    },
  });
  const unverifiedView = await toHandleIdentityView(unverified);
  check('a handle with no claim is unverified', unverifiedView.verified, false);
  check('and still reports its address', unverifiedView.address, owner.address);

  // -------------------------------------------------------------------------
  // (g, part 2) A TAMPERED binding stops verifying
  // -------------------------------------------------------------------------
  const tamperedMessage: HandleClaimMessage = {
    name: NAME_TAMPERED,
    address: owner.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const tamperedClaim = await claimHandle({
    userId: userA.id,
    kind: 'business',
    ...tamperedMessage,
    signature: await signClaim(owner, tamperedMessage),
  });
  check('the tamper fixture starts out verified', await handleClaimVerifies(tamperedClaim), true);

  const renamed = await prisma.handle.update({
    where: { id: tamperedClaim.id },
    data: { name: 'Check Claim Hijacked' },
  });
  check('renaming a claimed row drops verification', await handleClaimVerifies(renamed), false);

  const hijacked = await resolve('Check Claim Hijacked');
  check('a renamed row resolves by its new name', hijacked.status, 200);
  check('but is NOT verified', resolvedHandle(hijacked.body).verified, false);

  const redirected = await prisma.handle.update({
    where: { id: tamperedClaim.id },
    data: { name: NAME_TAMPERED, address: forger.address },
  });
  check('repointing a claimed row drops verification', await handleClaimVerifies(redirected), false);

  const repointed = await resolve(NAME_TAMPERED);
  const repointedHandle = resolvedHandle(repointed.body);
  check('a repointed row resolves', repointed.status, 200);
  check('and is NOT verified', repointedHandle.verified, false);
  check('and shows the address it was repointed to', repointedHandle.address, forger.address);

  // -------------------------------------------------------------------------
  // (f) Resolving returns the verified name with its address
  // -------------------------------------------------------------------------
  console.log('\n(f) resolving:');
  const resolved = await resolve(NAME_MAIN);
  const resolvedMain = resolvedHandle(resolved.body);
  check('resolve by claimed name returns 200', resolved.status, 200);
  check('and returns the claimed name', resolvedMain.name, NAME_MAIN);
  check('and returns the address beside it', resolvedMain.address, owner.address);
  check('and reports the binding as verified', resolvedMain.verified, true);

  // A handle that predates the network dimension lives on `testnet` alone, and
  // business handles are per network — so the network-scoped resolver must be
  // asked for the network the row is on, not for the one this deployment serves.
  // Asserted through the same resolver the route uses. The row is a fixture: the
  // seeded equivalent this used to read only exists on a developer's machine.
  const legacyRow = await findHandleByMerchantId('checkclaimlegacy', 'testnet');
  const legacyView = legacyRow ? await toHandleIdentityView(legacyRow) : null;
  check('a merchant by platform id resolves on its own network', legacyView !== null, true);
  check('but is NOT reported as verified', legacyView?.verified, false);

  const unverifiedResolved = await resolve(NAME_UNVERIFIED);
  check('an unsigned name is returned, unverified', resolvedHandle(unverifiedResolved.body).verified, false);

  const byDeepLink = await resolve('seti://merchant?name=Check+Claim+Cafe');
  check('a name deep link resolves too', byDeepLink.status, 200);
  check('to the same handle', resolvedHandle(byDeepLink.body).verified, true);

  const unknown = await resolve('!!! not a handle !!!');
  check('an unparseable payload is refused', unknown.status, 400);

  // The POST route, end to end through the auth middleware. The dev auth bypass
  // is on for this suite (see the npm script), which makes the caller
  // `dev@seti.test`; the throwaway address is registered for THAT user under
  // `pathusd`, a token slot no other flow uses, so its `ousd` wallet is untouched.
  const devUser = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: {},
    create: { email: DEV_EMAIL },
  });
  await registerWallet({
    userId: devUser.id,
    chain: 'tempo',
    asset: 'pathusd',
    address: routeAccount.address,
  });

  const routeMessage: HandleClaimMessage = {
    name: NAME_ROUTE,
    address: routeAccount.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };

  const posted = await app.inject({
    method: 'POST',
    url: '/handles/claim',
    payload: { kind: 'business', ...routeMessage, signature: await signClaim(routeAccount, routeMessage) },
  });
  const postedHandle = posted.json<Record<string, unknown>>().handle as Record<string, unknown>;
  check('POST /handles/claim returns 201', posted.statusCode, 201);
  check('and the claimed name', postedHandle.name, NAME_ROUTE);
  check('and the address it was claimed for', postedHandle.address, routeAccount.address);
  check('and verified: true', postedHandle.verified, true);

  const forgedRouteMessage: HandleClaimMessage = {
    name: 'Check Claim Route Forged',
    address: routeAccount.address,
    purpose: PURPOSE_FOR_KIND.business,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const refused = await app.inject({
    method: 'POST',
    url: '/handles/claim',
    payload: { kind: 'business', ...forgedRouteMessage, signature: await signClaim(owner, forgedRouteMessage) },
  });
  check('a forged claim over HTTP is refused', refused.statusCode, 400);
  check('with the typed code in the envelope', refused.json<Record<string, unknown>>().code, 'signature-mismatch');

  await app.close();

  // -------------------------------------------------------------------------
  // Cleanup and the "the money path was left alone" proof
  // -------------------------------------------------------------------------
  await cleanup();
  await prisma.wallet.deleteMany({ where: { address: routeAccount.address } });

  check(
    'the refused fixture row was removed with the fixtures',
    await prisma.handle.count({ where: { handle: merchantHandle(NAME_HELD) } }),
    0
  );

  const realAfter = await prisma.handle.count({ where: { NOT: HANDLE_WHERE } });
  check('real handles were not touched', realAfter, realHandlesBefore);
  check('and no fixture handle was left behind', await prisma.handle.count({ where: HANDLE_WHERE }), 0);
  check('and no fixture business profile was left behind', await prisma.merchant.count({ where: MERCHANT_WHERE }), 0);

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('handle claims check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
