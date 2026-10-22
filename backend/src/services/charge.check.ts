/**
 * Prove the CHARGE contract — `npm run check:charge`.
 *
 * A charge is a signed request for a stranger on the internet to be paid, and
 * three surfaces (hosted page, public API, MCP tool) will render the same object.
 * The failure this suite exists to prevent is two of them disagreeing about what
 * was signed or about when a charge is paid. So every assertion here is about the
 * CONTRACT, not about an implementation detail:
 *
 *  1. **What is signed.** The signed field set is exactly the seven fields the
 *     issue names, in the documented order, with `scope` absent — asserted against
 *     the EIP-712 types, against the emitted payload, and against the digest.
 *  2. **The signature is the integrity story.** A charge signed by A verifies with
 *     A and with nobody else, and editing ANY signed field invalidates it — one
 *     assertion per field, because "editing a field invalidates it" is seven
 *     claims, not one.
 *  3. **The statuses.** `pending → paid | underpaid | overpaid | expired`, and
 *     nothing leaves a terminal state, asserted over the whole cross product.
 *  4. **The classifier at the boundary.** Exactly 1% under is paid, 1.01% under is
 *     underpaid, exactly 1% over is paid, 1.01% over is overpaid, and every refusal
 *     names a code from the existing taxonomy rather than prose.
 *
 * No database, no chain, no user: `services/charge.ts` is pure, so this suite runs
 * with no `docker compose up`. Signatures are REAL signatures from deterministic
 * dev keys, never fabricated hex — a check that asserts on a made-up signature
 * proves nothing about whether a wallet can sign anything.
 */
import { hashTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { TEMPO_MAINNET_CHAIN_ID, TEMPO_TESTNET_CHAIN_ID } from '../config/assets.js';
import {
  CHARGE_SIGNED_FIELDS,
  CHARGE_SPEC_VERSION,
  CHARGE_STATUSES,
  CHARGE_STATUS_COPY,
  CHARGE_TYPES,
  CHARGE_PRIMARY_TYPE,
  canTransition,
  chargeDigest,
  chargeDomain,
  chargeIsExpired,
  chargeSigningPayload,
  chargeStatusCopy,
  chargeTypedData,
  chargeVerifies,
  classifyCharge,
  defaultChargeExpiry,
  isTerminal,
  nextChargeStatus,
  recoverChargeSigner,
  type Charge,
  type ChargeDecision,
  type ChargeFields,
  type ChargeStatus,
  type ObservedTransfer,
} from './charge.js';

const TESTNET = TEMPO_TESTNET_CHAIN_ID;
const MAINNET = TEMPO_MAINNET_CHAIN_ID;

/**
 * Two deterministic dev keys (the well-known Anvil accounts #1 and #2). A signs the
 * charges; B tries to pass as A. No funds, no network: `signTypedData` is local.
 */
const PAYEE = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
);
const STRANGER = privateKeyToAccount(
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
);

const NOW = new Date('2026-10-22T12:00:00.000Z');

let failures = 0;
let asserts = 0;

function check(label: string, pass: boolean, detail?: string | number | bigint) {
  asserts += 1;
  if (!pass) failures += 1;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

/** Equality by value, so a failed assertion prints both sides. */
function checkEq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(label, a === e, a === e ? undefined : `got ${a}, expected ${e}`);
}

/** The unsigned, unmoved charge body every fixture starts from. */
const BASE: ChargeFields = {
  id: 'chg_01JHX9CHARGEFIXTURE',
  recipient: PAYEE.address,
  asset: 'ousd',
  amount: '100.000000',
  memo: 'Seti charge chg_01JHX9CHARGEFIXTURE',
  expiresAt: '2026-10-23T00:00:00.000Z',
  nonce: 'nonce-5b1f2c',
  scope: null,
};

/** A pending charge over `body`, signed by `signer` (the payee by default). */
async function signed(
  body: ChargeFields = BASE,
  signer = PAYEE,
  chainId: number = TESTNET
): Promise<Charge> {
  return {
    ...body,
    signature: await signer.signTypedData(chargeTypedData(body, chainId)),
    status: 'pending',
    txHash: null,
  };
}

/** What the chain says arrived, matching `BASE` exactly unless overridden. */
function transfer(over: Partial<ObservedTransfer> = {}): ObservedTransfer {
  return {
    txHash: `0x${'a'.repeat(64)}`,
    recipient: PAYEE.address,
    asset: 'ousd',
    amount: BASE.amount,
    memo: `Seti charge ${BASE.id}`,
    confirmed: true,
    ...over,
  };
}

/** Classify, for the readable call sites below. */
function classify(
  charge: Charge,
  over: Partial<ObservedTransfer> = {},
  now: Date = NOW,
  chainId: number = TESTNET
): Promise<ChargeDecision> {
  return classifyCharge({ charge, transfer: transfer(over), chainId, now });
}

/** The refusal code, or a loud marker when the decision was not a refusal. */
function refusalCode(decision: ChargeDecision): string {
  return decision.ok ? 'not-refused' : decision.code;
}

/** The status, or a loud marker when the decision was a refusal. */
function statusOf(decision: ChargeDecision): string {
  return decision.ok ? decision.status : `refused:${decision.code}`;
}

const seenRefusals = new Set<string>();

async function main(): Promise<void> {
  console.log(`charge spec v${CHARGE_SPEC_VERSION} — chains ${MAINNET} (live), ${TESTNET} (practice)`);
  console.log(`payee    ${PAYEE.address}`);
  console.log(`stranger ${STRANGER.address}`);

  // -------------------------------------------------------------------------
  // 1. What is signed
  // -------------------------------------------------------------------------
  console.log('\nwhat is signed\n');

  const payload = chargeSigningPayload(BASE);

  checkEq(
    'the payload carries exactly the seven signed fields, in the documented order',
    Object.keys(payload),
    [...CHARGE_SIGNED_FIELDS]
  );

  checkEq(
    'the EIP-712 struct declares exactly the same seven fields',
    CHARGE_TYPES[CHARGE_PRIMARY_TYPE].map((field) => field.name),
    [...CHARGE_SIGNED_FIELDS]
  );

  checkEq(
    'the declared types are the documented ones',
    CHARGE_TYPES[CHARGE_PRIMARY_TYPE].map((field) => `${field.name}:${field.type}`),
    [
      'recipient:address',
      'asset:string',
      'amount:string',
      'memo:string',
      'id:string',
      'expiresAt:string',
      'nonce:string',
    ]
  );

  for (const absent of ['scope', 'signature', 'status', 'txHash']) {
    check(`'${absent}' is not in the signed payload`, !Object.keys(payload).includes(absent));
  }

  // A charge that HAS a scope still signs only the seven: this is the assertion
  // that keeps `scope` reserved-and-unsigned as v1 decided.
  const scoped: ChargeFields = { ...BASE, scope: 'https://shop.example/checkout' };
  checkEq(
    'a charge carrying a scope signs the same seven fields (scope stays unsigned)',
    Object.keys(chargeSigningPayload(scoped)),
    [...CHARGE_SIGNED_FIELDS]
  );
  checkEq(
    'the scope does not enter the digest',
    chargeDigest(scoped, TESTNET),
    chargeDigest(BASE, TESTNET)
  );

  // EIP-712 hashes fields by NAME, so the ORDER of the message object is not what
  // pins the contract — the SET is. Proving it is what lets the doc promise a
  // canonical order for display while a second implementation that inserts keys in
  // another order still produces the same signature.
  const reversed = Object.fromEntries(Object.entries(payload).reverse()) as unknown as typeof payload;
  checkEq(
    'reordering the payload object does not change the digest (EIP-712 sorts by name)',
    hashTypedData({
      domain: chargeDomain(TESTNET),
      types: CHARGE_TYPES,
      primaryType: CHARGE_PRIMARY_TYPE,
      message: reversed,
    }),
    chargeDigest(BASE, TESTNET)
  );

  // And the other half of that: a field present in the MESSAGE but absent from the
  // TYPES is not signed at all. So the types array IS the contract, and asserting
  // it above is why this fact is safe to rely on.
  const withExtra = { ...payload, scope: 'https://evil.example/' } as typeof payload;
  checkEq(
    'an extra message field outside the types is not signed',
    hashTypedData({
      domain: chargeDomain(TESTNET),
      types: CHARGE_TYPES,
      primaryType: CHARGE_PRIMARY_TYPE,
      message: withExtra,
    }),
    chargeDigest(BASE, TESTNET)
  );

  // -------------------------------------------------------------------------
  // 2. The signature
  // -------------------------------------------------------------------------
  console.log('\nthe signature\n');

  const good = await signed();
  const signer = await recoverChargeSigner(good, TESTNET);

  check('a charge signed by the payee verifies', await chargeVerifies(good, TESTNET));
  check(
    'the recovered signer is the payee',
    signer?.toLowerCase() === PAYEE.address.toLowerCase(),
    signer ?? 'unreadable'
  );

  // Signed by A, claiming B as recipient: the amount was not signed by the payee.
  const signedForSomeoneElse = await signed({ ...BASE, recipient: STRANGER.address }, PAYEE);
  check(
    'a charge signed by A but claiming B as recipient does not verify',
    !(await chargeVerifies(signedForSomeoneElse, TESTNET))
  );

  // Recipient B, signed by B: verifies — the KEY decides, not the address on a page.
  const signedByOwner = await signed({ ...BASE, recipient: STRANGER.address }, STRANGER);
  check(
    'a charge signed by the wallet that IS the recipient verifies',
    await chargeVerifies(signedByOwner, TESTNET)
  );

  // One assertion per signed field: editing it must invalidate the signature.
  const tamperings: Array<{ field: string; edit: Partial<ChargeFields> }> = [
    { field: 'recipient', edit: { recipient: STRANGER.address } },
    { field: 'asset', edit: { asset: 'pathusd' } },
    { field: 'amount', edit: { amount: '0.500000' } },
    { field: 'memo', edit: { memo: `${BASE.memo} (edited)` } },
    { field: 'id', edit: { id: 'chg_EDITEDINFLIGHT' } },
    { field: 'expiresAt', edit: { expiresAt: '2030-01-01T00:00:00.000Z' } },
    { field: 'nonce', edit: { nonce: 'nonce-EDITED' } },
  ];

  for (const { field, edit } of tamperings) {
    const edited: Charge = { ...good, ...edit };
    check(`editing ${field} invalidates the signature`, !(await chargeVerifies(edited, TESTNET)));
  }

  checkEq(
    'the tampered set covers every signed field, and nothing else',
    tamperings.map((t) => t.field),
    [...CHARGE_SIGNED_FIELDS]
  );

  // The other direction, stated so nobody "fixes" it by signing these: the unsigned
  // fields are unsigned ON PURPOSE. A scope never moved money; a status and a
  // txHash are what a charge is FOR.
  const progressed: Charge = { ...good, status: 'paid', txHash: `0x${'b'.repeat(64)}` };
  check("a charge's status and txHash are not signed", await chargeVerifies(progressed, TESTNET));
  const scopeEdited: Charge = { ...good, scope: 'https://elsewhere.example/' };
  check("a charge's scope is not signed (v1 decision)", await chargeVerifies(scopeEdited, TESTNET));

  // Domain separation: the chain id is part of what was signed.
  check('a practice-chain signature does not verify on live', !(await chargeVerifies(good, MAINNET)));
  check(
    'the same charge has a different digest on each chain',
    chargeDigest(BASE, TESTNET) !== chargeDigest(BASE, MAINNET)
  );

  // A malformed signature is not a verified charge, and it does not throw.
  check(
    'an unreadable signature does not verify',
    !(await chargeVerifies({ ...good, signature: '0xdeadbeef' }, TESTNET))
  );

  // -------------------------------------------------------------------------
  // 3. Transitions
  // -------------------------------------------------------------------------
  console.log('\ntransitions\n');

  for (const to of CHARGE_STATUSES) {
    if (to === 'pending') continue;
    check(`pending -> ${to} is legal`, canTransition('pending', to));
  }

  check('pending -> pending is not a transition', !canTransition('pending', 'pending'));

  checkEq(
    'the terminal states are exactly paid, underpaid, overpaid and expired',
    CHARGE_STATUSES.filter(isTerminal),
    ['paid', 'underpaid', 'overpaid', 'expired']
  );

  // Nothing leaves a terminal state: the full cross product, not a sample.
  let illegalEdges = 0;
  for (const from of CHARGE_STATUSES.filter(isTerminal)) {
    for (const to of CHARGE_STATUSES) {
      if (canTransition(from, to)) illegalEdges += 1;
    }
  }
  check(
    'nothing leaves a terminal state (16 pairs checked)',
    illegalEdges === 0,
    `${illegalEdges} illegal edges`
  );

  // And the classifier honours the table rather than moving a decided charge.
  const paidCharge: Charge = { ...good, status: 'paid' };
  const secondTransfer = await classify(paidCharge, { amount: '200.000000' });
  seenRefusals.add(refusalCode(secondTransfer));
  checkEq(
    'a second transfer cannot make a paid charge overpaid',
    refusalCode(secondTransfer),
    'charge-not-pending'
  );
  checkEq(
    'the transition table refuses an out-edge from a terminal state',
    nextChargeStatus('paid', { ok: true, status: 'overpaid', deltaUnits: 1n, toleranceUnits: 0n }),
    null
  );

  // -------------------------------------------------------------------------
  // 4. The wording lives in one place
  // -------------------------------------------------------------------------
  console.log('\nstatus wording\n');

  checkEq(
    'every status has wording, and no status is missing',
    Object.keys(CHARGE_STATUS_COPY).sort(),
    [...CHARGE_STATUSES].sort()
  );

  for (const status of CHARGE_STATUSES) {
    const copy = chargeStatusCopy(status);
    check(
      `'${status}' has a label, a headline and a detail sentence`,
      copy.label.length > 0 && copy.headline.length > 0 && copy.detail.length > 0
    );
  }

  // -------------------------------------------------------------------------
  // 5. The classifier at the boundary
  // -------------------------------------------------------------------------
  console.log('\nthe 1% boundary — a charge of 100.000000 ousd\n');

  const boundaries: Array<{ label: string; amount: string; expect: ChargeStatus }> = [
    { label: 'the exact amount is paid', amount: '100.000000', expect: 'paid' },
    { label: 'exactly 1% under is accepted as paid', amount: '99.000000', expect: 'paid' },
    { label: '1.01% under is underpaid', amount: '98.990000', expect: 'underpaid' },
    { label: 'one base unit under is paid', amount: '99.999999', expect: 'paid' },
    { label: 'exactly 1% over is accepted as paid', amount: '101.000000', expect: 'paid' },
    { label: '1.01% over is overpaid', amount: '101.010000', expect: 'overpaid' },
    { label: 'one base unit over is paid', amount: '100.000001', expect: 'paid' },
    { label: 'a clean over-payment is overpaid', amount: '200.000000', expect: 'overpaid' },
    { label: 'nothing at all is underpaid', amount: '0.000000', expect: 'underpaid' },
  ];

  for (const boundary of boundaries) {
    const decision = await classify(good, { amount: boundary.amount });
    check(
      boundary.label,
      statusOf(decision) === boundary.expect,
      `${boundary.amount} -> ${statusOf(decision)}`
    );
  }

  const atEdge = await classify(good, { amount: '99.000000' });
  check(
    'a paid decision reports the tolerance it applied (1 unit of 100)',
    atEdge.ok && atEdge.toleranceUnits === 1_000_000n,
    atEdge.ok ? atEdge.toleranceUnits : 'refused'
  );

  const over = await classify(good, { amount: '101.010000' });
  check(
    'an overpaid decision reports a positive delta',
    over.ok && over.deltaUnits === 1_010_000n,
    over.ok ? over.deltaUnits : 'refused'
  );

  // The tolerance is computed from the CHARGE, so the boundary moves with it: a
  // charge of 1.000000 has a tolerance of 0.01 — the same 1% at another scale.
  const small = await signed({ ...BASE, amount: '1.000000' });
  const smallAtEdge = await classify(small, { amount: '0.990000' });
  const smallPastEdge = await classify(small, { amount: '0.989900' });
  check(
    'the boundary scales with the charge (1.000000 accepts 0.990000)',
    statusOf(smallAtEdge) === 'paid',
    statusOf(smallAtEdge)
  );
  check(
    'the boundary scales with the charge (0.989900 is underpaid)',
    statusOf(smallPastEdge) === 'underpaid',
    statusOf(smallPastEdge)
  );

  // -------------------------------------------------------------------------
  // 6. Refusals are codes, not prose
  // -------------------------------------------------------------------------
  console.log('\nrefusals\n');

  const refusals: Array<{
    label: string;
    charge: Charge;
    over: Partial<ObservedTransfer>;
    expect: string;
    now?: Date;
  }> = [
    {
      label: 'the wrong asset is refused',
      charge: good,
      over: { asset: 'pathusd' },
      expect: 'asset-mismatch',
    },
    {
      label: 'a memo without the charge id is refused',
      charge: good,
      over: { memo: 'Seti charge' },
      expect: 'memo-missing-charge-id',
    },
    {
      label: 'an empty memo is refused',
      charge: good,
      over: { memo: '' },
      expect: 'memo-missing-charge-id',
    },
    {
      label: 'an expired charge is refused even when the amount matches',
      charge: good,
      over: {},
      expect: 'charge-expired',
      now: new Date('2026-10-24T00:00:00.000Z'),
    },
    {
      label: 'a transfer to another address is refused',
      charge: good,
      over: { recipient: STRANGER.address },
      expect: 'recipient-mismatch',
    },
    {
      label: 'an unconfirmed transfer is refused',
      charge: good,
      over: { confirmed: false },
      expect: 'receipt-unavailable',
    },
    {
      label: 'an edited amount is refused before anything is classified',
      charge: { ...good, amount: '0.500000' },
      over: {},
      expect: 'charge-signature-invalid',
    },
    {
      // A forwarded-and-replayed intent: the payload is the payee's, the key is not.
      label: 'a charge signed by anyone but the recipient is refused',
      charge: {
        ...BASE,
        signature: await STRANGER.signTypedData(chargeTypedData(BASE, TESTNET)),
        status: 'pending',
        txHash: null,
      },
      over: {},
      expect: 'charge-signature-invalid',
    },
  ];

  for (const refusal of refusals) {
    const decision = await classify(refusal.charge, refusal.over, refusal.now ?? NOW);
    seenRefusals.add(refusalCode(decision));
    check(refusal.label, refusalCode(decision) === refusal.expect, refusalCode(decision));
  }

  // Amount shapes that are not amounts.
  const unreadable = await signed({ ...BASE, amount: 'one hundred' });
  const badChargeAmount = await classify(unreadable);
  seenRefusals.add(refusalCode(badChargeAmount));
  check(
    'a charge whose amount is not an amount is refused',
    refusalCode(badChargeAmount) === 'amount-invalid',
    refusalCode(badChargeAmount)
  );

  const badTransferAmount = await classify(good, { amount: '1,000.00' });
  seenRefusals.add(refusalCode(badTransferAmount));
  check(
    'a transfer whose amount is not an amount is refused',
    refusalCode(badTransferAmount) === 'amount-invalid',
    refusalCode(badTransferAmount)
  );

  // A charge whose expiry cannot be read is inert, not live.
  const brokenExpiry = await signed({ ...BASE, expiresAt: 'next tuesday' });
  const unreadableExpiry = await classify(brokenExpiry);
  seenRefusals.add(refusalCode(unreadableExpiry));
  check(
    'an unreadable expiry is treated as expired (fails closed)',
    refusalCode(unreadableExpiry) === 'charge-expired',
    refusalCode(unreadableExpiry)
  );
  check('chargeIsExpired agrees with the classifier', chargeIsExpired(brokenExpiry, NOW));

  // Every refusal code in the taxonomy must be reachable, and none may be invented:
  // the set exercised above must equal the declared vocabulary. A code nobody can
  // reach is dead weight; a code reached but not declared does not compile, which is
  // the point of the union.
  const DECLARED_REFUSALS = [
    'amount-invalid',
    'asset-mismatch',
    'charge-expired',
    'charge-not-pending',
    'charge-signature-invalid',
    'memo-missing-charge-id',
    'receipt-unavailable',
    'recipient-mismatch',
  ];
  checkEq(
    'every declared refusal code is exercised, and nothing else is',
    [...seenRefusals].sort(),
    DECLARED_REFUSALS
  );

  // -------------------------------------------------------------------------
  // 7. Defaults
  // -------------------------------------------------------------------------
  console.log('\ndefaults\n');

  checkEq(
    'a charge lives 24 hours by default',
    defaultChargeExpiry(NOW),
    '2026-10-23T12:00:00.000Z'
  );

  // -------------------------------------------------------------------------
  const passed = asserts - failures;
  console.log(`\n${passed}/${asserts} checks passed`);
  if (failures > 0) {
    console.error(`${failures} FAILED`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('charge check crashed:', error);
  process.exit(1);
});
