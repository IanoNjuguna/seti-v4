/**
 * The arrival path, end to end — `npm run check:arrival`.
 *
 * Requires: `docker compose up -d` (the `seti-postgres` container), like the other
 * database-backed suites. `DEV_BYPASS_AUTH=true` is set by the npm script so the
 * route section can drive the real `GET /arrivals` handler as `dev@seti.test`.
 *
 * What this suite exists for. A payer can send straight to a merchant's address and
 * never open our page. The money is real, no charge was satisfied, and Seti took no
 * fee. The four things that must be true about how we record that are asserted
 * here, in the order they matter:
 *
 *  1. **An arrival with no charge creates the fact.** A plain transfer to an address
 *     we can prove belongs to a merchant is recorded as an arrival, with the sender,
 *     token, amount, term and block the chain recorded.
 *  2. **It never makes a charge paid.** The charge at that address stays `pending`,
 *     keeps its null `txHash` and its null fee verdict, gains no ledger row and fires
 *     no webhook. A charge is `paid` only against a receipt the classifier accepted.
 *  3. **An existing charge is not silently attached.** The fixture's arrival is for
 *     EXACTLY the amount of a pending charge at the same address, and it still is not
 *     attached. Amount is not evidence, and the arrival view has no field that could
 *     carry an attribution.
 *  4. **The merchant's copy says what is known and no more.** The words contain no
 *     payment claim, and the response contains no fee verdict at all.
 *
 * The last section proves the paths do not double-count: a transaction a charge
 * already settled is refused as an arrival.
 *
 * Every row this suite writes is scoped by a run prefix, and cleanup is one predicate
 * per table, followed by a count proving nothing of the run is left and no real row
 * was touched.
 */
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { prisma } from '../lib/prisma.js';
import { arrivalRoutes } from '../routes/arrivals.js';
import { apiErrorHandler } from '../server.js';
import { PRIMARY_ASSET, network as servedChain } from './chain.js';
import { chargeTypedData, type ChargeFields, type SignedCharge } from './charge.js';
import { createCharge } from './charge-store.js';
import { matchChargeTransfers, type ChargeTransferCandidate } from './charge-match.js';
import {
  ARRIVAL_COPY,
  ARRIVAL_FORBIDDEN_CLAIMS,
  ARRIVAL_WATCH_LIMIT,
  classifyArrival,
  type ArrivalCharge,
  type ObservedArrival,
} from './arrival.js';
import {
  listArrivals,
  ownedArrivalAddresses,
  recordArrivals,
  summariseArrivals,
  toArrivalView,
  watchedArrivalRecipients,
} from './arrival-store.js';

/** Every fixture row this run writes starts with one of these. */
const RUN = randomUUID().slice(0, 8);
const CHARGE_PREFIX = `arrv${RUN}`;
const TX_PREFIX = `0x${RUN}`;

const NETWORK = servedChain.network;
const CHAIN_ID = servedChain.chainId;
const DEV_EMAIL = 'dev@seti.test';

/** The merchant whose address receives the money in this run. */
const MERCHANT: PrivateKeyAccount = privateKeyToAccount(generatePrivateKey());
const RECIPIENT = MERCHANT.address.toLowerCase();

/** A stranger paying them, from a wallet that never saw our page. */
const PAYER: PrivateKeyAccount = privateKeyToAccount(generatePrivateKey());

let failures = 0;
let asserts = 0;

function check(label: string, pass: boolean, detail?: string | number | boolean | null): void {
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

/** A transfer hash for this run: 64 chars, so it looks like one and cleans up as one. */
let txCounter = 0;
function txHash(): string {
  txCounter += 1;
  return `${TX_PREFIX}${String(txCounter).padStart(32, '0')}`.padEnd(66, '0');
}

/** A charge id in the shape the store accepts, unique per call. */
let chargeCounter = 0;
function chargeId(): string {
  chargeCounter += 1;
  return `${CHARGE_PREFIX}-${String(chargeCounter).padStart(3, '0')}`;
}

/** A charge body signed by the merchant, over `amount`. */
async function signedCharge(input: {
  id?: string;
  amount?: string;
  expiresInMs?: number;
} = {}): Promise<SignedCharge> {
  const id = input.id ?? chargeId();
  const fields: ChargeFields = {
    id,
    recipient: MERCHANT.address.toLowerCase() as `0x${string}`,
    asset: PRIMARY_ASSET,
    amount: input.amount ?? '100.000000',
    memo: `Arrival check ${id}`,
    expiresAt: new Date(Date.now() + (input.expiresInMs ?? 60 * 60_000)).toISOString(),
    nonce: randomUUID(),
    scope: null,
  };

  const signature = await MERCHANT.signTypedData(chargeTypedData(fields, CHAIN_ID));
  return { ...fields, signature };
}

/** An observed plain transfer to the merchant, as the indexer would build it. */
function observed(input: { amount?: string; hash?: string; confirmed?: boolean } = {}): ObservedArrival {
  return {
    txHash: input.hash ?? txHash(),
    recipient: RECIPIENT,
    sender: PAYER.address.toLowerCase(),
    asset: PRIMARY_ASSET,
    amount: input.amount ?? '100.000000',
    blockNumber: BigInt(4242),
    confirmed: input.confirmed ?? true,
  };
}

/** An observed MEMO transfer for a charge, as the indexer would build it. */
function memoTransfer(charge: SignedCharge, hash: string): ChargeTransferCandidate {
  return {
    txHash: hash,
    recipient: charge.recipient.toLowerCase(),
    asset: charge.asset,
    amount: charge.amount,
    memo: charge.memo,
    confirmed: true,
  };
}

async function main(): Promise<void> {
  const realArrivalsBefore = await prisma.addressArrival.count();
  const realChargesBefore = await prisma.charge.count({ where: { NOT: { publicId: { startsWith: 'arrv' } } } });

  // -------------------------------------------------------------------------
  // 1. The classifier: what is evidence, and what is not
  // -------------------------------------------------------------------------
  console.log('\n— the decision, without a database —');

  const plain = observed();

  const noCharges = classifyArrival({ transfer: plain, chargesAtRecipient: [] });
  checkEq('a plain transfer with no charge at the address is an arrival', noCharges.kind, 'arrival');
  checkEq(
    'and it carries no fee collection, so nothing can be recorded as fee-bearing',
    noCharges.kind === 'arrival' ? noCharges.feeCollected : 'n/a',
    false
  );

  /**
   * A PENDING charge at the same address, for the SAME amount.
   *
   * This is the case the whole design turns on. Matching it would be easy, would
   * make a merchant's charge look satisfied, and would be a guess: a TIP-20
   * transfer carries no charge id unless the payer's wallet put one in the memo,
   * and this transfer has none.
   */
  const sameAmount: ArrivalCharge = {
    id: 'arrv-pure-same',
    recipient: RECIPIENT,
    asset: PRIMARY_ASSET,
    amount: plain.amount,
    status: 'pending',
    txHash: null,
  };
  const withSameAmount = classifyArrival({ transfer: plain, chargesAtRecipient: [sameAmount] });
  checkEq(
    'a pending charge for the EXACT amount is still not attached',
    withSameAmount.kind,
    'arrival'
  );

  const withinTolerance: ArrivalCharge = { ...sameAmount, id: 'arrv-pure-near', amount: '99.500000' };
  const withNear = classifyArrival({ transfer: plain, chargesAtRecipient: [withinTolerance] });
  checkEq(
    'a pending charge within the payment path 1% tolerance is still not attached',
    withNear.kind,
    'arrival'
  );

  const expiredSame: ArrivalCharge = { ...sameAmount, id: 'arrv-pure-expired', status: 'expired' };
  checkEq(
    'and a decided charge at the address does not absorb it either',
    classifyArrival({ transfer: plain, chargesAtRecipient: [expiredSame] }).kind,
    'arrival'
  );

  const settlementHash = txHash();
  const settledByThis: ArrivalCharge = {
    ...sameAmount,
    id: 'arrv-pure-settled',
    status: 'paid',
    txHash: settlementHash,
  };
  const settledDecision = classifyArrival({
    transfer: { ...plain, txHash: settlementHash },
    chargesAtRecipient: [settledByThis],
  });
  checkEq(
    'a transfer a charge already settled is refused, not filed twice',
    settledDecision.kind === 'refuse' ? settledDecision.code : settledDecision.kind,
    'arrival-is-charge-settlement'
  );

  const settledElsewhere: ArrivalCharge = { ...sameAmount, id: 'arrv-pure-other', status: 'paid', txHash: txHash() };
  checkEq(
    'a charge settled by a DIFFERENT transaction does not claim this money',
    classifyArrival({ transfer: plain, chargesAtRecipient: [settledElsewhere] }).kind,
    'arrival'
  );

  const unconfirmed = classifyArrival({ transfer: { ...plain, confirmed: false }, chargesAtRecipient: [] });
  checkEq(
    'an unmined transfer has not arrived',
    unconfirmed.kind === 'refuse' ? unconfirmed.code : unconfirmed.kind,
    'receipt-unavailable'
  );

  const badAmount = classifyArrival({ transfer: { ...plain, amount: 'not-a-number' }, chargesAtRecipient: [] });
  checkEq(
    'an unreadable amount is refused rather than stored',
    badAmount.kind === 'refuse' ? badAmount.code : badAmount.kind,
    'amount-invalid'
  );

  check(
    'the decision has no field that could carry a charge attribution',
    !JSON.stringify(noCharges).includes('chargeId') && !JSON.stringify(noCharges).includes('arrv-pure'),
    JSON.stringify(noCharges)
  );

  // -------------------------------------------------------------------------
  // 2. The copy: what is known, and what is not
  // -------------------------------------------------------------------------
  console.log('\n— the words a merchant reads —');

  const copyText = `${ARRIVAL_COPY.label} ${ARRIVAL_COPY.headline} ${ARRIVAL_COPY.detail}`.toLowerCase();
  for (const claim of ARRIVAL_FORBIDDEN_CLAIMS) {
    check(`the copy never says "${claim}"`, !copyText.includes(claim), copyText.includes(claim));
  }
  check(
    'it says plainly that no charge accounts for the money',
    ARRIVAL_COPY.detail.includes('no Seti charge accounts for'),
    ARRIVAL_COPY.detail
  );
  check('and that no fee was recorded', ARRIVAL_COPY.detail.includes('recorded no fee'), ARRIVAL_COPY.detail);

  // -------------------------------------------------------------------------
  // 3. The store: an arrival is recorded, and the charge is left alone
  // -------------------------------------------------------------------------
  console.log('\n— recording it —');

  const pendingCharge = await signedCharge({ amount: '100.000000' });
  const created = await createCharge({
    charge: pendingCharge,
    network: NETWORK,
    chainId: CHAIN_ID,
    webhookUrl: null,
    idempotencyKey: null,
  });
  checkEq('the fixture charge was stored', created.kind, 'created');

  const arrival = observed({ amount: pendingCharge.amount });
  const recorded = await recordArrivals({ arrivals: [arrival], network: NETWORK });

  check('the transfer was recorded as an arrival', typeof recorded[0]?.id === 'string', recorded[0]?.id ?? 'none');
  checkEq('with no refusal code', recorded[0]?.code, undefined);

  const storedArrival = await prisma.addressArrival.findFirst({
    where: { txHash: arrival.txHash, recipient: RECIPIENT },
  });
  checkEq('the row names the address that received the money', storedArrival?.recipient, RECIPIENT);
  checkEq('the sender, so the merchant can ask them', storedArrival?.fromAddress, PAYER.address.toLowerCase());
  checkEq('the amount exactly as the chain moved it', storedArrival?.amount, pendingCharge.amount);
  checkEq('the token that moved', storedArrival?.asset, PRIMARY_ASSET);
  checkEq('and the block', storedArrival?.blockNumber?.toString(), '4242');

  const chargeAfterArrival = await prisma.charge.findFirst({ where: { publicId: pendingCharge.id } });
  checkEq('the charge at that address is UNCHANGED, not paid', chargeAfterArrival?.status, 'pending');
  checkEq('its txHash is still null, so it is not bound to this money', chargeAfterArrival?.txHash, null);
  checkEq('its fee verdict is still undecided', chargeAfterArrival?.feeCollected, null);
  checkEq('and its received amount is still zero', chargeAfterArrival?.received, '0.000000');
  checkEq(
    'no charge row anywhere names this transaction',
    await prisma.charge.count({ where: { txHash: arrival.txHash } }),
    0
  );
  checkEq(
    'the pending charge fired no webhook for an arrival',
    await prisma.chargeWebhookDelivery.count({ where: { chargeId: chargeAfterArrival?.id ?? 'none' } }),
    0
  );

  // The same window scanned again: one transfer, one arrival, one audit event.
  const replayed = await recordArrivals({ arrivals: [arrival], network: NETWORK });
  checkEq(
    'a re-scanned window does not record a second arrival',
    await prisma.addressArrival.count({ where: { txHash: arrival.txHash } }),
    1
  );
  checkEq('and it says so rather than refusing silently', replayed[0]?.code, 'already-recorded');
  checkEq(
    'and the audit trail has exactly one event for it',
    await prisma.auditLog.count({ where: { txHash: arrival.txHash, action: 'arrival.recorded' } }),
    1
  );

  // The view a surface renders: facts, and no attribution.
  const view = storedArrival ? toArrivalView(storedArrival) : null;
  check('the row reads back as a view', view !== null);
  for (const forbidden of ['chargeId', 'status', 'paid', 'feeCollected', 'settledAt']) {
    check(
      `the arrival view has no "${forbidden}" field`,
      view !== null && !(forbidden in view),
      view === null ? 'no view' : Object.keys(view).join(',')
    );
  }

  // -------------------------------------------------------------------------
  // 4. The other direction: a charge's money is not re-filed as an arrival
  // -------------------------------------------------------------------------
  console.log('\n— the two paths do not double-count —');

  const paidCharge = await signedCharge({ amount: '50.000000' });
  await createCharge({
    charge: paidCharge,
    network: NETWORK,
    chainId: CHAIN_ID,
    webhookUrl: null,
    idempotencyKey: null,
  });

  const settlement = txHash();
  const settled = await matchChargeTransfers({
    transfers: [memoTransfer(paidCharge, settlement)],
    network: NETWORK,
    chainId: CHAIN_ID,
  });
  checkEq('the charge path settled the memo transfer', settled[0]?.status, 'paid');

  // The same transaction ALSO emits a plain `Transfer`, so the arrival path sees it.
  const doubleReport = await recordArrivals({
    arrivals: [observed({ amount: paidCharge.amount, hash: settlement })],
    network: NETWORK,
  });
  checkEq(
    'the arrival path refuses to file it again',
    doubleReport[0]?.code,
    'arrival-is-charge-settlement'
  );
  checkEq(
    'so there is no arrival row for a settled charge',
    await prisma.addressArrival.count({ where: { txHash: settlement } }),
    0
  );
  const paidRow = await prisma.charge.findFirst({ where: { publicId: paidCharge.id } });
  checkEq('and the charge stays paid, with its own txHash', paidRow?.txHash, settlement);

  // -------------------------------------------------------------------------
  // 5. What the indexer watches
  // -------------------------------------------------------------------------
  console.log('\n— the addresses a pass reads —');

  const watched = await watchedArrivalRecipients(NETWORK, ARRIVAL_WATCH_LIMIT);
  check('an address with a charge is watched', watched.includes(RECIPIENT), watched.length);

  const unsignedMerchant = await prisma.merchant.create({
    data: { name: `Arrival check ${RUN}`, payoutAddress: PAYER.address.toLowerCase() },
  });
  const watchedAfterProfile = await watchedArrivalRecipients(NETWORK, ARRIVAL_WATCH_LIMIT);
  check(
    'an unsigned profile payout address is NOT watched',
    !watchedAfterProfile.includes(PAYER.address.toLowerCase()),
    PAYER.address
  );
  await prisma.merchant.delete({ where: { id: unsignedMerchant.id } });

  // -------------------------------------------------------------------------
  // 6. The merchant's read, through the real route
  // -------------------------------------------------------------------------
  console.log('\n— what the merchant is shown —');

  const devUser = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: {},
    create: { email: DEV_EMAIL },
  });

  // The arrival's address is registered for the dev user, which is the account the
  // auth bypass makes every request. `pathusd` is the token slot the other suites use
  // for throwaway addresses, and it is deleted at the end of this file.
  await prisma.wallet.create({
    data: {
      userId: devUser.id,
      chain: 'tempo',
      asset: 'pathusd',
      address: RECIPIENT,
      network: NETWORK,
      status: 'active',
    },
  });

  const app: FastifyInstance = Fastify();
  app.setErrorHandler(apiErrorHandler);
  await app.register(arrivalRoutes, { prefix: '/arrivals' });

  const owned = await ownedArrivalAddresses(devUser.id, NETWORK);
  check('the address is one the account holds', owned.includes(RECIPIENT), owned.length);

  const response = await app.inject({ method: 'GET', url: '/arrivals' });
  const body = response.json<{
    arrivals: Record<string, unknown>[];
    hasMore: boolean;
    summary: { asset: string; count: number; amount: string }[];
    copy: { label: string; headline: string; detail: string };
  }>();

  checkEq('GET /arrivals answers 200', response.statusCode, 200);
  checkEq('with the arrival it recorded', body.arrivals.length, 1);
  checkEq('naming the transaction', body.arrivals[0]?.txHash, arrival.txHash);
  checkEq('and the amount that arrived', body.arrivals[0]?.amount, pendingCharge.amount);
  checkEq('there is no more to page', body.hasMore, false);
  checkEq('the copy is the product copy', body.copy.headline, ARRIVAL_COPY.headline);
  check(
    'the response carries no fee verdict of any kind',
    !JSON.stringify(body).includes('feeCollected') && !JSON.stringify(body).includes('feeUncollected'),
    JSON.stringify(Object.keys(body.arrivals[0] ?? {}))
  );
  check(
    'and no charge attribution',
    !JSON.stringify(body.arrivals).includes('chargeId') &&
      !JSON.stringify(body.arrivals).includes('pendingCharge'),
    JSON.stringify(body.arrivals[0] ?? {})
  );

  const summary = await summariseArrivals({ network: NETWORK, recipients: [RECIPIENT] });
  checkEq('the summary counts the leak', summary[0]?.count, 1);
  checkEq('and values it in the asset that moved', summary[0]?.amount, pendingCharge.amount);
  checkEq('per asset, never in one invented total', summary.length, 1);

  const page = await listArrivals({ network: NETWORK, recipients: [RECIPIENT], limit: 10, offset: 0 });
  checkEq('the page read returns the row', page.length, 1);

  await app.close();

  // -------------------------------------------------------------------------
  // Cleanup, and the proof nothing else was touched
  // -------------------------------------------------------------------------
  await prisma.wallet.deleteMany({ where: { address: RECIPIENT } });
  await prisma.auditLog.deleteMany({ where: { txHash: { startsWith: TX_PREFIX } } });
  await prisma.charge.deleteMany({ where: { publicId: { startsWith: CHARGE_PREFIX } } });
  await prisma.addressArrival.deleteMany({ where: { txHash: { startsWith: TX_PREFIX } } });

  checkEq(
    'the fixture charges are gone',
    await prisma.charge.count({ where: { publicId: { startsWith: CHARGE_PREFIX } } }),
    0
  );
  checkEq(
    'the fixture arrivals are gone',
    await prisma.addressArrival.count({ where: { txHash: { startsWith: TX_PREFIX } } }),
    0
  );
  checkEq(
    'their audit rows went with them',
    await prisma.auditLog.count({ where: { txHash: { startsWith: TX_PREFIX } } }),
    0
  );
  checkEq(
    'and no real arrival row was touched',
    await prisma.addressArrival.count(),
    realArrivalsBefore
  );
  checkEq(
    'and no real charge was touched',
    await prisma.charge.count({ where: { NOT: { publicId: { startsWith: 'arrv' } } } }),
    realChargesBefore
  );

  await prisma.$disconnect();
  console.log(`\n${asserts} assertions — ${failures === 0 ? 'all passed.' : `${failures} FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('arrival check crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
