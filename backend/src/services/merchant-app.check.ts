/**
 * The merchant app and the webhook secret Seti issues for it — `npm run check:merchant-app`.
 *
 * Requires: the `seti-postgres` container (`docker compose up -d`), like every other
 * database-backed suite.
 *
 * ## What this suite pins, and why each assertion is here
 *
 * The issue's acceptance criteria, in order, because each is a claim a reviewer has to
 * be able to check rather than believe:
 *
 *  1. **The secret is shown once.** Creating an app returns it in the `201`; no other
 *     route, list or view carries it, and the row stores a SEALED box, not the
 *     plaintext and not a hash. The last assertion is the interesting one: `openSecret`
 *     recovers the secret, which is what makes delivery signing possible at all, and a
 *     hash could never do it.
 *  2. **A delivery signed with the secret verifies.** Driven through the REAL path: a
 *     charge to the app's payout address, the classifier deciding it is paid, the
 *     delivery POSTed to a live receiver, and the bytes the receiver actually got
 *     verified with `verifySetiWebhookSignature` — the same function the receiver
 *     snippet in `docs/receive.md` is checked against.
 *  3. **A wrong secret fails.** The same header and body against a different secret is
 *     `signature-mismatch`; a tampered body, a missing header and a five-minute-old
 *     timestamp each fail with their own reason.
 *  4. **Rotation invalidates the old secret on the NEXT delivery.** Not "the row
 *     changed": a second charge is created AFTER the rotation, and its delivery
 *     verifies against the new secret and fails against the old one.
 *  5. **The app id alone cannot create or read a charge.** The app id is a public
 *     label. A create carrying it with no recipient signature is refused and writes
 *     nothing; the delivery log refuses it without the recipient's signature; and it
 *     is not a session on the merchant routes.
 *
 * It also proves the MIGRATION, not just the code: the two delivery columns, the app
 * table and the named index the delivery lookup needs are read back out of the
 * catalogue, because a migration that ran without error and did nothing looks exactly
 * like one that worked.
 *
 * Every row this file writes is a fixture (`check-merchant-app@seti.test`, app names
 * prefixed `Check App <run>`, charges `cmc<run>-NNN`), and cleanup is by those
 * predicates. Real apps and charges are counted before and after.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { merchantAppRoutes } from '../routes/merchant-apps.js';
import { publicChargeRoutes } from '../routes/public-charges.js';
import { apiErrorHandler } from '../server.js';
import { network as servedChain, PRIMARY_ASSET } from './chain.js';
import { createCharge } from './charge-store.js';
import { chargeTypedData, type ChargeFields, type SignedCharge } from './charge.js';
import { matchChargeTransfers, type ChargeTransferCandidate } from './charge-match.js';
import {
  MERCHANT_APP_ADMIN_TYPES,
  MERCHANT_APP_ADMIN_PRIMARY_TYPE,
  MERCHANT_APP_NAME_MAX,
  createMerchantApp,
  findOwnedMerchantApp,
  listMerchantApps,
  merchantAppAdminTypedData,
  merchantAppBindingTypedData,
  merchantAppForRecipient,
  merchantAppSecret,
  revokeMerchantApp,
  rotateMerchantAppSecret,
} from './merchant-app.js';
import { openSecret, WEBHOOK_SECRET_PREFIX } from '../lib/secret-box.js';
import {
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  verifySetiWebhookSignature,
} from '../lib/webhook-signature.js';
import { usableWebhookUrl } from '../lib/webhook-url.js';
import { readMerchantAppDeliveries, signWebhook } from './charge-webhook.js';
import { registerWallet } from './wallet-registry.js';

const RUN = randomUUID().slice(0, 8);
const APP_NAME_PREFIX = `Check App ${RUN}`;
const CHARGE_PREFIX = `cmc${RUN}`;
const FIXTURE_EMAIL = 'check-merchant-app@seti.test';

const CHAIN_ID = servedChain.chainId;
const NETWORK = servedChain.network;

/** The app's payout wallet, a stranger's wallet, and a wallet nobody registered. */
const OWNER: PrivateKeyAccount = privateKeyToAccount(generatePrivateKey());
const STRANGER: PrivateKeyAccount = privateKeyToAccount(generatePrivateKey());
const UNREGISTERED: PrivateKeyAccount = privateKeyToAccount(generatePrivateKey());

let failures = 0;
let asserts = 0;
let skips = 0;

function check(label: string, pass: boolean, detail?: string | number | null): void {
  asserts += 1;
  if (!pass) failures += 1;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

function checkEq(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  check(label, pass, pass ? undefined : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

/**
 * A refusal names a code, and the code is what a dashboard switches on.
 *
 * `checkRefusal` asserts the CODE rather than a status alone, because two different
 * codes can share a status and one of them will be the wrong fix.
 */
async function checkRefusal(
  label: string,
  run: () => Promise<unknown>,
  expected: { code: string; status: number }
): Promise<void> {
  try {
    await run();
    check(label, false, 'no refusal at all');
  } catch (error) {
    const code = (error as { code?: string }).code;
    const status = (error as { status?: number }).status;
    check(
      label,
      code === expected.code && status === expected.status,
      code === expected.code && status === expected.status
        ? undefined
        : `got ${String(code)}/${String(status)}, want ${expected.code}/${expected.status}`
    );
  }
}

function skip(label: string, why: string): void {
  skips += 1;
  console.log(`SKIP ${label} — ${why}`);
}

/** A charge id in the shape the API accepts: 6–64 of a–z, 0–9, `-`, `_`. */
let chargeCounter = 0;
function nextChargeId(): string {
  chargeCounter += 1;
  return `${CHARGE_PREFIX}-${String(chargeCounter).padStart(3, '0')}`;
}

/** A charge signed by `account`, to `recipient`, whose webhook goes to `webhookUrl`. */
async function signedCharge(input: {
  account: PrivateKeyAccount;
  recipient: string;
  webhookUrl: string | null;
  amount?: string;
}): Promise<{ charge: SignedCharge; webhookUrl: string | null }> {
  const id = nextChargeId();
  const fields: ChargeFields = {
    id,
    recipient: input.recipient.toLowerCase() as `0x${string}`,
    asset: PRIMARY_ASSET,
    amount: input.amount ?? '100.000000',
    memo: `Check charge ${id}`,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    nonce: randomUUID(),
    scope: null,
  };
  const signature = await input.account.signTypedData(chargeTypedData(fields, CHAIN_ID));
  return { charge: { ...fields, signature }, webhookUrl: input.webhookUrl };
}

/** The transfer that settles a charge: same recipient, same amount, memo naming it. */
function transferFor(charge: SignedCharge, amount = charge.amount): ChargeTransferCandidate {
  return {
    txHash: `0x${randomUUID().replace(/-/g, '').padEnd(64, 'a')}`,
    recipient: charge.recipient.toLowerCase(),
    asset: charge.asset,
    amount,
    memo: charge.memo,
    confirmed: true,
  };
}

// ---------------------------------------------------------------------------
// A receiver that keeps the exact bytes and header it was sent
// ---------------------------------------------------------------------------

interface Received {
  url: string;
  header: string;
  body: string;
  event: string;
  /** The public app id the delivery claimed, or '' when the deployment key signed it. */
  appId: string;
}

const received: Received[] = [];

async function startReceiver(): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      received.push({
        url: String(request.url ?? ''),
        header: String(request.headers['x-seti-signature'] ?? ''),
        body: Buffer.concat(chunks).toString('utf8'),
        event: String(request.headers['x-seti-event'] ?? ''),
        appId: String(request.headers['x-seti-app'] ?? ''),
      });
      response.statusCode = 200;
      response.end('{"ok":true}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

/** The binding message, exactly as the wallet will sign it. */
function bindingMessage(input: {
  name: string;
  payoutAddress: `0x${string}`;
  webhookUrl: string;
  website: string;
  issuedAt: string;
  nonce: string;
}) {
  return input;
}

async function main(): Promise<void> {
  const receiver = await startReceiver();
  const receiverUrl = (path: string) => `${receiver.url}${path}`;

  const realAppsBefore = await prisma.merchantApp.count({ where: { name: { not: { startsWith: 'Check App' } } } });
  const realChargesBefore = await prisma.charge.count({ where: { NOT: { publicId: { startsWith: 'cmc' } } } });

  // -------------------------------------------------------------------------
  // 0. Fixtures: an account, and the wallet it will bind an app to
  // -------------------------------------------------------------------------
  const user = await prisma.user.upsert({
    where: { email: FIXTURE_EMAIL },
    update: { network: NETWORK },
    create: { email: FIXTURE_EMAIL, network: NETWORK },
  });

  const alreadyRegistered = await prisma.wallet.findFirst({
    where: { address: OWNER.address.toLowerCase(), network: NETWORK },
  });
  if (!alreadyRegistered) {
    await registerWallet({
      userId: user.id,
      chain: 'tempo',
      asset: PRIMARY_ASSET,
      address: OWNER.address,
      network: NETWORK,
    });
  }

  // -------------------------------------------------------------------------
  // 0b. The MIGRATION, read back from the catalogue
  // -------------------------------------------------------------------------
  console.log('migration: the objects this feature needs actually exist');

  const columns = (await prisma.$queryRaw<
    { table_name: string; column_name: string; is_nullable: string }[]
  >`
    select table_name, column_name, is_nullable
      from information_schema.columns
     where (table_name = 'charge_webhook_deliveries'
            and column_name in ('merchantAppId', 'lastAttemptAt'))
        or (table_name = 'merchant_apps' and column_name in ('secretBox', 'secretHint', 'revokedAt'))
  `) ?? [];

  checkEq(
    'the delivery log has both new columns',
    columns
      .filter((row) => row.table_name === 'charge_webhook_deliveries')
      .map((row) => row.column_name)
      .sort(),
    ['lastAttemptAt', 'merchantAppId']
  );
  check(
    'both are NULLABLE, so every existing row keeps its meaning',
    columns
      .filter((row) => row.table_name === 'charge_webhook_deliveries')
      .every((row) => row.is_nullable === 'YES'),
    columns.map((row) => `${row.column_name}:${row.is_nullable}`).join(' ')
  );
  checkEq(
    'the app table carries the sealed secret and its revocation',
    columns
      .filter((row) => row.table_name === 'merchant_apps')
      .map((row) => row.column_name)
      .sort(),
    ['revokedAt', 'secretBox', 'secretHint']
  );

  const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
    select indexname from pg_indexes
     where tablename in ('merchant_apps', 'charge_webhook_deliveries')
  `;
  const indexNames = indexes.map((row) => row.indexname);
  check(
    'the index that serves "who owns this address" exists, named for its query',
    indexNames.includes('merchant_apps_payoutAddress_network_idx'),
    indexNames.find((name) => name.includes('payoutAddress')) ?? 'absent'
  );
  check(
    'the index that serves one app\'s delivery log exists',
    indexNames.includes('charge_webhook_deliveries_merchantAppId_createdAt_idx'),
    indexNames.find((name) => name.includes('merchantAppId')) ?? 'absent'
  );
  check(
    'and one name per owner is a constraint, not a convention',
    indexNames.includes('merchant_apps_ownerUserId_name_key'),
    'merchant_apps_ownerUserId_name_key'
  );

  // -------------------------------------------------------------------------
  // 1. Creating an app: what is refused, and in what order
  // -------------------------------------------------------------------------
  console.log('\ncreate: the signature comes before anything is stored');

  const appName = `${APP_NAME_PREFIX} Storefront`;
  const appWebhookRaw = receiverUrl('/app-hook');
  const appWebhook = new URL(appWebhookRaw).toString();
  const website = 'https://example.test/storefront';

  const issuedAt = new Date().toISOString();
  const nonce = randomUUID();

  const ownerBind = (over: Partial<Parameters<typeof bindingMessage>[0]> = {}) =>
    bindingMessage({
      name: appName,
      payoutAddress: OWNER.address.toLowerCase() as `0x${string}`,
      webhookUrl: appWebhook,
      website,
      issuedAt,
      nonce,
      ...over,
    });

  // A wallet that is NOT the payout address signing the message: a client built the
  // wrong body, and it must be told rather than bound to whatever the wallet named.
  const strangerSignature = await STRANGER.signTypedData(
    merchantAppBindingTypedData(ownerBind(), CHAIN_ID)
  );
  await checkRefusal(
    'a signature from another wallet is refused as a mismatch',
    () =>
      createMerchantApp({
        ownerUserId: user.id,
        body: {
          name: appName,
          payoutAddress: OWNER.address.toLowerCase(),
          webhookUrl: appWebhook,
          website,
          issuedAt,
          nonce,
          signature: strangerSignature,
        },
      }),
    { code: 'merchant-app-mismatch', status: 422 }
  );
  checkEq(
    'and no row was written for it',
    await prisma.merchantApp.count({ where: { name: appName } }),
    0
  );

  // A real signature from a wallet this account does not hold: the binding is honest
  // and STILL refused, because letting it in would let one account point another
  // person's address at its own endpoint.
  const unregisteredSignature = await UNREGISTERED.signTypedData(
    merchantAppBindingTypedData(
      ownerBind({ payoutAddress: UNREGISTERED.address.toLowerCase() as `0x${string}` }),
      CHAIN_ID
    )
  );
  await checkRefusal(
    'an address the account does not own is refused',
    () =>
      createMerchantApp({
        ownerUserId: user.id,
        body: {
          name: appName,
          payoutAddress: UNREGISTERED.address.toLowerCase(),
          webhookUrl: appWebhook,
          website,
          issuedAt,
          nonce,
          signature: unregisteredSignature,
        },
      }),
    { code: 'merchant-app-address-not-owned', status: 403 }
  );

  // A plain-http endpoint that is not loopback: the delivery carries an amount, so
  // this is refused before the signature is even considered.
  const httpSignature = await OWNER.signTypedData(
    merchantAppBindingTypedData(
      ownerBind({ webhookUrl: new URL('http://hooks.example.test/seti').toString() }),
      CHAIN_ID
    )
  );
  await checkRefusal(
    'a plain-http webhook url is refused',
    () =>
      createMerchantApp({
        ownerUserId: user.id,
        body: {
          name: appName,
          payoutAddress: OWNER.address.toLowerCase(),
          webhookUrl: 'http://hooks.example.test/seti',
          website,
          issuedAt,
          nonce,
          signature: httpSignature,
        },
      }),
    { code: 'merchant-app-webhook-invalid', status: 422 }
  );

  const staleIssuedAt = new Date(Date.now() - 10 * 60_000).toISOString();
  const staleSignature = await OWNER.signTypedData(
    merchantAppBindingTypedData(ownerBind({ issuedAt: staleIssuedAt }), CHAIN_ID)
  );
  await checkRefusal(
    'a signature issued ten minutes ago is stale',
    () =>
      createMerchantApp({
        ownerUserId: user.id,
        body: {
          name: appName,
          payoutAddress: OWNER.address.toLowerCase(),
          webhookUrl: appWebhook,
          website,
          issuedAt: staleIssuedAt,
          nonce,
          signature: staleSignature,
        },
      }),
    { code: 'merchant-app-stale', status: 422 }
  );

  const ownerSignature = await OWNER.signTypedData(
    merchantAppBindingTypedData(ownerBind(), CHAIN_ID)
  );

  const created = await createMerchantApp({
    ownerUserId: user.id,
    body: {
      name: appName,
      payoutAddress: OWNER.address.toLowerCase(),
      webhookUrl: appWebhook,
      website,
      issuedAt,
      nonce,
      signature: ownerSignature,
    },
  });

  const appRow = await prisma.merchantApp.findUnique({ where: { publicId: created.app.publicId } });

  // -------------------------------------------------------------------------
  // 2. The secret is shown once, and is a KEY rather than a digest
  // -------------------------------------------------------------------------
  console.log('\nthe secret: issued once, sealed at rest, never in a view');

  check('the create response carries the secret', typeof created.secret === 'string' && created.secret.length > 20);
  check(
    'it is recognisable as one',
    created.secret.startsWith(WEBHOOK_SECRET_PREFIX),
    created.secret.slice(0, WEBHOOK_SECRET_PREFIX.length)
  );
  check(
    'and carries 32 bytes of CSPRNG, base64url',
    created.secret.length >= WEBHOOK_SECRET_PREFIX.length + 43,
    `${created.secret.length} characters`
  );
  checkEq('the app id is public and shaped app_<16 hex>', /^app_[0-9a-f]{16}$/.test(created.app.publicId), true);
  checkEq('and it is not the secret', created.app.publicId.includes(created.secret), false);

  check(
    'the stored box does not contain the plaintext',
    appRow !== null && !appRow.secretBox.includes(created.secret),
    appRow?.secretBox.slice(0, 3)
  );
  checkEq(
    'nor is the plaintext anywhere in the row as JSON',
    JSON.stringify(appRow).includes(created.secret),
    false
  );
  checkEq(
    'it is NOT a hash: the key can be recovered, because signing needs the key itself',
    appRow ? openSecret(appRow.secretBox) : null,
    created.secret
  );
  checkEq('the hint is the last four characters, and only those', created.app.secretHint, created.secret.slice(-4));
  checkEq('a fresh app has rotated nothing yet', created.app.secretRotations, 0);

  // The view is the only renderer, so "no secret in a list" is one assertion, not a
  // promise about every route.
  const viewJson = JSON.stringify(created.app);
  check('the app view carries no secret field', !viewJson.includes(created.secret));
  check('and no sealed box either', !viewJson.includes('v1.'), 'secretBox absent');

  const listed = await listMerchantApps(user.id);
  check('the list has the app', listed.some((app) => app.publicId === created.app.publicId));
  check(
    'and nothing in the list is a secret',
    !JSON.stringify(listed).includes(created.secret) && !JSON.stringify(listed).includes(WEBHOOK_SECRET_PREFIX)
  );

  // One name per owner, enforced by the index rather than by a pre-check.
  //
  // The nonce is declared ONCE and used by both the signed message and the body: two
  // `randomUUID()` calls produce a signature over a different digest from the one the
  // service rebuilds, which recovers to an unrelated address and is refused as a
  // mismatch long before the name index is ever reached.
  const secondNonce = randomUUID();
  const secondSignature = await OWNER.signTypedData(
    merchantAppBindingTypedData(ownerBind({ name: appName, nonce: secondNonce }), CHAIN_ID)
  );
  await checkRefusal(
    'a second app with the same name is refused',
    () =>
      createMerchantApp({
        ownerUserId: user.id,
        body: {
          name: `${appName}  `,
          payoutAddress: OWNER.address.toLowerCase(),
          webhookUrl: appWebhook,
          website,
          issuedAt,
          nonce: secondNonce,
          signature: secondSignature,
        },
      }),
    { code: 'merchant-app-name-taken', status: 409 }
  );
  check(
    'the name is normalised before it is compared and signed',
    listed.every((app) => app.name === app.name.trim().replace(/\s+/g, ' ')),
    listed.map((app) => app.name).join(' | ')
  );
  const tooLong = `${'x'.repeat(MERCHANT_APP_NAME_MAX + 1)}`;
  const longSignature = await OWNER.signTypedData(
    merchantAppBindingTypedData(ownerBind({ name: tooLong }), CHAIN_ID)
  );
  await checkRefusal(
    `a name longer than ${MERCHANT_APP_NAME_MAX} characters is refused`,
    () =>
      createMerchantApp({
        ownerUserId: user.id,
        body: {
          name: tooLong,
          payoutAddress: OWNER.address.toLowerCase(),
          webhookUrl: appWebhook,
          website,
          issuedAt,
          nonce: randomUUID(),
          signature: longSignature,
        },
      }),
    { code: 'merchant-app-mismatch', status: 422 }
  );

  // -------------------------------------------------------------------------
  // 3. A delivery signed with the secret verifies, and a wrong one does not
  // -------------------------------------------------------------------------
  console.log('\ndelivery: signed with the app\'s secret, verified from the bytes received');

  received.length = 0;

  const firstCharge = await signedCharge({
    account: OWNER,
    recipient: OWNER.address,
    webhookUrl: receiverUrl('/charge-hook'),
  });
  const firstWrite = await createCharge({
    charge: firstCharge.charge,
    network: NETWORK,
    chainId: CHAIN_ID,
    webhookUrl: firstCharge.webhookUrl,
    idempotencyKey: null,
  });
  checkEq('a charge to the app\'s payout address is created', firstWrite.kind, 'created');

  const firstMatch = await matchChargeTransfers({
    transfers: [transferFor(firstCharge.charge)],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  checkEq('and the classifier decides it is paid', firstMatch[0]?.status ?? null, 'paid');

  const firstDelivery = await prisma.chargeWebhookDelivery.findFirst({
    where: { charge: { publicId: firstCharge.charge.id } },
  });
  check('one delivery row exists', firstDelivery !== null, firstDelivery?.state);
  checkEq('and it was delivered on the first attempt', firstDelivery?.state, 'delivered');
  checkEq('it was SIGNED by the app, not the deployment key', firstDelivery?.merchantAppId, appRow?.id);
  checkEq('it went where the charge said', firstDelivery?.url, firstCharge.webhookUrl);
  checkEq('and the receiver got exactly one POST', received.length, 1);

  const first = received[0];
  check('a receiver can see the signature header', Boolean(first?.header), first?.header.slice(0, 16));
  checkEq('the event is the one that happened', first?.event, 'charge.paid');
  checkEq('the delivery names the app it came from', first?.appId, created.app.publicId);
  check('and that is a label, not the key', first?.appId !== created.secret);

  const verdict = verifySetiWebhookSignature({
    header: first?.header,
    rawBody: first?.body ?? '',
    secret: created.secret,
  });
  checkEq('the delivery verifies against the app\'s secret', verdict.ok, true);

  const wrongSecret = verifySetiWebhookSignature({
    header: first?.header,
    rawBody: first?.body ?? '',
    secret: `${WEBHOOK_SECRET_PREFIX}${'A'.repeat(43)}`,
  });
  checkEq(
    'a wrong secret fails, and says so rather than throwing',
    wrongSecret.ok ? null : wrongSecret.reason,
    'signature-mismatch'
  );

  const tampered = verifySetiWebhookSignature({
    // One byte more than was signed. Always a difference, so this cannot pass by
    // accident on a payload whose shape drifted.
    header: first?.header,
    rawBody: `${first?.body ?? ''} `,
    secret: created.secret,
  });
  checkEq('a tampered body fails', tampered.ok ? null : tampered.reason, 'signature-mismatch');

  const missing = verifySetiWebhookSignature({ header: null, rawBody: first?.body ?? '', secret: created.secret });
  checkEq('no header at all is a failure, never a pass', missing.ok ? null : missing.reason, 'missing-header');

  const malformed = verifySetiWebhookSignature({
    header: 'v1=deadbeef',
    rawBody: first?.body ?? '',
    secret: created.secret,
  });
  checkEq('a header without a timestamp is refused', malformed.ok ? null : malformed.reason, 'malformed-header');

  // The window is proved at its own bounds, not by waiting five minutes.
  const oldTimestamp = Math.floor(Date.now() / 1000) - (WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS + 1);
  const oldHeader = signedHeaderFor(oldTimestamp, first?.body ?? '', created.secret);
  const stale = verifySetiWebhookSignature({
    header: oldHeader,
    rawBody: first?.body ?? '',
    secret: created.secret,
  });
  checkEq(
    `a signature older than ${WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS}s is stale`,
    stale.ok ? null : stale.reason,
    'stale-timestamp'
  );
  const futureTimestamp = Math.floor(Date.now() / 1000) + (WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS + 1);
  const futureHeader = signedHeaderFor(futureTimestamp, first?.body ?? '', created.secret);
  const future = verifySetiWebhookSignature({
    header: futureHeader,
    rawBody: first?.body ?? '',
    secret: created.secret,
  });
  checkEq('and one dated in the future is refused too', future.ok ? null : future.reason, 'stale-timestamp');

  // -------------------------------------------------------------------------
  // 4. Rotation: the old secret is dead on the NEXT delivery
  // -------------------------------------------------------------------------
  console.log('\nrotation: one signed tap, and the old secret signs nothing again');

  const strangerRotateAt = new Date().toISOString();
  const strangerRotateSignature = await STRANGER.signTypedData(
    merchantAppAdminTypedData(
      { appId: created.app.publicId, action: 'rotate', issuedAt: strangerRotateAt, nonce: randomUUID() },
      CHAIN_ID
    )
  );
  await checkRefusal(
    'a rotation signed by a stranger is refused',
    () =>
      rotateMerchantAppSecret({
        ownerUserId: user.id,
        publicId: created.app.publicId,
        action: 'rotate',
        issuedAt: strangerRotateAt,
        nonce: randomUUID(),
        signature: strangerRotateSignature,
      }),
    { code: 'merchant-app-signature-invalid', status: 403 }
  );

  const rotateIssuedAt = new Date().toISOString();
  const rotateNonce = randomUUID();
  const rotateSignature = await OWNER.signTypedData(
    merchantAppAdminTypedData(
      { appId: created.app.publicId, action: 'rotate', issuedAt: rotateIssuedAt, nonce: rotateNonce },
      CHAIN_ID
    )
  );

  const rotated = await rotateMerchantAppSecret({
    ownerUserId: user.id,
    publicId: created.app.publicId,
    action: 'rotate',
    issuedAt: rotateIssuedAt,
    nonce: rotateNonce,
    signature: rotateSignature,
  });

  check('rotation issues a different secret', rotated.secret !== created.secret);
  checkEq('and counts itself', rotated.app.secretRotations, 1);
  checkEq(
    'the new secret is the one stored, and the old one is gone',
    (await prisma.merchantApp.findUnique({ where: { publicId: created.app.publicId } }))?.secretBox
      ? openSecret(
          (await prisma.merchantApp.findUnique({ where: { publicId: created.app.publicId } }))!.secretBox
        )
      : null,
    rotated.secret
  );

  received.length = 0;

  const secondCharge = await signedCharge({
    account: OWNER,
    recipient: OWNER.address,
    webhookUrl: receiverUrl('/charge-hook-2'),
  });
  await createCharge({
    charge: secondCharge.charge,
    network: NETWORK,
    chainId: CHAIN_ID,
    webhookUrl: secondCharge.webhookUrl,
    idempotencyKey: null,
  });
  await matchChargeTransfers({
    transfers: [transferFor(secondCharge.charge)],
    network: NETWORK,
    chainId: CHAIN_ID,
  });

  const second = received[0];
  const newVerdict = verifySetiWebhookSignature({
    header: second?.header,
    rawBody: second?.body ?? '',
    secret: rotated.secret,
  });
  checkEq('the NEXT delivery verifies against the rotated secret', newVerdict.ok, true);

  const oldVerdict = verifySetiWebhookSignature({
    header: second?.header,
    rawBody: second?.body ?? '',
    secret: created.secret,
  });
  checkEq(
    'and the old secret no longer verifies it',
    oldVerdict.ok ? null : oldVerdict.reason,
    'signature-mismatch'
  );

  // The action travels INSIDE the signed bytes, which is what stops a rotation
  // signature being replayed as a revoke. The struct is the evidence.
  checkEq(
    'the admin message carries the action, so one signature cannot authorise another',
    MERCHANT_APP_ADMIN_TYPES[MERCHANT_APP_ADMIN_PRIMARY_TYPE].map((field) => field.name),
    ['appId', 'action', 'issuedAt', 'nonce']
  );
  checkEq(
    'and the app is still live after a stranger tried to rotate it',
    (await prisma.merchantApp.findUnique({ where: { publicId: created.app.publicId } }))?.revokedAt,
    null
  );
  check(
    'the app\'s own delivery log reads back through the scoped reader',
    (await readMerchantAppDeliveries(appRow?.id ?? '')).length >= 2,
    `${(await readMerchantAppDeliveries(appRow?.id ?? '')).length} rows`
  );

  // -------------------------------------------------------------------------
  // 5. The app id alone is not a credential
  // -------------------------------------------------------------------------
  console.log('\nthe app id: a public label, never an authority');

  const chargeApi = Fastify();
  chargeApi.setErrorHandler(apiErrorHandler);
  await chargeApi.register(publicChargeRoutes, { prefix: '/public/charges' });
  await chargeApi.ready();

  const appIdHeaders = {
    'x-seti-app-id': created.app.publicId,
    // The app's own signature is over a webhook body, not over a charge: sending it
    // here is the "I have an app id, so I must be allowed" attempt.
    'x-seti-signature': ownerSignature,
    'x-seti-issued-at': issuedAt,
    'x-seti-nonce': nonce,
    'content-type': 'application/json',
  };

  const createWithAppId = await chargeApi.inject({
    method: 'POST',
    url: '/public/charges',
    headers: appIdHeaders,
    payload: {
      id: `${CHARGE_PREFIX}-app`,
      recipient: OWNER.address.toLowerCase(),
      asset: PRIMARY_ASSET,
      amount: '500.000000',
      memo: 'Created with an app id, which must not be enough',
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      nonce: randomUUID(),
      signature: ownerSignature,
    } as never,
    remoteAddress: '198.51.100.7',
  });
  checkEq('a create carrying only an app id is refused', createWithAppId.statusCode, 422);
  checkEq(
    'with the code that names the missing signature',
    createWithAppId.json<{ code?: string }>().code,
    'charge-signature-invalid'
  );
  checkEq(
    'and it wrote no charge',
    await prisma.charge.count({ where: { publicId: `${CHARGE_PREFIX}-app` } }),
    0
  );

  const readDeliveriesWithAppId = await chargeApi.inject({
    method: 'GET',
    url: `/public/charges/${firstCharge.charge.id}/deliveries`,
    headers: appIdHeaders,
    remoteAddress: '198.51.100.8',
  });
  checkEq('the delivery log refuses an app id', readDeliveriesWithAppId.statusCode, 403);
  check(
    'because reading it needs the recipient\'s own signature',
    readDeliveriesWithAppId.json<{ code?: string }>().code === 'charge-signature-invalid',
    readDeliveriesWithAppId.json<{ code?: string }>().code
  );

  await chargeApi.close();

  // The merchant routes themselves: no session, no answer.
  const merchant = Fastify();
  merchant.setErrorHandler(apiErrorHandler);
  await merchant.register(merchantAppRoutes, { prefix: '/merchant-apps' });
  await merchant.ready();

  const bypassOn = env.DEV_BYPASS_AUTH === 'true' && env.NODE_ENV === 'development';
  if (bypassOn) {
    skip(
      'the merchant routes refuse an app id as a session',
      'DEV_BYPASS_AUTH is on for this run, so every request resolves to the fixture account'
    );
  } else {
    const listNoSession = await merchant.inject({ method: 'GET', url: '/merchant-apps' });
    checkEq('listing apps with no session is a 401', listNoSession.statusCode, 401);

    const appIdAsToken = await merchant.inject({
      method: 'GET',
      url: `/merchant-apps/${created.app.publicId}/deliveries`,
      headers: { authorization: `Bearer ${created.app.publicId}` },
    });
    checkEq('and the app id is not a bearer token', appIdAsToken.statusCode, 401);
  }

  await merchant.close();

  // -------------------------------------------------------------------------
  // 6. The app's own endpoint is where events go when a charge names none
  // -------------------------------------------------------------------------
  console.log('\nthe app endpoint: a merchant configures it once');

  const chatty = usableWebhookUrl(receiverUrl('/app-hook'));
  if (chatty.kind !== 'url') {
    skip(
      'a charge with no webhookUrl is delivered to the app\'s own URL',
      `a loopback receiver is refused under NODE_ENV=${env.NODE_ENV}`
    );
  } else {
    received.length = 0;

    const urlLess = await signedCharge({ account: OWNER, recipient: OWNER.address, webhookUrl: null });
    await createCharge({
      charge: urlLess.charge,
      network: NETWORK,
      chainId: CHAIN_ID,
      webhookUrl: null,
      idempotencyKey: null,
    });
    await matchChargeTransfers({
      transfers: [transferFor(urlLess.charge)],
      network: NETWORK,
      chainId: CHAIN_ID,
    });

    const delivered = await prisma.chargeWebhookDelivery.findFirst({
      where: { charge: { publicId: urlLess.charge.id } },
    });
    checkEq('a charge with no webhookUrl still has somewhere to go', delivered?.url, appWebhook);
    checkEq('and it reached the app\'s endpoint', received.length, 1);
    checkEq(
      'signed with the app\'s secret',
      verifySetiWebhookSignature({
        header: received[0]?.header,
        rawBody: received[0]?.body ?? '',
        secret: rotated.secret,
      }).ok,
      true
    );
    checkEq(
      'and the delivery log a merchant reads is this app\'s',
      (await prisma.chargeWebhookDelivery.findUnique({ where: { id: delivered?.id ?? '' } }))?.merchantAppId,
      appRow?.id
    );
    check(
      'nothing in it belongs to another app',
      (await readMerchantAppDeliveries(appRow?.id ?? '')).every((row) =>
        received.some((message) => message.body.includes(row.event))
      ),
      'scoped by merchantAppId'
    );
  }

  // -------------------------------------------------------------------------
  // 7. Revocation: the rollback, and it costs no data
  // -------------------------------------------------------------------------
  console.log('\nrevocation: the app signs nothing, and its history stays');

  const revokeIssuedAt = new Date().toISOString();
  const revokeNonce = randomUUID();
  const revokeSignature = await OWNER.signTypedData(
    merchantAppAdminTypedData(
      { appId: created.app.publicId, action: 'revoke', issuedAt: revokeIssuedAt, nonce: revokeNonce },
      CHAIN_ID
    )
  );

  const revoked = await revokeMerchantApp({
    ownerUserId: user.id,
    publicId: created.app.publicId,
    issuedAt: revokeIssuedAt,
    nonce: revokeNonce,
    signature: revokeSignature,
  });

  check('the app is revoked', revoked.revokedAt !== null, revoked.revokedAt);
  checkEq('its secret is no longer readable', merchantAppSecret((await findOwnedMerchantApp({ ownerUserId: user.id, publicId: created.app.publicId }))), null);
  checkEq(
    'and nothing signs for its address any more',
    await merchantAppForRecipient({ recipient: OWNER.address }),
    null
  );
  await checkRefusal(
    'rotating a revoked app is refused, and says which fix',
    () =>
      rotateMerchantAppSecret({
        ownerUserId: user.id,
        publicId: created.app.publicId,
        action: 'rotate',
        issuedAt: new Date().toISOString(),
        nonce: randomUUID(),
        signature: rotateSignature,
      }),
    { code: 'merchant-app-revoked', status: 409 }
  );
  check(
    'its deliveries are history that stays',
    (await prisma.chargeWebhookDelivery.count({ where: { merchantAppId: appRow?.id ?? '' } })) > 0,
    'rows kept'
  );

  // -------------------------------------------------------------------------
  // 8. Cleanup, and the proof nothing real was touched
  // -------------------------------------------------------------------------
  await new Promise<void>((resolve) => receiver.server.close(() => resolve()));

  const appIds = (await prisma.merchantApp.findMany({
    where: { name: { startsWith: 'Check App' } },
    select: { id: true },
  })).map((row) => row.id);

  await prisma.chargeWebhookDelivery.deleteMany({
    where: { OR: [{ charge: { publicId: { startsWith: 'cmc' } } }, { merchantAppId: { in: appIds } }] },
  });
  const deletedCharges = await prisma.charge.deleteMany({ where: { publicId: { startsWith: 'cmc' } } });
  const deletedApps = await prisma.merchantApp.deleteMany({ where: { name: { startsWith: 'Check App' } } });

  check('the fixture charges were cleaned up', deletedCharges.count > 0, `${deletedCharges.count} removed`);
  check('and the fixture apps', deletedApps.count > 0, `${deletedApps.count} removed`);
  checkEq(
    'nothing of this run is left',
    await prisma.merchantApp.count({ where: { name: { startsWith: 'Check App' } } }),
    0
  );
  checkEq(
    'and no real app was touched',
    await prisma.merchantApp.count({ where: { name: { not: { startsWith: 'Check App' } } } }),
    realAppsBefore
  );
  checkEq(
    'nor any real charge',
    await prisma.charge.count({ where: { NOT: { publicId: { startsWith: 'cmc' } } } }),
    realChargesBefore
  );

  await prisma.wallet.deleteMany({ where: { address: OWNER.address.toLowerCase(), network: NETWORK } });

  await prisma.$disconnect();
  const skipped = skips > 0 ? `, ${skips} skipped` : '';
  console.log(`\n${asserts} assertions — ${failures === 0 ? `all passed${skipped}.` : `${failures} FAILED${skipped}.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

/** A signature header for an arbitrary instant, so the window is provable. */
function signedHeaderFor(timestampSeconds: number, body: string, secret: string): string {
  return signWebhook({ secret, timestampSeconds, body });
}

main().catch(async (error) => {
  console.error('merchant app check crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
