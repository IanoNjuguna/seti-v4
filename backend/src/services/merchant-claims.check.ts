/**
 * Merchant name claims, against live Postgres and REAL EIP-712 signatures.
 *
 * Run with:  npm run check:claim
 * Requires:  docker compose up -d  (the `seti-postgres` container)
 *
 * Why this is driven by real signatures: the entire feature is "a name is only
 * attached to an address by that address's key". Mocking the crypto would test
 * the mock. Every claim and every forgery below is signed with a throwaway key
 * generated here, and each refusal is a refusal of a signature that genuinely
 * does not verify.
 *
 * The HTTP half registers only the merchant routes, not the whole server, so
 * this suite does not depend on unrelated services being in a working state.
 *
 * IMPORTANT: every row this file touches belongs to a fixture user
 * (`check-claim-*@seti.test`), a fixture merchant (`Check Claim …`), or the one
 * placeholder wallet it registers for the dev bypass user. Real merchants and
 * real wallets are snapshotted before and checked after — a merchant row points
 * at where a customer's money lands.
 */
import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { registerWallet } from './wallet-registry.js';
import {
  MerchantClaimError,
  MERCHANT_CLAIM_PRIMARY_TYPE,
  MERCHANT_CLAIM_TYPES,
  claimMerchantName,
  describeMerchantName,
  merchantClaimDomain,
  merchantClaimVerifies,
  merchantNameKey,
  toMerchantIdentityView,
  type MerchantClaimMessage,
} from './merchant-claims.js';
import { merchantRoutes } from '../routes/merchants.js';

const FIXTURE_EMAIL_A = 'check-claim-a@seti.test';
const FIXTURE_EMAIL_B = 'check-claim-b@seti.test';
const DEV_EMAIL = 'dev@seti.test';

const NAME_MAIN = 'Check Claim Cafe';
const NAME_ROUTE = 'Check Claim Route';
const NAME_UNVERIFIED = 'Check Claim Unverified';
const NAME_TAMPERED = 'Check Claim Tampered';

/** Every merchant this suite creates, so cleanup can be scoped by name. */
const FIXTURE_NAMES = [NAME_MAIN, NAME_ROUTE, NAME_UNVERIFIED, NAME_TAMPERED];
const FIXTURE_KEYS = FIXTURE_NAMES.map(merchantNameKey);

/**
 * Every fixture merchant's name starts with this.
 *
 * Cleanup matches on the NAME PREFIX rather than the `nameKey` list alone: some
 * fixtures are inserted directly (to model a merchant with no claim at all) and
 * those have a NULL key, and one is renamed mid-test to model a poisoned row.
 * A key-only sweep would leave both behind on a crash.
 */
const FIXTURE_NAME_PREFIX = 'Check Claim';
const FIXTURE_WHERE = {
  OR: [
    { nameKey: { in: FIXTURE_KEYS } },
    { name: { startsWith: FIXTURE_NAME_PREFIX, mode: 'insensitive' as const } },
  ],
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
  message: MerchantClaimMessage
): Promise<`0x${string}`> {
  return account.signTypedData({
    domain: merchantClaimDomain(),
    types: MERCHANT_CLAIM_TYPES,
    primaryType: MERCHANT_CLAIM_PRIMARY_TYPE,
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
    if (error instanceof MerchantClaimError) {
      return { code: error.code, message: error.message };
    }
    throw error;
  }
}

/**
 * Sign exactly the message that is submitted, then claim it as `userId`.
 *
 * Signing and submitting the SAME message is what makes each refusal below about
 * the condition it names: a signature that does not cover the submitted fields
 * would be refused for the wrong reason and the test would pass while proving
 * nothing.
 */
async function attemptClaim(
  userId: string,
  account: PrivateKeyAccount,
  message: MerchantClaimMessage
) {
  const signature = await signClaim(account, message);
  return refusalOf(() => claimMerchantName({ userId, ...message, signature }));
}

async function cleanup() {
  await prisma.merchant.deleteMany({ where: FIXTURE_WHERE });

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

  const realMerchantsBefore = await prisma.merchant.count({
    where: { NOT: FIXTURE_WHERE },
  });

  await cleanup();
  await prisma.wallet.deleteMany({ where: { address: routeAccount.address } });

  const userA = await prisma.user.create({ data: { email: FIXTURE_EMAIL_A } });
  const userB = await prisma.user.create({ data: { email: FIXTURE_EMAIL_B } });

  await registerWallet({ userId: userA.id, chain: 'tempo', asset: 'ousd', address: owner.address });
  await registerWallet({ userId: userB.id, chain: 'tempo', asset: 'ousd', address: forger.address });

  // A minimal server carrying only the merchant routes: the HTTP assertions
  // below are about this feature's wiring, and building the whole API would make
  // the suite fail for reasons that have nothing to do with a name claim.
  const app = Fastify();
  await app.register(merchantRoutes, { prefix: '/merchants' });
  await app.ready();

  const resolve = async (qr: string) => {
    const response = await app.inject({
      method: 'GET',
      url: `/merchants/resolve?qr=${encodeURIComponent(qr)}`,
    });
    return { status: response.statusCode, body: response.json<Record<string, unknown>>() };
  };

  const resolvedMerchantBody = (body: Record<string, unknown>) =>
    body.merchant as Record<string, unknown>;

  // -------------------------------------------------------------------------
  // The name rule
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
  check(
    'case and spacing collapse to one key',
    merchantNameKey('  Java   HOUSE ') === merchantNameKey('java house'),
    true
  );

  // -------------------------------------------------------------------------
  // (a) A valid claim is stored, signature and all, and re-verifies
  // -------------------------------------------------------------------------
  console.log('\n(a) a valid claim:');
  const mainIssuedAt = new Date().toISOString();
  const mainMessage: MerchantClaimMessage = {
    name: NAME_MAIN,
    address: owner.address,
    issuedAt: mainIssuedAt,
    nonce: nonce(),
  };
  const mainSignature = await signClaim(owner, mainMessage);

  const claimed = await claimMerchantName({
    userId: userA.id,
    ...mainMessage,
    signature: mainSignature,
  });

  check('the name is stored', claimed.name, NAME_MAIN);
  check('the address is stored (checksummed)', claimed.payoutAddress, owner.address);
  check('the SIGNATURE is stored verbatim', claimed.claimSignature, mainSignature);
  check('the issued-at is stored verbatim', claimed.claimIssuedAt, mainIssuedAt);
  check('the nonce is stored', claimed.claimNonce, mainMessage.nonce);
  check('and it re-verifies from the stored signature', await merchantClaimVerifies(claimed), true);

  // -------------------------------------------------------------------------
  // (b) A signature produced by a DIFFERENT key is refused
  // -------------------------------------------------------------------------
  console.log('\n(b) a signature from another key:');
  const wrongKey = await attemptClaim(userA.id, forger, {
    name: 'Check Claim Forged',
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('a signature by another key is refused', wrongKey?.code, 'signature-mismatch');
  check('and the refusal names the real signer', wrongKey?.message.includes(forger.address), true);

  // -------------------------------------------------------------------------
  // (c) A message tampered with AFTER signing is refused
  // -------------------------------------------------------------------------
  console.log('\n(c) a tampered message:');
  const originalMessage: MerchantClaimMessage = {
    name: 'Check Claim Original',
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const originalSignature = await signClaim(owner, originalMessage);

  const tamperedName = await refusalOf(() =>
    claimMerchantName({
      userId: userA.id,
      name: 'Check Claim Swapped',
      address: originalMessage.address,
      issuedAt: originalMessage.issuedAt,
      nonce: originalMessage.nonce,
      signature: originalSignature,
    })
  );
  check('changing the NAME after signing is refused', tamperedName?.code, 'signature-mismatch');

  const tamperedAddress = await refusalOf(() =>
    claimMerchantName({
      userId: userA.id,
      name: originalMessage.name,
      address: forger.address,
      issuedAt: originalMessage.issuedAt,
      nonce: originalMessage.nonce,
      signature: originalSignature,
    })
  );
  check('changing the ADDRESS after signing is refused', tamperedAddress?.code, 'signature-mismatch');

  const tamperedNonce = await refusalOf(() =>
    claimMerchantName({
      userId: userA.id,
      name: originalMessage.name,
      address: originalMessage.address,
      issuedAt: originalMessage.issuedAt,
      nonce: nonce(),
      signature: originalSignature,
    })
  );
  check('changing the NONCE after signing is refused', tamperedNonce?.code, 'signature-mismatch');

  // -------------------------------------------------------------------------
  // (d) An address the caller does not own is refused
  // -------------------------------------------------------------------------
  console.log('\n(d) an address the caller does not own:');
  const notOwned = await attemptClaim(userB.id, owner, {
    name: 'Check Claim Not Mine',
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('a genuine signature from a wallet you do not own is refused', notOwned?.code, 'address-not-owned');

  const crossAccount = await attemptClaim(userA.id, forger, {
    name: 'Check Claim Not Mine 2',
    address: forger.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('signing for a foreign address is refused as not owned', crossAccount?.code, 'address-not-owned');

  // -------------------------------------------------------------------------
  // (e) A name already claimed by another address is refused
  // -------------------------------------------------------------------------
  console.log('\n(e) a name already claimed:');
  const rival = await attemptClaim(userB.id, forger, {
    name: NAME_MAIN,
    address: forger.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('a name claimed by another address is refused', rival?.code, 'name-taken');
  check('and the refusal names the current holder', rival?.message.includes(owner.address), true);

  const stillHeld = await prisma.merchant.findFirstOrThrow({
    where: { nameKey: merchantNameKey(NAME_MAIN) },
  });
  check('the original holder is not overwritten', stillHeld.payoutAddress, owner.address);

  const seeded = await attemptClaim(userA.id, owner, {
    name: 'Java House',
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  });
  check('an unsigned legacy row still reserves its name', seeded?.code, 'name-taken');

  const badName = await refusalOf(() =>
    claimMerchantName({
      userId: userA.id,
      name: '!!!',
      address: owner.address,
      issuedAt: new Date().toISOString(),
      nonce: nonce(),
      signature: mainSignature,
    })
  );
  check('a malformed name is refused with its own code', badName?.code, 'invalid-merchant-name');

  // -------------------------------------------------------------------------
  // The signed name must be the normalised one
  // -------------------------------------------------------------------------
  // The backend normalises (trim, collapse runs) before it verifies, so the
  // string the wallet signs has to be normalised too. The browser does that;
  // a client that does not is refused rather than having a different string
  // stored than the one that was signed. Fail closed.
  console.log('\nspacing in a signed name:');
  const spacedMessage: MerchantClaimMessage = {
    name: 'Check Claim  Spaced',
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const spacedSignature = await signClaim(owner, spacedMessage);
  const unnormalised = await refusalOf(() =>
    claimMerchantName({
      userId: userA.id,
      ...spacedMessage,
      signature: spacedSignature,
    })
  );
  check('a name signed with doubled spaces is refused', unnormalised?.code, 'signature-mismatch');

  const canonicalMessage: MerchantClaimMessage = { ...spacedMessage, name: 'Check Claim Spaced' };
  const normalisedClaim = await claimMerchantName({
    userId: userA.id,
    ...canonicalMessage,
    signature: await signClaim(owner, canonicalMessage),
  });
  check('the normalised form is accepted', normalisedClaim.name, 'Check Claim Spaced');
  check('and verifies', await merchantClaimVerifies(normalisedClaim), true);

  // -------------------------------------------------------------------------
  // (g, part 1) A merchant with no signature is never verified
  // -------------------------------------------------------------------------
  console.log('\n(g) an unverified binding is never verified:');
  const unverified = await prisma.merchant.create({
    data: { name: NAME_UNVERIFIED, payoutAddress: owner.address },
  });
  const unverifiedView = await toMerchantIdentityView(unverified);
  check('a merchant with no claim is unverified', unverifiedView.verified, false);
  check('and still reports its address', unverifiedView.payoutAddress, owner.address);

  // -------------------------------------------------------------------------
  // (g, part 2) A TAMPERED binding stops verifying
  // -------------------------------------------------------------------------
  const tamperedMessage: MerchantClaimMessage = {
    name: NAME_TAMPERED,
    address: owner.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const tamperedClaim = await claimMerchantName({
    userId: userA.id,
    ...tamperedMessage,
    signature: await signClaim(owner, tamperedMessage),
  });
  check('the tamper fixture starts out verified', await merchantClaimVerifies(tamperedClaim), true);

  const renamed = await prisma.merchant.update({
    where: { id: tamperedClaim.id },
    data: { name: 'Check Claim Hijacked' },
  });
  check('renaming a claimed row drops verification', await merchantClaimVerifies(renamed), false);

  const hijacked = await resolve('Check Claim Hijacked');
  check('a renamed row resolves by its new name', hijacked.status, 200);
  check('but is NOT verified', resolvedMerchantBody(hijacked.body).verified, false);

  const redirected = await prisma.merchant.update({
    where: { id: tamperedClaim.id },
    data: { name: NAME_TAMPERED, payoutAddress: forger.address },
  });
  check('repointing a claimed row drops verification', await merchantClaimVerifies(redirected), false);

  const repointed = await resolve(NAME_TAMPERED);
  const repointedMerchant = resolvedMerchantBody(repointed.body);
  check('a repointed row resolves', repointed.status, 200);
  check('and is NOT verified', repointedMerchant.verified, false);
  check('and shows the address it was repointed to', repointedMerchant.payoutAddress, forger.address);

  // -------------------------------------------------------------------------
  // (f) Resolving the QR returns the verified name with its address
  // -------------------------------------------------------------------------
  console.log('\n(f) resolving the QR:');
  const resolved = await resolve(NAME_MAIN);
  const resolvedMerchant = resolvedMerchantBody(resolved.body);
  check('resolve by claimed name returns 200', resolved.status, 200);
  check('and returns the claimed name', resolvedMerchant.name, NAME_MAIN);
  check('and returns the address beside it', resolvedMerchant.payoutAddress, owner.address);
  check('and reports the binding as verified', resolvedMerchant.verified, true);

  const legacy = await resolve('merchant_java_house');
  const legacyMerchant = resolvedMerchantBody(legacy.body);
  check('a legacy merchant resolves', legacy.status, 200);
  check('but is NOT reported as verified', legacyMerchant.verified, false);

  const unverifiedResolved = await resolve(NAME_UNVERIFIED);
  check(
    'an unsigned name is returned, unverified',
    resolvedMerchantBody(unverifiedResolved.body).verified,
    false
  );

  const byDeepLink = await resolve('seti://merchant?name=Check+Claim+Cafe');
  check('a name deep link resolves too', byDeepLink.status, 200);
  check('to the same merchant', resolvedMerchantBody(byDeepLink.body).verified, true);

  const unknown = await resolve('!!! not a merchant !!!');
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

  const routeMessage: MerchantClaimMessage = {
    name: NAME_ROUTE,
    address: routeAccount.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };

  const posted = await app.inject({
    method: 'POST',
    url: '/merchants/claim',
    payload: { ...routeMessage, signature: await signClaim(routeAccount, routeMessage) },
  });
  const postedBody = posted.json<Record<string, unknown>>();
  const postedMerchant = postedBody.merchant as Record<string, unknown>;
  check('POST /merchants/claim returns 201', posted.statusCode, 201);
  check('and the claimed name', postedMerchant.name, NAME_ROUTE);
  check('and the address it was claimed for', postedMerchant.payoutAddress, routeAccount.address);
  check('and verified: true', postedMerchant.verified, true);

  const forgedRouteMessage: MerchantClaimMessage = {
    name: 'Check Claim Route Forged',
    address: routeAccount.address,
    issuedAt: new Date().toISOString(),
    nonce: nonce(),
  };
  const refused = await app.inject({
    method: 'POST',
    url: '/merchants/claim',
    payload: { ...forgedRouteMessage, signature: await signClaim(owner, forgedRouteMessage) },
  });
  const refusedBody = refused.json<Record<string, unknown>>();
  check('a forged claim over HTTP is refused', refused.statusCode, 400);
  check('with the typed code in the envelope', refusedBody.code, 'signature-mismatch');

  await app.close();

  // -------------------------------------------------------------------------
  // Cleanup and the "the money path was left alone" proof
  // -------------------------------------------------------------------------
  await cleanup();
  await prisma.wallet.deleteMany({ where: { address: routeAccount.address } });

  const seededAfter = await prisma.merchant.findUnique({ where: { id: 'merchant_java_house' } });
  check(
    'the seeded merchant is untouched',
    seededAfter?.payoutAddress,
    '0x20C000000000000000000000b9537d11c60E8b50'
  );
  check('and carries no claim signature', seededAfter?.claimSignature, 'null');

  const realMerchantsAfter = await prisma.merchant.count({
    where: { NOT: FIXTURE_WHERE },
  });
  check('real merchants were not touched', realMerchantsAfter, realMerchantsBefore);
  check('and no fixture merchant was left behind', await prisma.merchant.count({ where: FIXTURE_WHERE }), 0);

  await prisma.$disconnect();
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} CHECK(S) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('merchant claims check crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
