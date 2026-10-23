/**
 * `npm run check:memo-always` — a charge payment cannot be built without its memo (#184).
 *
 * The pay page's own transfer builder is `lib/pay/build-transfer.ts`. Until now it
 * built a bare TIP-20 `transfer`, which is the one shape that can move a charge's
 * money and settle nothing: TIP-20 also has
 * `transferWithMemo(address,uint256,bytes32)`, the charge id travels in that memo,
 * and the backend refuses a transfer without it by code (`memo-missing-charge-id`,
 * `backend/src/services/charge.ts`). The customer pays, the merchant is paid, and
 * the charge stays `pending` forever with no error on either side.
 *
 * Five things are pinned here, and the fourth is the one that makes the rest honest:
 *
 *  1. **The built call carries the memo.** Not "the code contains the argument": the
 *     CALldata is decoded and the charge id is read back out of it, and the selector
 *     is compared against keccak of the canonical signature rather than against this
 *     repo's opinion of it.
 *  2. **Removing it fails.** A plain `transfer` of the same amount to the same
 *     recipient decodes to no memo and no charge id, which is the mutation this
 *     check reports as a failure.
 *  3. **The refusals.** A charge with no id, an id too long for 32 bytes, and a
 *     payment assembled with no reference at all are all refused with a message that
 *     names the cause, and nothing is built.
 *  4. **The matcher's own decoder, not a copy of it.** The memo bytes are decoded
 *     with `memoFromBytes32` imported from `backend/src/lib/tip20-memo.ts`, the one
 *     implementation `backend/src/services/charge-match.ts` re-exports and runs on
 *     chain data (asserted below by reading that file, so a second copy appearing
 *     there fails this check). Two implementations of one encoding is how the encoder
 *     and the matcher drift apart while both look right.
 *  5. **The envelope survives.** The memo is asserted in the `calls` array that goes
 *     to Privy's Tempo hook, because the batch is never signed through an EIP-1193
 *     provider (viem's RPC formatter drops `calls`).
 *
 * Run from `web/`: npm run check:memo-always (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { decodeFunctionData, erc20Abi, toFunctionSelector } from 'viem';

/**
 * The served chain, set BEFORE anything imports the app's chain table.
 *
 * `lib/pay/build-transfer.ts` resolves its token contracts through `@/lib/chain`,
 * whose module body calls `resolveNetwork()` and throws when
 * `NEXT_PUBLIC_TEMPO_CHAIN_ID` is unset. Next loads `.env.local`; tsx does not, and
 * CI sets no web chain id, so a check that imported the builder statically would fail
 * to load for a reason that has nothing to do with memos. Practice, always: this check
 * builds calldata and never signs, so the chain only decides which token address
 * appears in `to`. Skipped when the environment already named one.
 */
process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID ??= '42431';

/**
 * Loaded AFTER the line above, which is why these are dynamic.
 *
 * `build-transfer.ts` and its chain table evaluate `NEXT_PUBLIC_TEMPO_CHAIN_ID` at
 * module load, so a static `import` of the builder would hoist past the default.
 */
const { TIP20_MEMO_ABI, buildBatchTransfer, buildTempoTransaction, buildTransfer } = await import(
  '../lib/pay/build-transfer.ts'
);
const { CHARGE_MEMO_BYTES, ChargeMemoUnavailableError, memoForCharge } = await import(
  '../lib/pay/charge-memo.ts'
);
const { FIXTURE_CHARGE_IDS } = await import('../lib/charges/charge.fixture.ts');
const { CHARGE_ID_PATTERN } = await import('../lib/charges/charge.constants.ts');
/**
 * THE MATCHER'S OWN DECODER.
 *
 * This is a dev-time check, run by tsx on a developer machine and in CI, and it is
 * never imported by anything the browser ships. Reaching across the workspace here
 * is the point: `memoFromBytes32` is what the indexer runs on a real
 * `TransferWithMemo` log, so proving the built memo decodes with it proves the two
 * halves of the encoding agree. A copy in this file would prove only that the copy
 * agrees with itself — which is also why it is imported from the pure module rather
 * than from `charge-match.ts`: that module's graph needs a database client and a
 * validated environment, and the decoder does not.
 */
const { memoFromBytes32 } = await import('../../backend/src/lib/tip20-memo.ts');

/** Practice chain: the check never signs anything, and mainnet is opt-in. */
const NETWORK = 'testnet';
const MERCHANT = '0x1111111111111111111111111111111111111111';
const TREASURY = '0x2222222222222222222222222222222222222222';
const PRINCIPAL = '100.000000';
const FEE = '2.000000';
/** A real charge id: the shape the pay page serves and the page's fixtures use. */
const CHARGE_ID = 'ch_8f2c1a4e7b9d';

/** keccak of the canonical signatures, not of this repo's ABI fragments. */
const MEMO_SELECTOR = toFunctionSelector('transferWithMemo(address,uint256,bytes32)');
const TRANSFER_SELECTOR = toFunctionSelector('transfer(address,uint256)');

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
    return;
  }
  failed += 1;
  console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

/** The batch the app signs, with the reference under test. */
function batch(reference, over = {}) {
  return buildBatchTransfer({
    asset: 'ousd',
    recipientAddress: MERCHANT,
    principalAmount: PRINCIPAL,
    feeAmount: FEE,
    treasuryAddress: TREASURY,
    network: NETWORK,
    reference,
    ...over,
  });
}

/** The single-transfer (`inside-transfer`) path, with the reference under test. */
function single(reference) {
  return buildTransfer({
    asset: 'ousd',
    recipientAddress: MERCHANT,
    grossAmount: '102.000000',
    network: NETWORK,
    reference,
  });
}

/** Decode a memo-transfer call, or null if it is not one. */
function asMemoCall(data) {
  if (!data.startsWith(MEMO_SELECTOR)) return null;
  try {
    return decodeFunctionData({ abi: TIP20_MEMO_ABI, data });
  } catch {
    return null;
  }
}

/** The raw memo bytes of a built call, as `0x…`, or null. */
function memoOf(data) {
  const decoded = asMemoCall(data);
  return decoded ? decoded.args[2] : null;
}

/** Run `fn` and answer what it threw, or null when it did not throw. */
function thrownBy(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

console.log('the batch the app signs carries the charge id in its memo:');
{
  const calls = batch({ kind: 'charge', chargeId: CHARGE_ID });
  const principal = calls[0];

  check('a charge batch is two calls: the principal and the fee', calls.length === 2, `${calls.length}`);

  check(
    'the principal leg calls transferWithMemo, by keccak of the canonical signature',
    principal.data.startsWith(MEMO_SELECTOR),
    principal.data.slice(0, 10)
  );

  const decoded = asMemoCall(principal.data);
  check('and decodes as transferWithMemo', decoded?.functionName === 'transferWithMemo');

  check(
    'to the merchant, for the principal, unchanged by the memo',
    decoded?.args[0] === MERCHANT && decoded?.args[1] === 100000000n,
    `${decoded?.args[0]} / ${String(decoded?.args[1])}`
  );

  const memo = decoded?.args[2];
  check(
    'with a 32-byte memo argument',
    typeof memo === 'string' && /^0x[0-9a-f]{64}$/i.test(memo),
    String(memo)
  );

  check(
    "the memo decodes back to the charge id with the matcher's own decoder",
    memoFromBytes32(memo) === CHARGE_ID,
    memoFromBytes32(memo)
  );

  /**
   * Right-padded, read as bytes rather than via the decoder: the matcher strips
   * trailing NULs, so the id has to sit at the FRONT of the field with zeroes after
   * it. Left padding, a hash, or a truncated id all fail here.
   */
  const idHex = Buffer.from(CHARGE_ID, 'utf8').toString('hex');
  const body = memo.slice(2).toLowerCase();
  check(
    'the id is the first bytes of the memo, zero-padded to exactly 32',
    body.startsWith(idHex) && body.length === CHARGE_MEMO_BYTES * 2 && /^0*$/.test(body.slice(idHex.length)),
    body
  );
}

console.log('the decoder this check used is the one the matcher runs:');
{
  /**
   * `charge-match.ts` must RE-EXPORT the pure decoder rather than carry one.
   *
   * Read as source, because importing the matcher would drag a database client and a
   * validated environment into a check about calldata — the whole reason the decoder
   * lives in `lib/tip20-memo.ts` is that it can be loaded on its own. The two
   * assertions together say the matcher's symbol comes from that file and no second
   * implementation of the encoding exists beside it.
   */
  const matcher = readFileSync(
    new URL('../../backend/src/services/charge-match.ts', import.meta.url),
    'utf8'
  );
  check(
    'charge-match re-exports memoFromBytes32 from the pure module',
    /export\s*\{\s*memoFromBytes32\s*\}\s*from\s*'\.\.\/lib\/tip20-memo\.js'/.test(matcher)
  );
  check('and declares no memo decoder of its own', !/function\s+memoFromBytes32/.test(matcher));

  const indexer = readFileSync(new URL('../../backend/src/services/indexer.ts', import.meta.url), 'utf8');
  check(
    'and the indexer reads chain memos through that same symbol',
    /memoFromBytes32\(log\.args\.memo\)/.test(indexer)
  );
}

console.log('the fee leg is untouched, so it is still read as a fee leg:');
{
  const calls = batch({ kind: 'charge', chargeId: CHARGE_ID });

  check(
    'the fee leg is a plain transfer, by keccak of the canonical signature',
    calls[1].data.startsWith(TRANSFER_SELECTOR),
    calls[1].data.slice(0, 10)
  );

  const fee = decodeFunctionData({ abi: erc20Abi, data: calls[1].data });
  check(
    'to the treasury, for the fee',
    fee.functionName === 'transfer' && fee.args[0] === TREASURY && fee.args[1] === 2000000n,
    `${fee.args?.[0]} / ${String(fee.args?.[1])}`
  );

  check(
    'and carries no memo of its own',
    asMemoCall(calls[1].data) === null && fee.args.length === 2,
    `${fee.args?.length} args`
  );
}

console.log('the envelope that goes to the Privy Tempo hook still has it:');
{
  const calls = batch({ kind: 'charge', chargeId: CHARGE_ID });
  const envelope = buildTempoTransaction({ asset: 'ousd', calls, network: NETWORK });

  check('the envelope is a Tempo (type 118) transaction', envelope.type === 118);
  check(
    'its calls array is the one built above, memo included',
    envelope.calls.length === 2 &&
      envelope.calls[0].data === calls[0].data &&
      memoFromBytes32(memoOf(envelope.calls[0].data)) === CHARGE_ID
  );
  check(
    'and the fee is paid in the asset being spent',
    envelope.feeToken === calls[0].to,
    `${envelope.feeToken} vs ${calls[0].to}`
  );
}

console.log('the single-transfer (inside-transfer) path carries it too:');
{
  const transfer = single({ kind: 'charge', chargeId: CHARGE_ID });

  check(
    'a charge paid as one transfer is a transferWithMemo',
    transfer.data.startsWith(MEMO_SELECTOR),
    transfer.data.slice(0, 10)
  );
  check(
    'and its memo decodes back to the charge id',
    memoFromBytes32(memoOf(transfer.data)) === CHARGE_ID,
    String(memoOf(transfer.data))
  );
  check('with no native value leg', transfer.value === 0n || transfer.value === BigInt(0));
}

console.log('every id the page serves round-trips through bytes32:');
{
  const ids = FIXTURE_CHARGE_IDS.filter((id) => CHARGE_ID_PATTERN.test(id));
  check('the fixtures are ids the page would serve', ids.length > 0, `${ids.length}`);

  const wrong = ids.filter((id) => memoFromBytes32(memoForCharge(id)) !== id);
  check(
    `all ${ids.length} fixture ids decode back to themselves`,
    wrong.length === 0,
    wrong.join(',')
  );

  /**
   * The length boundary, both sides of it. 32 bytes is the whole field; 33 cannot be
   * represented, and the encoder must refuse rather than truncate or hash.
   */
  const widths = [6, 15, 31, 32].map((n) => `ch_${'a'.repeat(n - 3)}`);
  const widthsOk = widths.every(
    (id) => Buffer.byteLength(id, 'utf8') <= CHARGE_MEMO_BYTES && memoFromBytes32(memoForCharge(id)) === id
  );
  check('ids from 6 to 32 bytes all round-trip', widthsOk, widths.map((id) => id.length).join(','));

  const padded = widths.every((id) => {
    const body = memoForCharge(id).slice(2);
    const idHex = Buffer.from(id, 'utf8').toString('hex');
    return body.length === CHARGE_MEMO_BYTES * 2 && /^0*$/.test(body.slice(idHex.length));
  });
  check('and every one is right-padded with zeroes, not left', padded);
}

console.log('and a plain transfer is what the check would catch:');
{
  const plain = single({ kind: 'direct' });

  check(
    'a direct payment is a plain transfer, not a memo transfer',
    plain.data.startsWith(TRANSFER_SELECTOR) && plain.data.slice(0, 10) === TRANSFER_SELECTOR.slice(0, 10),
    plain.data.slice(0, 10)
  );
  check(
    'which yields no memo to decode, so no charge id can be read from it',
    memoOf(plain.data) === null,
    String(memoOf(plain.data))
  );

  /**
   * The mutation, stated as an assertion: the same payment built WITHOUT the
   * reference (which is how the builder behaved before #184) is a plain transfer, and
   * therefore cannot decode to the charge id. Deleting the memo from the builder
   * turns this into the failure the whole check exists to report.
   */
  const mutated = batch({ kind: 'direct' });
  check(
    'a memo-less build of the same payment fails both memo assertions above',
    !mutated[0].data.startsWith(MEMO_SELECTOR) && memoFromBytes32(memoOf(mutated[0].data)) !== CHARGE_ID,
    mutated[0].data.slice(0, 10)
  );
}

console.log('the guard refuses what cannot be matched:');
{
  const blank = ['', '   ', null, undefined];
  for (const chargeId of blank) {
    const thrown = thrownBy(() => batch({ kind: 'charge', chargeId }));
    check(
      `a charge whose id is ${JSON.stringify(chargeId)} is refused`,
      thrown instanceof ChargeMemoUnavailableError,
      thrown ? `${thrown.name}: ${thrown.message}` : 'built a payment'
    );
    check(
      '  and the refusal says no charge id came with it',
      thrown?.message?.includes('no charge id came with it') === true,
      thrown?.message ?? 'built a payment'
    );
  }

  const long = `ch_${'b'.repeat(40)}`;
  const thrown = thrownBy(() => single({ kind: 'charge', chargeId: long }));
  check(
    'an id longer than 32 bytes is refused, not truncated or hashed',
    thrown instanceof ChargeMemoUnavailableError && !thrown.message.includes('0x'),
    thrown?.message ?? 'built a payment'
  );
  check(
    '  and the refusal names the length and the 32-byte field',
    thrown?.message?.includes(`${CHARGE_MEMO_BYTES}`) === true && thrown?.message?.includes('bytes') === true,
    thrown?.message ?? ''
  );

  const refusals = [
    ['no reference at all', undefined],
    ['a null reference', null],
    ['an empty reference', {}],
    ['an unknown kind', { kind: 'charge-with-a-typo' }],
    ['a charge reference with no id', { kind: 'charge' }],
  ];
  for (const [label, reference] of refusals) {
    const threw = thrownBy(() => batch(reference));
    check(
      `${label} is refused rather than built as an anonymous transfer`,
      threw instanceof ChargeMemoUnavailableError,
      threw ? threw.name : 'built a payment'
    );
  }

  check(
    'the same refusals hold on the single-transfer path',
    ['', null, undefined].every(
      (chargeId) => thrownBy(() => single({ kind: 'charge', chargeId })) instanceof ChargeMemoUnavailableError
    )
  );
}

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
