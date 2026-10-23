/**
 * The charge API, end to end — `npm run check:charge-api`.
 *
 * Requires: `docker compose up -d` (the `seti-postgres` container), like the other
 * database-backed suites. It registers ONLY `publicChargeRoutes` on a bare Fastify
 * instance with the REAL error handler, so it does not depend on unrelated services
 * being healthy — but a refusal that leaked a 500 would still surface here.
 *
 * What this suite is for, and why each assertion exists:
 *
 *  1. **The signature is the account.** A charge created with a real EIP-712
 *     signature from a throwaway key is accepted with NO user, token or session; a
 *     tampered amount, a signature from another wallet and a missing signature are
 *     each refused with a CODE (never a 500) and leave no row.
 *  2. **Idempotency.** The same `Idempotency-Key` twice is ONE charge and a 200 whose
 *     body equals the original, proved by comparing bodies and counting rows. The 24h
 *     window is proved by ageing the stored `idempotencyAt`.
 *  3. **Cancel is the recipient's, and only from pending.**
 *  4. **Paid is decided by the classifier, and announced exactly once.** The transfer
 *     goes through the SAME function the indexer calls; the webhook's HMAC is checked
 *     against the bytes the receiver actually got, so a signature that verifies by
 *     accident is impossible. Replaying the transfer adds no row and no POST.
 *  5. **Underpaid is not paid** — 2% short stays `underpaid` and is never announced as
 *     `charge.paid`.
 *  6. **Retries back off, then succeed on the SAME row.**
 *
 * Every charge this suite writes has a run-scoped id prefix (`chk<run>-NNN`, fixed
 * width so one id is never a substring of another), and cleanup is one `deleteMany`.
 * Real charges are counted before and after.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import Fastify, { type FastifyInstance } from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { parseUnits } from 'viem';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { publicChargeRoutes } from '../routes/public-charges.js';
import { apiErrorHandler } from '../server.js';
import { network as servedChain, PRIMARY_ASSET } from './chain.js';
import { chargeTypedData, type ChargeFields, type SignedCharge } from './charge.js';
import {
  chargeAdminTypedData,
  type ChargeAdminAction,
  type ChargeAdminMessage,
} from './charge-admin.js';
import { matchChargeTransfers, type ChargeTransferCandidate } from './charge-match.js';
import { CHARGE_ID_PATTERN, chargePageOrigin, unitsToAmount } from './charge-store.js';
import { merchantFeeUnits } from './fees.js';
import { treasuryAddressFor } from '../config/networks.js';
import { WEBHOOK_SIGNATURE_HEADER, deliverDueWebhooks } from './charge-webhook.js';

/** Every charge this run writes starts with this, so cleanup is one predicate. */
const RUN = randomUUID().slice(0, 8);
const ID_PREFIX = `chk${RUN}`;

const CHAIN_ID = servedChain.chainId;
const NETWORK = servedChain.network;

const RECIPIENT: PrivateKeyAccount = privateKeyToAccount(generatePrivateKey());
const STRANGER: PrivateKeyAccount = privateKeyToAccount(generatePrivateKey());

let app: FastifyInstance;

let failures = 0;
let asserts = 0;

function check(label: string, pass: boolean, detail?: string | number | null): void {
  asserts += 1;
  if (!pass) failures += 1;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

function checkEq(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  check(
    label,
    pass,
    pass ? undefined : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`
  );
}

/** A charge id in the shape the API accepts, unique and fixed width per call. */
let idCounter = 0;
function chargeId(): string {
  idCounter += 1;
  return `${ID_PREFIX}-${String(idCounter).padStart(3, '0')}`;
}

/**
 * A fresh source address per request.
 *
 * The per-source create budget is a REAL limit (20 a minute), so a suite that fired
 * forty creates from `127.0.0.1` would start testing its own limiter instead of the
 * thing each assertion is about. Requests therefore come from distinct addresses; the
 * limiter gets its own section at the end, where it is the subject.
 */
let ipCounter = 0;
function nextSource(): string {
  ipCounter += 1;
  return `198.51.${Math.floor(ipCounter / 256) % 256}.${(ipCounter % 256) || 1}`;
}

function post(
  url: string,
  payload: unknown,
  headers: Record<string, string> = {},
  remoteAddress: string = nextSource()
) {
  return app.inject({ method: 'POST', url, payload: payload as never, headers, remoteAddress });
}

function get(
  url: string,
  headers: Record<string, string> = {},
  remoteAddress: string = nextSource()
) {
  return app.inject({ method: 'GET', url, headers, remoteAddress });
}

/** A charge body signed by `account`, over `amount` unless overridden. */
async function signedCharge(
  input: {
    account?: PrivateKeyAccount;
    id?: string;
    amount?: string;
    expiresInMs?: number;
    memo?: string;
    recipient?: string;
  } = {}
): Promise<SignedCharge> {
  const account = input.account ?? RECIPIENT;
  const id = input.id ?? chargeId();
  const fields: ChargeFields = {
    id,
    recipient: (input.recipient ?? account.address.toLowerCase()) as `0x${string}`,
    asset: PRIMARY_ASSET,
    amount: input.amount ?? '100.000000',
    memo: input.memo ?? `Check charge ${id}`,
    expiresAt: new Date(Date.now() + (input.expiresInMs ?? 60 * 60_000)).toISOString(),
    nonce: randomUUID(),
    scope: null,
  };

  const signature = await account.signTypedData(chargeTypedData(fields, CHAIN_ID));
  return { ...fields, signature };
}

/** The three headers a managing call carries. */
async function adminHeaders(input: {
  chargeId: string;
  action: ChargeAdminAction;
  account?: PrivateKeyAccount;
  issuedAt?: string;
}): Promise<Record<string, string>> {
  const account = input.account ?? RECIPIENT;
  const message: ChargeAdminMessage = {
    chargeId: input.chargeId,
    action: input.action,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    nonce: randomUUID(),
  };
  const signature = await account.signTypedData(chargeAdminTypedData(message, CHAIN_ID));

  return {
    'x-seti-signature': signature,
    'x-seti-issued-at': message.issuedAt,
    'x-seti-nonce': message.nonce,
  };
}

/** An observed transfer for a charge, as the indexer would build it. */
function transferFor(input: {
  charge: ChargeFields;
  amount: string;
  memo?: string;
  recipient?: string;
  asset?: string;
  confirmed?: boolean;
}): ChargeTransferCandidate {
  return {
    txHash: `0x${randomUUID().replace(/-/g, '').padEnd(64, 'a')}`,
    recipient: (input.recipient ?? input.charge.recipient).toLowerCase(),
    asset: input.asset ?? input.charge.asset,
    amount: input.amount,
    memo: input.memo ?? input.charge.memo,
    confirmed: input.confirmed ?? true,
  };
}

// ---------------------------------------------------------------------------
// A webhook receiver that verifies what it was sent
// ---------------------------------------------------------------------------

interface Received {
  headers: Record<string, string | string[] | undefined>;
  body: string;
  /** True when the HMAC in `x-seti-signature` matches this body and the test secret. */
  signatureValid: boolean;
  event: string;
}

const received: Received[] = [];

/** Answer 500 to the next N requests, to prove the retry path. */
let failNext = 0;

async function startReceiver(): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const header = String(request.headers[WEBHOOK_SIGNATURE_HEADER] ?? '');
      const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
      const secret = env.SETI_WEBHOOK_SECRET ?? '';

      let signatureValid = false;
      if (match && secret) {
        const expected = createHmac('sha256', secret).update(`${match[1]}.${body}`).digest('hex');
        signatureValid = expected === match[2];
      }

      received.push({
        headers: request.headers,
        body,
        signatureValid,
        event: String(request.headers['x-seti-event'] ?? ''),
      });

      if (failNext > 0) {
        failNext -= 1;
        response.statusCode = 500;
        response.end('{"error":"receiver is having a bad day"}');
        return;
      }

      response.statusCode = 200;
      response.end('{"ok":true}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  return { server, url: `http://127.0.0.1:${port}/hooks/charges` };
}

/** Deliveries the receiver saw for one charge id. */
function deliveriesFor(chargeIdValue: string): Received[] {
  return received.filter((entry) => entry.body.includes(chargeIdValue));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`charge API check — chain ${CHAIN_ID} (${NETWORK}), primary asset ${PRIMARY_ASSET}\n`);

  /*
   * One precondition, stated once. The webhook half of this suite signs real deliveries
   * and verifies them with the receiver's copy of the secret, so with none set nineteen
   * assertions fail for a single reason. Say the reason instead of nineteen symptoms,
   * because a wall of failures reads as broken code.
   */
  if (!env.SETI_WEBHOOK_SECRET) {
    console.error(
      'check:charge-api needs SETI_WEBHOOK_SECRET: the webhook assertions sign real deliveries\n' +
        'and verify the signature with the same value. Set it to any strong value locally,\n' +
        'e.g. SETI_WEBHOOK_SECRET=check-only-webhook-secret, and run again. CI sets it in\n' +
        '.github/workflows/verify.yml and deploy.yml.'
    );
    process.exit(1);
  }

  const realChargesBefore = await prisma.charge.count({
    where: { NOT: { publicId: { startsWith: 'chk' } } },
  });

  app = Fastify({ logger: false });
  app.setErrorHandler(apiErrorHandler);
  await app.register(publicChargeRoutes, { prefix: '/public/charges' });

  const { server: receiver, url: webhookUrl } = await startReceiver();

  // -------------------------------------------------------------------------
  // 1. Create — a signature, and no account
  // -------------------------------------------------------------------------
  console.log('create: a wallet signs, and that is the whole signup');

  const first = await signedCharge();
  check('the id this suite mints follows the documented shape', CHARGE_ID_PATTERN.test(first.id), first.id);

  const created = await post('/public/charges', first);
  checkEq('a signed charge is accepted', created.statusCode, 201);

  const createdBody = created.json<{ charge: Record<string, unknown> }>();
  checkEq('it is pending', createdBody.charge.status, 'pending');
  checkEq('the amount is what was signed', createdBody.charge.amount, '100.000000');
  checkEq('the address is the signer', createdBody.charge.recipient, RECIPIENT.address.toLowerCase());
  checkEq(
    'the page URL points at the site the deployment serves',
    createdBody.charge.pageUrl,
    `${chargePageOrigin()}/pay/${first.id}`
  );
  checkEq('the QR payload names the charge', createdBody.charge.uri, `seti://pay/${first.id}`);
  checkEq('nothing has been received', createdBody.charge.received, '0.000000');
  checkEq('it says which network it is signed for', createdBody.charge.network, NETWORK);
  check(
    'the status wording travels with it',
    typeof (createdBody.charge.statusCopy as { label?: string }).label === 'string'
  );
  checkEq('and a row exists', await prisma.charge.count({ where: { publicId: first.id } }), 1);

  // -------------------------------------------------------------------------
  // 2. Idempotency
  // -------------------------------------------------------------------------
  console.log('\nidempotency: one key, one charge, the original body');

  const keyed = await signedCharge();
  const key = `check-${RUN}-${randomUUID()}`;
  const keyedFirst = await post('/public/charges', keyed, { 'idempotency-key': key });
  const keyedSecond = await post('/public/charges', keyed, { 'idempotency-key': key });

  checkEq('the first create is 201', keyedFirst.statusCode, 201);
  checkEq('the replay is 200', keyedSecond.statusCode, 200);
  checkEq('the replay carries the same body', keyedSecond.json(), keyedFirst.json());
  checkEq(
    'and there is exactly one charge for that id',
    await prisma.charge.count({ where: { publicId: keyed.id } }),
    1
  );

  const reused = await post('/public/charges', await signedCharge(), { 'idempotency-key': key });
  checkEq('the same key with a different charge is a 409', reused.statusCode, 409);
  checkEq(
    'with a code, not prose',
    reused.json<{ code?: string }>().code,
    'idempotency-key-reused'
  );

  const aged = await signedCharge();
  const agedKey = `check-${RUN}-aged`;
  await post('/public/charges', aged, { 'idempotency-key': agedKey });
  await prisma.charge.updateMany({
    where: { publicId: aged.id },
    data: { idempotencyAt: new Date(Date.now() - 25 * 60 * 60_000) },
  });
  const afterWindow = await post('/public/charges', await signedCharge(), {
    'idempotency-key': agedKey,
  });
  checkEq('after 24h the key is reusable for a new charge', afterWindow.statusCode, 201);

  // A replay is answered with the ORIGINAL body even after the charge's own deadline has
  // passed: the charge exists, it is the same request, and "charge-expired" would be a
  // refusal of something that already succeeded.
  const shortLived = await signedCharge({ expiresInMs: 1200 });
  const shortKey = `check-${RUN}-short`;
  const shortFirst = await post('/public/charges', shortLived, { 'idempotency-key': shortKey });
  await wait(1300);
  const shortReplay = await post('/public/charges', shortLived, { 'idempotency-key': shortKey });
  checkEq('a replay after the deadline still answers 200', shortReplay.statusCode, 200);
  checkEq('with the original body, unchanged', shortReplay.json(), shortFirst.json());
  checkEq(
    'and no second charge exists for it',
    await prisma.charge.count({ where: { publicId: shortLived.id } }),
    1
  );

  // -------------------------------------------------------------------------
  // 3. Tampering and forgery leave no row
  // -------------------------------------------------------------------------
  console.log('\nrefusals: a tampered charge is a code, not a 500, and writes nothing');

  const tamperedId = chargeId();
  const signedFor250 = await signedCharge({ id: tamperedId, amount: '250.000000' });
  const tampered = await post('/public/charges', { ...signedFor250, amount: '999.000000' });
  checkEq('a tampered amount is a 422', tampered.statusCode, 422);
  checkEq(
    'refused with the signature code',
    tampered.json<{ code?: string }>().code,
    'charge-signature-invalid'
  );
  checkEq('and no row was written', await prisma.charge.count({ where: { publicId: tamperedId } }), 0);

  const strangerId = chargeId();
  const strangerSigned = await signedCharge({
    account: STRANGER,
    id: strangerId,
    recipient: RECIPIENT.address,
  });
  const wrongWallet = await post('/public/charges', strangerSigned);
  checkEq('a signature from the wrong wallet is a 422', wrongWallet.statusCode, 422);
  checkEq(
    'with the same code, not a 500',
    wrongWallet.json<{ code?: string }>().code,
    'charge-signature-invalid'
  );
  checkEq('and writes no row', await prisma.charge.count({ where: { publicId: strangerId } }), 0);

  const unsigned = await post('/public/charges', { ...(await signedCharge()), signature: '0x' });
  checkEq('an unreadable signature is a 422', unsigned.statusCode, 422);

  const badId = await signedCharge({ id: 'CH_UPPER_CASE' });
  const badIdResponse = await post('/public/charges', badId);
  checkEq('an id the page would refuse is refused here too', badIdResponse.statusCode, 422);
  checkEq(
    'with the id code',
    badIdResponse.json<{ code?: string }>().code,
    'charge-id-invalid'
  );

  const past = await signedCharge({ expiresInMs: -60_000 });
  const pastResponse = await post('/public/charges', past);
  checkEq('a charge created already expired is refused', pastResponse.statusCode, 422);
  checkEq('with the expiry code', pastResponse.json<{ code?: string }>().code, 'charge-expired');

  const duplicate = await post('/public/charges', first);
  checkEq('re-creating a live charge id is a 409', duplicate.statusCode, 409);
  checkEq('with the id-taken code', duplicate.json<{ code?: string }>().code, 'charge-id-taken');

  // -------------------------------------------------------------------------
  // 4. Read
  // -------------------------------------------------------------------------
  console.log('\nread: status, txHash and timestamps');

  const read = await get(`/public/charges/${first.id}`);
  checkEq('a known charge reads 200', read.statusCode, 200);
  const readBody = read.json<{ charge: Record<string, unknown> }>();
  checkEq('it carries no txHash yet', readBody.charge.txHash, null);
  check(
    'it carries its timestamps',
    typeof readBody.charge.createdAt === 'string' && typeof readBody.charge.updatedAt === 'string'
  );

  const missing = await get(`/public/charges/${ID_PREFIX}-nothing`);
  checkEq('an unknown id is a 404', missing.statusCode, 404);
  const malformed = await get('/public/charges/NOT_A_CHARGE');
  checkEq('a malformed id is the same 404, never a lookup', malformed.statusCode, 404);

  // -------------------------------------------------------------------------
  // 5. Cancel — recipient-signed, only from pending
  // -------------------------------------------------------------------------
  console.log("\ncancel: the recipient's signature, and only from pending");

  const toCancel = await signedCharge();
  await post('/public/charges', toCancel);

  const unsignedCancel = await post(`/public/charges/${toCancel.id}/cancel`, {});
  checkEq('an unsigned cancel is refused', unsignedCancel.statusCode, 403);
  checkEq('with a code', unsignedCancel.json<{ code?: string }>().code, 'charge-signature-invalid');

  const strangerCancel = await post(`/public/charges/${toCancel.id}/cancel`, {}, await adminHeaders({
    chargeId: toCancel.id,
    action: 'cancel',
    account: STRANGER,
  }));
  checkEq('a stranger cannot cancel it', strangerCancel.statusCode, 403);

  const staleCancel = await post(`/public/charges/${toCancel.id}/cancel`, {}, await adminHeaders({
    chargeId: toCancel.id,
    action: 'cancel',
    issuedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  }));
  checkEq('a stale signature is refused', staleCancel.statusCode, 403);
  checkEq('and says so', staleCancel.json<{ code?: string }>().code, 'charge-admin-stale');

  const cancelled = await post(`/public/charges/${toCancel.id}/cancel`, {}, await adminHeaders({
    chargeId: toCancel.id,
    action: 'cancel',
  }));
  checkEq('the recipient can cancel it', cancelled.statusCode, 200);
  const cancelledBody = cancelled.json<{ charge: Record<string, unknown> }>();
  checkEq('it is no longer payable', cancelledBody.charge.status, 'expired');
  check('and says it was cancelled', typeof cancelledBody.charge.cancelledAt === 'string');

  const twice = await post(`/public/charges/${toCancel.id}/cancel`, {}, await adminHeaders({
    chargeId: toCancel.id,
    action: 'cancel',
  }));
  checkEq('a second cancel is refused', twice.statusCode, 409);
  checkEq('with the state code', twice.json<{ code?: string }>().code, 'charge-not-pending');

  const onCancelled = await matchChargeTransfers({
    transfers: [transferFor({ charge: toCancel, amount: '100.000000' })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  checkEq('a transfer against a cancelled charge decides nothing', onCancelled[0]?.status ?? null, null);

  // -------------------------------------------------------------------------
  // 6. Paid — the classifier decides, exactly one signed webhook
  // -------------------------------------------------------------------------
  console.log('\npaid: one transfer, one status change, one signed webhook');

  const payable = await signedCharge();
  const payableCreate = await post('/public/charges', { ...payable, webhookUrl });
  checkEq('a charge with a webhook endpoint is accepted', payableCreate.statusCode, 201);

  const paidPass = await matchChargeTransfers({
    transfers: [transferFor({ charge: payable, amount: '100.000000' })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  checkEq('the transfer flips it to paid', paidPass[0]?.status ?? null, 'paid');

  // The first delivery is awaited inside the transition; this is slack for the
  // loopback round trip, not a poll.
  await wait(250);

  const paidRow = await prisma.charge.findFirst({ where: { publicId: payable.id } });
  checkEq('the row is paid', paidRow?.status, 'paid');
  checkEq('with what actually arrived', paidRow?.received, '100.000000');
  check('and the transfer that settled it', typeof paidRow?.txHash === 'string');

  // The fee leg, on the row, as its own fact. This transfer was matched with NO
  // fee lookup, so nobody looked at the receipt for a treasury leg and the row says
  // exactly that. What it must NOT say is `paid` with the fee assumed collected —
  // the defect #151 exists to close.
  check(
    'a paid charge with no fee leg read records feeCollected false',
    paidRow?.feeCollected === false,
    String(paidRow?.feeCollected)
  );
  checkEq(
    'and names why, rather than leaving it blank',
    paidRow?.feeUncollectedReason,
    'fee-not-observed'
  );
  checkEq('while the status is still paid: the money moved', paidRow?.status, 'paid');

  const paidDeliveries = deliveriesFor(payable.id);
  checkEq('exactly one webhook was delivered', paidDeliveries.length, 1);
  checkEq('it is the paid event', paidDeliveries[0]?.event, 'charge.paid');
  check('its signature verifies against the bytes received', paidDeliveries[0]?.signatureValid === true);
  check(
    'and it carries a delivery id a receiver can dedupe on',
    typeof paidDeliveries[0]?.headers['x-seti-delivery'] === 'string'
  );

  const paidRaw: unknown = paidDeliveries[0] ? JSON.parse(paidDeliveries[0].body) : null;
  const paidBody = paidRaw as { charge?: { id?: string; amount?: string } } | null;
  checkEq('the body names the charge', paidBody?.charge?.id, payable.id);
  checkEq('with the amount it was for', paidBody?.charge?.amount, '100.000000');

  const replay = await matchChargeTransfers({
    transfers: [transferFor({ charge: payable, amount: '100.000000' })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  await wait(150);

  checkEq('a replayed transfer changes nothing', replay[0]?.status ?? null, null);
  checkEq('and no second webhook is sent', deliveriesFor(payable.id).length, 1);
  checkEq(
    'and there is still exactly one delivery row',
    await prisma.chargeWebhookDelivery.count({ where: { charge: { publicId: payable.id } } }),
    1
  );

  const paidRead = await get(`/public/charges/${payable.id}`);
  const paidReadBody = paidRead.json<{ charge: Record<string, unknown> }>();
  checkEq('a paid charge reads back paid', paidReadBody.charge.status, 'paid');
  checkEq('with the received amount', paidReadBody.charge.received, '100.000000');
  checkEq(
    'and the fee fact is readable beside it, not folded into the status',
    paidReadBody.charge.feeCollected,
    false
  );
  checkEq(
    'with the reason a support tool can search',
    paidReadBody.charge.feeUncollectedReason,
    'fee-not-observed'
  );

  // -------------------------------------------------------------------------
  // 6b. The fee leg, collected — the same reconcile, with a receipt that has it
  // -------------------------------------------------------------------------
  console.log('\nfee leg: the same reconcile, held to the transfer to the treasury');

  const feeCharge = await signedCharge();
  await post('/public/charges', { ...feeCharge });

  // The expectation comes from `fees.ts`, not from a number typed into this suite:
  // 2% of 100.000000 is 2.000000, and if the schedule ever changes this follows it.
  const feeUnits = merchantFeeUnits(parseUnits(feeCharge.amount, 6));
  const feeAmount = feeUnits.ok ? unitsToAmount(feeUnits.units) : '0.000000';
  const treasury = treasuryAddressFor(NETWORK);

  /** The receipt a batch for this charge really carries: the 2% to the treasury. */
  const feeLegs = (amount: string) => async () => [
    { recipient: treasury, asset: PRIMARY_ASSET, amount },
  ];

  const feePass = await matchChargeTransfers({
    transfers: [transferFor({ charge: feeCharge, amount: '100.000000' })],
    network: NETWORK,
    chainId: CHAIN_ID,
    feeLookup: feeLegs(feeAmount),
  });
  checkEq('principal plus a treasury leg is paid', feePass[0]?.status ?? null, 'paid');
  check(
    'and the decision reports the fee collected',
    feePass[0]?.fee?.collected === true,
    String(feePass[0]?.fee?.collected)
  );

  const feeRow = await prisma.charge.findFirst({ where: { publicId: feeCharge.id } });
  checkEq('the row records the fee as collected', feeRow?.feeCollected, true);
  checkEq('with no reason left to give', feeRow?.feeUncollectedReason, null);
  checkEq('and the same status a fee-less payment gets', feeRow?.status, 'paid');
  checkEq('held to the schedule\'s figure (2% of 100.000000)', feeAmount, '2.000000');

  // The boundary that matters, at the row: ONE base unit short of the same ask is
  // uncollected, and the charge is still paid. This is the assertion that would
  // have failed before #151, and it fails by one unit rather than by a percent.
  const shortFeeCharge = await signedCharge();
  await post('/public/charges', { ...shortFeeCharge });

  const oneUnitShort = unitsToAmount((feeUnits.ok ? feeUnits.units : 2_000_000n) - 1n);
  await matchChargeTransfers({
    transfers: [transferFor({ charge: shortFeeCharge, amount: '100.000000' })],
    network: NETWORK,
    chainId: CHAIN_ID,
    feeLookup: feeLegs(oneUnitShort),
  });

  const shortFeeRow = await prisma.charge.findFirst({ where: { publicId: shortFeeCharge.id } });
  checkEq('a fee one base unit short is recorded uncollected', shortFeeRow?.feeCollected, false);
  checkEq('and says the leg was short', shortFeeRow?.feeUncollectedReason, 'fee-short');
  checkEq('while the charge is paid anyway', shortFeeRow?.status, 'paid');

  // In a mode where the fee rides inside the transfer to the RECIPIENT, Seti
  // collects nothing and nothing may say otherwise — proven through the same path.
  const insideCharge = await signedCharge();
  await post('/public/charges', { ...insideCharge });
  await matchChargeTransfers({
    transfers: [transferFor({ charge: insideCharge, amount: '100.000000' })],
    network: NETWORK,
    chainId: CHAIN_ID,
    feeRouting: 'inside-transfer',
    feeLookup: feeLegs(feeAmount),
  });
  const insideRow = await prisma.charge.findFirst({ where: { publicId: insideCharge.id } });
  checkEq('inside-transfer mode is never recorded as collected', insideRow?.feeCollected, false);
  checkEq('and names where the fee went', insideRow?.feeUncollectedReason, 'fee-inside-transfer');
  checkEq('with the charge still paid', insideRow?.status, 'paid');

  // -------------------------------------------------------------------------
  // 7. Underpaid — 2% short is never announced as paid
  // -------------------------------------------------------------------------
  console.log('\nunderpaid: 2% short stays short, and is never webhooked as paid');

  const shortCharge = await signedCharge();
  await post('/public/charges', { ...shortCharge, webhookUrl });

  const under = await matchChargeTransfers({
    transfers: [transferFor({ charge: shortCharge, amount: '98.000000' })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  await wait(250);

  checkEq('2% short is underpaid, not paid', under[0]?.status ?? null, 'underpaid');
  const shortDeliveries = deliveriesFor(shortCharge.id);
  checkEq('one webhook was sent', shortDeliveries.length, 1);
  checkEq('and it is the underpaid event', shortDeliveries[0]?.event, 'charge.underpaid');
  check(
    'nothing in this run announced that charge as paid',
    !received.some((entry) => entry.event === 'charge.paid' && entry.body.includes(shortCharge.id))
  );
  const shortRow = await prisma.charge.findFirst({ where: { publicId: shortCharge.id } });
  checkEq('and the row records what arrived', shortRow?.received, '98.000000');

  // -------------------------------------------------------------------------
  // 8. The classifier's other refusals reach the charge path unchanged
  // -------------------------------------------------------------------------
  console.log('\nclassification: unmatched transfers decide nothing');

  const cases = await signedCharge();
  await post('/public/charges', cases);

  const noMemo = await matchChargeTransfers({
    transfers: [transferFor({ charge: cases, amount: '100.000000', memo: 'unrelated transfer' })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  check(
    'a transfer whose memo does not carry the id is not matched at all',
    noMemo.length === 0,
    `${noMemo.length} decisions`
  );
  checkEq(
    'so the charge stays pending',
    (await prisma.charge.findFirst({ where: { publicId: cases.id } }))?.status,
    'pending'
  );

  const otherPayee = await matchChargeTransfers({
    transfers: [transferFor({ charge: cases, amount: '100.000000', recipient: STRANGER.address })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  check('a transfer to another address is not matched at all', otherPayee.length === 0);

  const otherAsset = await matchChargeTransfers({
    transfers: [transferFor({ charge: cases, amount: '100.000000', asset: 'usdc.e' })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  check('a transfer of another token is not matched at all', otherAsset.length === 0);

  const unconfirmed = await matchChargeTransfers({
    transfers: [transferFor({ charge: cases, amount: '100.000000', confirmed: false })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  checkEq('an unconfirmed transfer decides nothing', unconfirmed[0]?.code, 'receipt-unavailable');
  checkEq(
    'and the charge is still pending',
    (await prisma.charge.findFirst({ where: { publicId: cases.id } }))?.status,
    'pending'
  );

  // -------------------------------------------------------------------------
  // 9. Retries: backoff, and the SAME row
  // -------------------------------------------------------------------------
  console.log('\nwebhooks: a failing receiver is retried on the same row');

  const failing = await signedCharge();
  await post('/public/charges', { ...failing, webhookUrl });

  failNext = 1;
  await matchChargeTransfers({
    transfers: [transferFor({ charge: failing, amount: '100.000000' })],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  await wait(250);

  const afterFailure = await prisma.chargeWebhookDelivery.findFirst({
    where: { charge: { publicId: failing.id } },
  });
  checkEq('the attempt was recorded', afterFailure?.attempts, 1);
  checkEq('as a non-2xx', afterFailure?.lastStatusCode, 500);
  checkEq('and it is waiting, not failed', afterFailure?.state, 'pending');
  check(
    'with a future retry time (the backoff)',
    afterFailure?.nextAttemptAt instanceof Date && afterFailure.nextAttemptAt.getTime() > Date.now(),
    afterFailure?.nextAttemptAt?.toISOString() ?? 'none'
  );

  // Bring the retry forward rather than waiting a minute: the sweep is what runs in
  // production, and what is being proved is that it retries THIS row and not a new one.
  await prisma.chargeWebhookDelivery.update({
    where: { id: afterFailure!.id },
    data: { nextAttemptAt: new Date(Date.now() - 1000) },
  });
  const due = await deliverDueWebhooks(10);
  await wait(150);

  const afterRetry = await prisma.chargeWebhookDelivery.findUnique({
    where: { id: afterFailure!.id },
  });
  check('the sweep retried it', due.attempted >= 1, `${due.attempted} attempted`);
  checkEq('the same row is now delivered', afterRetry?.state, 'delivered');
  checkEq('after two attempts', afterRetry?.attempts, 2);
  checkEq(
    'and no extra row exists for the same status change',
    await prisma.chargeWebhookDelivery.count({ where: { charge: { publicId: failing.id } } }),
    1
  );

  // -------------------------------------------------------------------------
  // 10. The delivery log, and who may read it
  // -------------------------------------------------------------------------
  console.log("\ndelivery log: the recipient's, not the internet's");

  const noAuthLog = await get(`/public/charges/${payable.id}/deliveries`);
  checkEq('an unsigned read of the log is refused', noAuthLog.statusCode, 403);

  const strangerLog = await get(
    `/public/charges/${payable.id}/deliveries`,
    await adminHeaders({ chargeId: payable.id, action: 'deliveries', account: STRANGER })
  );
  checkEq('a stranger cannot read it', strangerLog.statusCode, 403);

  const log = await get(
    `/public/charges/${payable.id}/deliveries`,
    await adminHeaders({ chargeId: payable.id, action: 'deliveries' })
  );
  checkEq('the recipient can read it', log.statusCode, 200);
  const logRows = log.json<{ deliveries: Array<Record<string, unknown>> }>().deliveries;
  checkEq('with one row for the one status change', logRows.length, 1);
  checkEq('saying it was delivered', logRows[0]?.state, 'delivered');
  check(
    'and never leaking the signing secret',
    !JSON.stringify(logRows).includes(env.SETI_WEBHOOK_SECRET ?? 'no-secret-set')
  );

  // -------------------------------------------------------------------------
  // 11. Expiry — a lapsed charge is inert and announced once
  // -------------------------------------------------------------------------
  console.log('\nexpiry: a lapsed charge ends by itself');

  const lapsed = await signedCharge({ expiresInMs: 1200 });
  await post('/public/charges', { ...lapsed, webhookUrl });
  await wait(1300);

  const lapsedRead = await get(`/public/charges/${lapsed.id}`);
  checkEq(
    'a read past the deadline reports it expired',
    lapsedRead.json<{ charge: Record<string, unknown> }>().charge.status,
    'expired'
  );
  await wait(200);
  checkEq(
    'and exactly one expiry webhook was sent',
    received.filter((entry) => entry.body.includes(lapsed.id) && entry.event === 'charge.expired')
      .length,
    1
  );
  const lapsedAgain = await get(`/public/charges/${lapsed.id}`);
  await wait(150);
  checkEq(
    'a second read does not send a second one',
    deliveriesFor(lapsed.id).length,
    1
  );
  checkEq(
    'and it stays expired',
    lapsedAgain.json<{ charge: Record<string, unknown> }>().charge.status,
    'expired'
  );

  // -------------------------------------------------------------------------
  // 12. Rate limits
  // -------------------------------------------------------------------------
  console.log('\nrate limits: tight for a script, generous for a merchant');

  const floodIp = '203.0.113.7';
  const statuses: number[] = [];
  for (let index = 0; index < 21; index += 1) {
    const response = await post('/public/charges', await signedCharge(), {}, floodIp);
    statuses.push(response.statusCode);
  }

  checkEq('the 21st create in a minute from one source is a 429', statuses[20], 429);
  check(
    'and the ones before it were not',
    statuses.slice(0, 20).every((code) => code !== 429),
    statuses.join(',')
  );

  const floodResponse = await post('/public/charges', await signedCharge(), {}, floodIp);
  checkEq('with a code a client switches on', floodResponse.json<{ code?: string }>().code, 'rate-limited');
  check(
    'and a sentence naming the budget',
    /per source/.test(String(floodResponse.json<{ error?: string }>().error ?? '')),
    floodResponse.json<{ error?: string }>().error
  );

  // -------------------------------------------------------------------------
  // Cleanup, and the proof nothing else was touched
  // -------------------------------------------------------------------------
  await app.close();
  await new Promise<void>((resolve) => receiver.close(() => resolve()));

  const deleted = await prisma.charge.deleteMany({ where: { publicId: { startsWith: ID_PREFIX } } });
  check('the fixture charges were cleaned up', deleted.count > 0, `${deleted.count} removed`);
  checkEq(
    'and nothing of this run is left',
    await prisma.charge.count({ where: { publicId: { startsWith: ID_PREFIX } } }),
    0
  );
  checkEq(
    'deliveries went with them',
    await prisma.chargeWebhookDelivery.count({
      where: { charge: { publicId: { startsWith: ID_PREFIX } } },
    }),
    0
  );
  checkEq(
    'and no real charge was touched',
    await prisma.charge.count({ where: { NOT: { publicId: { startsWith: 'chk' } } } }),
    realChargesBefore
  );

  await prisma.$disconnect();
  console.log(`\n${asserts} assertions — ${failures === 0 ? 'all passed.' : `${failures} FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('charge API check crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
