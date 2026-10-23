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
 *  5. **The fee leg as its own fact.** The same receipt with and without a transfer
 *     to the treasury is `paid` either way, and only one of them is fee-collected;
 *     `inside-transfer` mode is never collected; a fee one base unit short is short.
 *     The status never moves with the fee, which is the whole point of the split.
 *
 * No database, no chain, no user: `services/charge.ts` is pure, so this suite runs
 * with no `docker compose up`. It does read one piece of config — the fee schedule —
 * because the fee expectation has to be the SAME 2% the payment path charges, and
 * copying the number into a fixture would be the second definition of it that
 * `fees.ts` exists to prevent. Signatures are REAL signatures from deterministic
 * dev keys, never fabricated hex — a check that asserts on a made-up signature
 * proves nothing about whether a wallet can sign anything.
 */
import { hashTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { TEMPO_MAINNET_CHAIN_ID, TEMPO_TESTNET_CHAIN_ID } from '../config/assets.js';
import {
  CHARGE_FEE_REASONS,
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
  hasCodeAt,
  isTerminal,
  nextChargeStatus,
  recoverChargeSigner,
  type Charge,
  type ChargeDecision,
  type ChargeFeeInput,
  type ChargeFeeOutcome,
  type ChargeFields,
  type ChargeStatus,
  type ObservedFeeLeg,
  type ObservedTransfer,
} from './charge.js';
import type { FeeRoutingMode, MerchantFeeSchedule } from './fees.js';

/**
 * The treasury fixture, and the reason it is a constant rather than `env`:
 * `charge.ts` never reads config, so the address is data the caller supplies. The
 * live value is injected in `charge-match.ts` (`treasuryAddressFor`).
 */
const TREASURY = '0x48cb25f9d82aF721e71437feAfb295da627BA475';

/** The mode the product ships: the fee is a second transfer, to the treasury. */
const BATCH: FeeRoutingMode = 'batch';

/**
 * The shipped schedule, written out: 2%, no floor, no cap.
 *
 * Written as a literal on purpose — a fixture that read the environment would move
 * when the environment moved, and these assertions are about the arithmetic at a
 * known 2%, not about whatever this box is configured with.
 */
const FEE_SCHEDULE: MerchantFeeSchedule = { percent: 2, minKes: 0, maxPercent: 0 };

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
  chainId: number = TESTNET,
  recipientHasCode?: (recipient: string) => Promise<boolean>
): Promise<ChargeDecision> {
  return classifyCharge({ charge, transfer: transfer(over), chainId, now, recipientHasCode });
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
    nextChargeStatus('paid', {
      ok: true,
      status: 'overpaid',
      deltaUnits: 1n,
      toleranceUnits: 0n,
      fee: {
        collected: false,
        reason: 'fee-not-observed',
        expectedUnits: null,
        observedUnits: null,
        excessUnits: 0n,
      },
    }),
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
    /** Only the contract-account fixtures need this; the rest leave it undefined. */
    recipientHasCode?: (recipient: string) => Promise<boolean>;
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
    {
      // A Safe (or any contract account) cannot answer an ECDSA recovery at all. Saying
      // "this did not come from the recipient" would accuse an honest merchant of
      // forging their own charge, so the refusal names the real limitation instead.
      label: 'a charge signed from a contract account is refused as unsupported, not as a forgery',
      charge: {
        ...BASE,
        signature: await STRANGER.signTypedData(chargeTypedData(BASE, TESTNET)),
        status: 'pending',
        txHash: null,
      },
      over: {},
      expect: 'charge-signature-contract-wallet',
      recipientHasCode: async () => true,
    },
    {
      // The same signature against an address with no code is still a forgery: the probe
      // must not soften a real one.
      label: 'the same signature against an address with no code is still invalid',
      charge: {
        ...BASE,
        signature: await STRANGER.signTypedData(chargeTypedData(BASE, TESTNET)),
        status: 'pending',
        txHash: null,
      },
      over: {},
      expect: 'charge-signature-invalid',
      recipientHasCode: async () => false,
    },
  ];

  for (const refusal of refusals) {
    const decision = await classify(
      refusal.charge,
      refusal.over,
      refusal.now ?? NOW,
      TESTNET,
      refusal.recipientHasCode
    );
    seenRefusals.add(refusalCode(decision));
    check(refusal.label, refusalCode(decision) === refusal.expect, refusalCode(decision));
  }

  // The contract-account probe itself: code is code, even when it is a 7702 delegation,
  // and an unreachable node must never become a claim about the payee.
  const probeClient = (code: string | undefined | Error) => ({
    getCode: async (_args: { address: `0x${string}` }): Promise<string | undefined> => {
      if (code instanceof Error) throw code;
      return code;
    },
  });
  check('code at the address counts, including a 7702 delegation', await hasCodeAt(probeClient('0xef'), BASE.recipient));
  check('a plain contract counts as code', await hasCodeAt(probeClient('0x60806040'), BASE.recipient));
  check('no code is not a contract', !(await hasCodeAt(probeClient('0x'), BASE.recipient)));
  check('an undefined answer is not a contract', !(await hasCodeAt(probeClient(undefined), BASE.recipient)));
  check('an unreachable node is not a contract', !(await hasCodeAt(probeClient(new Error('rpc down')), BASE.recipient)));

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
    'charge-signature-contract-wallet',
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
  // 7. The fee leg — a second fact, never a condition on the status
  // -------------------------------------------------------------------------
  console.log('\nthe fee leg — 2% of the signed amount, checked on its own\n');

  /**
   * The fixtures below are all about ONE charge of `100.000000 ousd`, whose 2% is
   * exactly `2.000000` — the same arithmetic a payer's client performs, which is
   * what makes an exact comparison fair.
   */
  const feeReasons = new Set<string>();

  function noteFee(decision: ChargeDecision): ChargeFeeOutcome | null {
    if (!decision.ok) return null;
    if (decision.fee.reason) feeReasons.add(decision.fee.reason);
    return decision.fee;
  }

  /** A treasury leg of `amount`, in the charge's asset unless overridden. */
  function treasuryLeg(amount: string, over: Partial<ObservedFeeLeg> = {}): ObservedFeeLeg {
    return { recipient: TREASURY, asset: BASE.asset, amount, ...over };
  }

  /** A fee observation for the batch mode the product ships. */
  function batchFee(legs: ObservedFeeLeg[] = [], over: Partial<ChargeFeeInput> = {}): ChargeFeeInput {
    return { routing: BATCH, treasury: TREASURY, legs, schedule: FEE_SCHEDULE, ...over };
  }

  /** Classify `good` with a fee observation attached. */
  function withFee(
    fee: ChargeFeeInput | undefined,
    transferOver: Partial<ObservedTransfer> = {}
  ): Promise<ChargeDecision> {
    return classifyCharge({
      charge: good,
      transfer: transfer(transferOver),
      chainId: TESTNET,
      now: NOW,
      fee,
    });
  }

  // (a) The principal arrived and the fee did not. This is the defect: before the
  // fee leg was read at all, this receipt and a full one were the same decision.
  const principalOnly = withFee(batchFee());
  const principalOnlyDecision = await principalOnly;
  const principalOnlyFee = noteFee(principalOnlyDecision);

  check(
    'a transfer carrying the principal and NO fee leg is still paid',
    statusOf(principalOnlyDecision) === 'paid',
    statusOf(principalOnlyDecision)
  );
  check(
    'and the fee is reported uncollected, not inferred from the principal',
    principalOnlyFee?.collected === false,
    `${principalOnlyFee?.collected}`
  );
  checkEq(
    'with a reason naming the missing leg',
    principalOnlyFee?.reason,
    'fee-leg-missing'
  );
  check(
    'and the expectation is the schedule applied to the signed amount (2.000000)',
    principalOnlyFee?.expectedUnits === 2_000_000n,
    principalOnlyFee?.expectedUnits ?? 'null'
  );
  check(
    'and nothing was observed at the treasury',
    principalOnlyFee?.observedUnits === null,
    principalOnlyFee?.observedUnits ?? 'null'
  );

  // (b) The same receipt, with the fee leg beside the principal — one transaction,
  // two transfers. Now, and only now, is the fee collected.
  const withFeeLeg = await withFee(batchFee([treasuryLeg('2.000000')]));
  const withFeeLegFee = noteFee(withFeeLeg);

  check('a principal plus a treasury leg is paid', statusOf(withFeeLeg) === 'paid');
  check(
    'and the fee is reported collected',
    withFeeLegFee?.collected === true,
    `${withFeeLegFee?.collected}`
  );
  check('with no reason left to give', withFeeLegFee?.reason === null);
  check(
    'observed equals expected to the base unit',
    withFeeLegFee?.observedUnits === 2_000_000n && withFeeLegFee?.expectedUnits === 2_000_000n,
    `${withFeeLegFee?.observedUnits ?? 'null'} / ${withFeeLegFee?.expectedUnits ?? 'null'}`
  );
  check('and there is no excess', withFeeLegFee?.excessUnits === 0n, withFeeLegFee?.excessUnits ?? 'null');

  // The two decisions above differ ONLY in the fee leg: same charge, same transfer,
  // same amount. That is the property the old 1%-only check could not express.
  check(
    'the two receipts are the same status and differ only in the fee fact',
    statusOf(principalOnlyDecision) === statusOf(withFeeLeg) &&
      principalOnlyFee?.collected !== withFeeLegFee?.collected
  );

  // (c) inside-transfer: the fee rides inside the single transfer to the RECIPIENT,
  // so Seti receives nothing. This mode must never be reported as collected.
  const insideTransfer = await withFee(batchFee([], { routing: 'inside-transfer' }));
  const insideTransferFee = noteFee(insideTransfer);

  check(
    'inside-transfer mode is never reported as fee-collected',
    insideTransferFee?.collected === false,
    `${insideTransferFee?.collected}`
  );
  checkEq(
    'and says the fee went to the recipient',
    insideTransferFee?.reason,
    'fee-inside-transfer'
  );
  check(
    'and the charge is still paid — the recipient did receive the money',
    statusOf(insideTransfer) === 'paid',
    statusOf(insideTransfer)
  );

  // Even if a transfer to the treasury happens to be in that transaction, in
  // inside-transfer mode it was not the fee and it was not collected.
  const insideTransferWithLeg = await withFee(
    batchFee([treasuryLeg('2.000000')], { routing: 'inside-transfer' })
  );
  noteFee(insideTransferWithLeg);
  check(
    'a treasury transfer in inside-transfer mode is not a collected fee',
    insideTransferWithLeg.ok && insideTransferWithLeg.fee.collected === false && insideTransferWithLeg.fee.reason === 'fee-inside-transfer',
    insideTransferWithLeg.ok ? String(insideTransferWithLeg.fee.collected) : 'refused'
  );

  // (d) A paid charge with an uncollected fee is readable as BOTH facts.
  const readable = await withFee(batchFee([treasuryLeg('1.980000')]));
  const readableFee = noteFee(readable);
  check(
    'a paid charge with a short fee reads paid AND fee-uncollected',
    statusOf(readable) === 'paid' && readableFee?.collected === false,
    `${statusOf(readable)} / ${readableFee?.collected}`
  );
  checkEq('with the shortfall named', readableFee?.reason, 'fee-short');
  check(
    'and the arithmetic of the shortfall is reported, not just the verdict',
    readableFee?.expectedUnits === 2_000_000n && readableFee?.observedUnits === 1_980_000n,
    `${readableFee?.observedUnits ?? 'null'} of ${readableFee?.expectedUnits ?? 'null'}`
  );

  // One base unit is the boundary, and it bites in both directions. This is why the
  // fee has no 1% tolerance: a tolerance here IS the defect, smaller.
  const oneUnitShort = await withFee(batchFee([treasuryLeg('1.999999')]));
  const oneUnitShortFee = noteFee(oneUnitShort);
  check(
    'a fee one base unit short is not collected',
    oneUnitShortFee?.collected === false && oneUnitShortFee.reason === 'fee-short',
    oneUnitShortFee?.reason ?? 'collected'
  );
  check(
    'and the payment is still paid (a fee shortfall is not a failed payment)',
    statusOf(oneUnitShort) === 'paid',
    statusOf(oneUnitShort)
  );

  const oneUnitOver = await withFee(batchFee([treasuryLeg('2.000001')]));
  const oneUnitOverFee = noteFee(oneUnitOver);
  check(
    'a fee one base unit over is collected, and the excess is reported',
    oneUnitOverFee?.collected === true && oneUnitOverFee.excessUnits === 1n,
    oneUnitOverFee?.excessUnits ?? 'null'
  );

  // (e) Every way the fee can fail to arrive, each its own fact.
  const wrongAsset = await withFee(batchFee([treasuryLeg('2.000000', { asset: 'pathusd' })]));
  const wrongAssetFee = noteFee(wrongAsset);
  check(
    'a fee paid in another token is not this fee',
    wrongAssetFee?.collected === false && wrongAssetFee.reason === 'fee-asset-mismatch',
    wrongAssetFee?.reason ?? 'collected'
  );

  const paidToThePayee = await withFee(
    batchFee([treasuryLeg('2.000000', { recipient: PAYEE.address })])
  );
  const paidToThePayeeFee = noteFee(paidToThePayee);
  check(
    'a transfer to the payee is not a fee to the treasury',
    paidToThePayeeFee?.collected === false && paidToThePayeeFee.reason === 'fee-leg-missing',
    paidToThePayeeFee?.reason ?? 'collected'
  );

  const notObserved = await withFee(undefined);
  const notObservedFee = noteFee(notObserved);
  check(
    'a caller that did not look reports uncollected, never collected',
    notObservedFee?.collected === false && notObservedFee.reason === 'fee-not-observed',
    notObservedFee?.reason ?? 'collected'
  );
  check(
    'and it still decides the payment',
    statusOf(notObserved) === 'paid',
    statusOf(notObserved)
  );

  // Two treasury calls in one batch: a batch is a list of calls, so the legs are
  // summed rather than the first one being taken for the whole fee.
  const splitLegs = await withFee(
    batchFee([treasuryLeg('1.000000'), treasuryLeg('1.000000')])
  );
  const splitLegsFee = noteFee(splitLegs);
  check(
    'two treasury legs in one batch sum to the fee',
    splitLegsFee?.collected === true && splitLegsFee.observedUnits === 2_000_000n,
    splitLegsFee?.observedUnits ?? 'null'
  );

  // A schedule that cannot be expressed in token units (a fiat floor or cap) is a
  // refusal, never a guess: the fee a deployment THINKS it collects must not be
  // understated by an arithmetic this module cannot do.
  const flooredSchedule = await withFee(
    batchFee([treasuryLeg('2.000000')], { schedule: { percent: 2, minKes: 50, maxPercent: 0 } })
  );
  const flooredFee = noteFee(flooredSchedule);
  check(
    'a floor schedule cannot be measured in token units, and says so',
    flooredFee?.collected === false && flooredFee.reason === 'fee-schedule-not-units',
    flooredFee?.reason ?? 'collected'
  );

  // A schedule that charges nothing has nothing to leave uncollected.
  const freeSchedule = await withFee(
    batchFee([], { schedule: { percent: 0, minKes: 0, maxPercent: 0 } })
  );
  const freeFee = noteFee(freeSchedule);
  check(
    'a zero-percent schedule reports a collected fee rather than a permanent shortfall',
    freeFee?.collected === true && freeFee.expectedUnits === 0n,
    `${freeFee?.collected}`
  );

  // The expectation must come from `fees.ts` when the caller does not override it:
  // 2% is the product's number, owned in one place, never a constant in the
  // classifier. (CI pins MERCHANT_FEE_* to nothing, so the default is the shipped 2%.)
  const liveSchedule = await withFee({
    routing: BATCH,
    treasury: TREASURY,
    legs: [treasuryLeg('2.000000')],
  });
  const liveScheduleFee = noteFee(liveSchedule);
  check(
    'with no schedule passed, the expectation is the live one from fees.ts',
    liveScheduleFee?.expectedUnits === 2_000_000n && liveScheduleFee.collected === true,
    liveScheduleFee?.expectedUnits ?? 'null'
  );

  // The expectation is the SCHEDULE on the signed amount, so it scales and floors
  // exactly as `fees.ts` says: 2% of 1.000000 is 0.020000, and 2% of one base unit
  // (0.000001) is below a base unit, so nothing is owed and nothing is short.
  const smallCharge = await signed({ ...BASE, amount: '1.000000' });
  const smallDecision = await classifyCharge({
    charge: smallCharge,
    transfer: transfer({ amount: '1.000000' }),
    chainId: TESTNET,
    now: NOW,
    fee: batchFee([treasuryLeg('0.020000')]),
  });
  check(
    'the expectation scales with the charge (2% of 1.000000 is 0.020000)',
    smallDecision.ok && smallDecision.fee.expectedUnits === 20_000n && smallDecision.fee.collected,
    smallDecision.ok ? smallDecision.fee.expectedUnits ?? 'null' : 'refused'
  );

  const dustCharge = await signed({ ...BASE, amount: '0.000001' });
  const dustDecision = await classifyCharge({
    charge: dustCharge,
    transfer: transfer({ amount: '0.000001' }),
    chainId: TESTNET,
    now: NOW,
    fee: batchFee([]),
  });
  check(
    'a fee below one base unit is zero, and zero is collected rather than missing',
    dustDecision.ok && dustDecision.fee.expectedUnits === 0n && dustDecision.fee.collected,
    dustDecision.ok ? String(dustDecision.fee.expectedUnits) : 'refused'
  );

  // The two questions are independent in the other direction too: an underpaid
  // principal does not make the fee uncollected, and a collected fee does not make
  // an underpaid principal paid.
  const underpaidWithFee = await withFee(batchFee([treasuryLeg('2.000000')]), {
    amount: '98.990000',
  });
  const underpaidWithFeeFee = noteFee(underpaidWithFee);
  check(
    'an underpaid principal is a separate fact from a collected fee',
    statusOf(underpaidWithFee) === 'underpaid' && underpaidWithFeeFee?.collected === true,
    `${statusOf(underpaidWithFee)} / ${underpaidWithFeeFee?.collected}`
  );

  // Every declared reason must be reachable, and none may be invented — the same
  // discipline the refusal codes get, for the same reason: a code nobody can reach
  // is dead weight, and a code not declared does not compile.
  checkEq(
    'every declared fee reason is exercised, and nothing else is',
    [...feeReasons].sort(),
    [...CHARGE_FEE_REASONS].sort()
  );

  // -------------------------------------------------------------------------
  // 8. Defaults
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
