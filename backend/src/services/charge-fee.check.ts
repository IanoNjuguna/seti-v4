/**
 * Prove the FEE LEG is read from the receipt — `npm run check:charge-fee`.
 *
 * `check:charge` proves what the classifier concludes once it is given the legs.
 * This suite proves the half before that, which is where a bug would hide silently:
 * turning the transaction that settled a charge into the fee observation the
 * classifier judges.
 *
 * A batch is ONE transaction carrying two transfers — the principal to the
 * recipient, the 2% to `SETI_TREASURY_ADDRESS`. So the receipt is the only place
 * the fee can be observed, and the treasury leg has no memo and no id: it can only
 * be recognised as a Transfer, to the treasury, from the token contract the charge
 * names. That is a decoding problem with sharp edges, and each edge is asserted:
 *
 *  1. Both legs of a real batch are read, and only the treasury one is a fee leg.
 *  2. Remove the treasury log from the same receipt and there are no fee legs —
 *     the "principal only" receipt, which is the defect this change closes.
 *  3. The amount comes back in the shape every charge amount uses (`2.000000`),
 *     because the classifier parses it as one.
 *  4. A look-alike Transfer event from another contract is not a transfer; a leg
 *     to the recipient is not a fee; an undecodable log is skipped, never thrown.
 *  5. End to end: the same signed charge, the same principal, and two receipts
 *     that differ only by the fee leg produce the same status and different fee
 *     facts. That is the property `check:charge` asserts on the arithmetic, proved
 *     here on logs.
 *
 * No database, no chain, no RPC: the logs are built with viem's own encoders, so
 * the decode under test is the real one and the fixture cannot drift from it.
 */
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  parseAbiParameters,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  chargeTypedData,
  classifyCharge,
  type Charge,
  type ChargeFeeInput,
  type ChargeFields,
  type ObservedFeeLeg,
} from './charge.js';
import { feeLegsFromReceipt } from './charge-match.js';
import type { MerchantFeeSchedule } from './fees.js';

/** A token contract, a treasury and a payee. Fixed, so a failure prints the same thing twice. */
const OUSD = '0x20c0000000000000000000006a37da5c996874be';
const PATHUSD = '0x20c0000000000000000000000000000000000000';
const TREASURY = '0x48cb25f9d82aF721e71437feAfb295da627BA475';
const TX_HASH: Hex = `0x${'c'.repeat(64)}`;

const PAYEE = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
);
const PAYER = privateKeyToAccount(
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
);

const CHAIN_ID = 42431; // practice chain
const NOW = new Date('2026-10-22T12:00:00.000Z');
const FEE_SCHEDULE: MerchantFeeSchedule = { percent: 2, minKes: 0, maxPercent: 0 };

let failures = 0;
let asserts = 0;

function check(label: string, pass: boolean, detail?: string | number | bigint): void {
  asserts += 1;
  if (!pass) failures += 1;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

function checkEq(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(label, a === e, a === e ? undefined : `got ${a}, expected ${e}`);
}

/**
 * A `Transfer` log as the chain emits it: the event is emitted BY THE TOKEN
 * CONTRACT, with `from` and `to` indexed and the value in `data`.
 *
 * Built with viem's encoders rather than hand-written hex so the fixture cannot
 * agree with a broken decoder: if the topic layout or the data encoding were wrong
 * here, `feeLegsFromReceipt` would find nothing and these assertions would fail.
 */
function transferLog(input: {
  token?: string;
  from?: string;
  to: string;
  value: bigint;
}): TransactionReceipt['logs'][number] {
  return {
    address: (input.token ?? OUSD) as Hex,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: 'Transfer',
      args: { from: (input.from ?? PAYER.address) as Hex, to: input.to as Hex },
    }) as TransactionReceipt['logs'][number]['topics'],
    data: encodeAbiParameters(parseAbiParameters('uint256'), [input.value]),
    blockNumber: 1n,
    blockHash: `0x${'0'.repeat(64)}`,
    transactionHash: TX_HASH,
    transactionIndex: 0,
    logIndex: 0,
    removed: false,
  };
}

/** A receipt over those logs. Only `logs` is read; the rest is shape. */
function receipt(logs: TransactionReceipt['logs']): Pick<TransactionReceipt, 'logs'> {
  return { logs };
}

/** The two transfers of a 100.000000 + 2.000000 batch. */
const PRINCIPAL_LEG = () =>
  transferLog({ to: PAYEE.address, value: 100_000_000n, from: PAYER.address });
const FEE_LEG = () => transferLog({ to: TREASURY, value: 2_000_000n, from: PAYER.address });

/** The legs of a receipt, through the function under test. */
function legsOf(logs: TransactionReceipt['logs']): ObservedFeeLeg[] {
  return feeLegsFromReceipt(receipt(logs), { token: OUSD, treasury: TREASURY, asset: 'ousd' });
}

const BASE: ChargeFields = {
  id: 'chg_01JHX9FEELEGFIXTURE',
  recipient: PAYEE.address,
  asset: 'ousd',
  amount: '100.000000',
  memo: 'Seti charge chg_01JHX9FEELEGFIXTURE',
  expiresAt: '2026-10-23T00:00:00.000Z',
  nonce: 'nonce-feefixture',
  scope: null,
};

async function signedCharge(): Promise<Charge> {
  return {
    ...BASE,
    signature: await PAYEE.signTypedData(chargeTypedData(BASE, CHAIN_ID)),
    status: 'pending',
    txHash: null,
  };
}

/** The principal transfer as the classifier sees it (a memo transfer, not a log). */
const observedPrincipal = {
  txHash: TX_HASH,
  recipient: PAYEE.address,
  asset: 'ousd',
  amount: '100.000000',
  memo: `Seti charge ${BASE.id}`,
  confirmed: true,
};

function feeFrom(legs: ObservedFeeLeg[]): ChargeFeeInput {
  return { routing: 'batch', treasury: TREASURY, legs, schedule: FEE_SCHEDULE };
}

async function main(): Promise<void> {
  console.log('the fee leg, read from the receipt\n');

  // -------------------------------------------------------------------------
  // 1. One transaction, two transfers
  // -------------------------------------------------------------------------
  console.log('a batch receipt:');

  const fullReceipt = [PRINCIPAL_LEG(), FEE_LEG()];
  const fullLegs = legsOf(fullReceipt);

  checkEq('exactly one leg is a fee leg, the treasury one', fullLegs.length, 1);
  checkEq(
    'it names the treasury as the recipient',
    fullLegs[0]?.recipient.toLowerCase(),
    TREASURY.toLowerCase()
  );
  checkEq('it carries the charge asset, not a token address', fullLegs[0]?.asset, 'ousd');
  checkEq(
    'and the amount in the fixed 6-decimal shape the classifier parses',
    fullLegs[0]?.amount,
    '2.000000'
  );

  // The principal transfer is in the same receipt and must NOT be read as a fee.
  check(
    'the principal leg to the payee is not a fee leg',
    fullLegs.every((leg) => leg.recipient.toLowerCase() !== PAYEE.address.toLowerCase())
  );

  // -------------------------------------------------------------------------
  // 2. The same receipt, without the fee
  // -------------------------------------------------------------------------
  console.log('\nprincipal only — the same transfer, no treasury log:');

  const principalOnlyLegs = legsOf([PRINCIPAL_LEG()]);
  checkEq('no fee leg at all', principalOnlyLegs.length, 0);

  // -------------------------------------------------------------------------
  // 3. What is NOT a fee leg
  // -------------------------------------------------------------------------
  console.log('\nwhat is not a fee leg:');

  const lookAlike = transferLog({ token: PATHUSD, to: TREASURY, value: 2_000_000n });
  checkEq(
    'a look-alike Transfer from another contract is not a transfer',
    legsOf([lookAlike]).length,
    0
  );

  const toThePayee = transferLog({ to: PAYEE.address, value: 2_000_000n });
  checkEq('a transfer to the payee is not a fee', legsOf([toThePayee]).length, 0);

  const undecodable: TransactionReceipt['logs'][number] = {
    ...transferLog({ to: TREASURY, value: 2_000_000n }),
    data: '0x',
  };
  checkEq('an undecodable log is skipped, not thrown', legsOf([undecodable]).length, 0);

  // Casing must not decide whether a fee was collected: the treasury is configured
  // with the checksummed address and the chain records lower case.
  const lowerTreasury = TREASURY.toLowerCase();
  checkEq(
    'a checksummed treasury matches the lower-case address the chain records',
    feeLegsFromReceipt(receipt([FEE_LEG()]), {
      token: OUSD.toUpperCase().replace('0X', '0x'),
      treasury: lowerTreasury,
      asset: 'ousd',
    }).length,
    1
  );

  const twoLegs = legsOf([FEE_LEG(), FEE_LEG()]);
  checkEq('two treasury transfers are two legs, not one', twoLegs.length, 2);

  // -------------------------------------------------------------------------
  // 4. End to end: the same principal, two receipts
  // -------------------------------------------------------------------------
  console.log('\nthe same charge, the same principal, two receipts:');

  const charge = await signedCharge();

  const collected = await classifyCharge({
    charge,
    transfer: observedPrincipal,
    chainId: CHAIN_ID,
    now: NOW,
    fee: feeFrom(legsOf([PRINCIPAL_LEG(), FEE_LEG()])),
  });
  const uncollected = await classifyCharge({
    charge,
    transfer: observedPrincipal,
    chainId: CHAIN_ID,
    now: NOW,
    fee: feeFrom(legsOf([PRINCIPAL_LEG()])),
  });

  check(
    'principal plus the fee transfer is paid with the fee collected',
    collected.ok && collected.status === 'paid' && collected.fee.collected === true,
    collected.ok ? `${collected.status}/${collected.fee.collected}` : `refused:${collected.code}`
  );
  check(
    'principal only is paid with the fee uncollected',
    uncollected.ok && uncollected.status === 'paid' && uncollected.fee.collected === false,
    uncollected.ok ? `${uncollected.status}/${uncollected.fee.collected}` : `refused:${uncollected.code}`
  );
  checkEq(
    'and the reason is the missing leg',
    uncollected.ok ? uncollected.fee.reason : 'refused',
    'fee-leg-missing'
  );
  check(
    'the STATUS is identical across the two receipts — only the fee fact differs',
    collected.ok && uncollected.ok && collected.status === uncollected.status,
    collected.ok && uncollected.ok ? `${collected.status} / ${uncollected.status}` : 'refused'
  );
  check(
    'the fee expectation is the 2% of the signed amount in both',
    collected.ok &&
      uncollected.ok &&
      collected.fee.expectedUnits === 2_000_000n &&
      uncollected.fee.expectedUnits === 2_000_000n,
    collected.ok ? collected.fee.expectedUnits ?? 'null' : 'refused'
  );
  check(
    'and the observed fee is only non-zero where a treasury leg exists',
    collected.ok &&
      uncollected.ok &&
      collected.fee.observedUnits === 2_000_000n &&
      uncollected.fee.observedUnits === null,
    collected.ok && uncollected.ok
      ? `${collected.fee.observedUnits} / ${uncollected.fee.observedUnits}`
      : 'refused'
  );

  // The fee the payer actually signed for is the figure the receipt is held to: a
  // fee computed on the WRONG amount (2% of the gross, or of a rounded figure) is
  // short, and this is the assertion that would catch it.
  const feeOnTheGross = await classifyCharge({
    charge,
    transfer: observedPrincipal,
    chainId: CHAIN_ID,
    now: NOW,
    // 2% of 102, i.e. the classic "fee on the total" mistake.
    fee: feeFrom(legsOf([PRINCIPAL_LEG(), transferLog({ to: TREASURY, value: 2_040_000n })])),
  });
  check(
    'a fee computed on the gross is collected (it is above the ask), not short',
    feeOnTheGross.ok && feeOnTheGross.fee.collected === true && feeOnTheGross.fee.excessUnits === 40_000n,
    feeOnTheGross.ok ? feeOnTheGross.fee.excessUnits : 'refused'
  );

  const justOneUnitShort = await classifyCharge({
    charge,
    transfer: observedPrincipal,
    chainId: CHAIN_ID,
    now: NOW,
    fee: feeFrom(legsOf([PRINCIPAL_LEG(), transferLog({ to: TREASURY, value: 1_999_999n })])),
  });
  check(
    'a fee one base unit short, decoded from a receipt, is not collected',
    justOneUnitShort.ok &&
      justOneUnitShort.status === 'paid' &&
      justOneUnitShort.fee.collected === false &&
      justOneUnitShort.fee.reason === 'fee-short',
    justOneUnitShort.ok ? `${justOneUnitShort.status}/${justOneUnitShort.fee.reason}` : 'refused'
  );

  const passed = asserts - failures;
  console.log(`\n${passed}/${asserts} checks passed`);
  if (failures > 0) {
    console.error(`${failures} FAILED`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('charge fee check crashed:', error);
  process.exit(1);
});
