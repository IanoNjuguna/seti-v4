/**
 * `npm run check:repeat-send` — the second payment to somebody is one tap (#99).
 *
 * Three claims, and all three are about what does NOT exist unless a condition
 * holds, which is exactly what a screenshot cannot show:
 *
 * 1. The entry point exists for a person with history, and for nobody else: no
 *    history is no block, not an empty one, and a row with no target is not a row.
 * 2. The confirmation still carries the platform fee (the leg that reaches the
 *    treasury) and the total, on a repeat as on a first send. The rows come from
 *    `quoteRows`, which is what `FeeQuote` draws, so this fails when the fee row is
 *    removed from the screen — proved by deleting it and re-running.
 * 3. The amount is empty until the person types it. A repeat fills the payee and
 *    nothing else, and the send route's own seed refuses `?amount=`, so there is no
 *    channel — tap, link, retry link or hand-edited URL — through which a figure
 *    the customer did not choose can reach the field.
 */
import { quoteRows, QUOTE_LABELS } from '../components/money/quoteRows.ts';
import { repeatDetail, repeatTarget, showsRecents } from '../components/send/repeat.ts';
import { sendSeed } from '../components/send/sendSeed.ts';
import { RECENT_RECIPIENT_COPY } from '../components/send/Send.constants.ts';

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

const AKINYI = '0x4c2b8e9d1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b0c';
const NAMED = { name: 'akinyi', handle: 'akinyi', address: AKINYI, lastPaidAt: '2026-10-20T06:00:00.000Z' };
const ADDRESS_ONLY = {
  name: '0x4c2b…9b0c',
  handle: null,
  address: AKINYI,
  lastPaidAt: '2026-10-18T06:00:00.000Z',
};

/** The server's quote for KES 1,250 to a person: 2% fee, KES 1.50 of gas. */
const SEND_PREVIEW = {
  fiatCurrency: 'KES',
  fiatAmount: '1250.00',
  feeFiat: '25.00',
  feePercentOfPrincipal: '2.00',
  networkFeeFiat: '1.50',
  networkFeeSource: 'estimate',
  totalFiat: '1276.50',
  fxRateStale: false,
  hasEnoughBalance: true,
};

console.log('a person with history has an entry point:');
{
  check('there is one to tap', repeatTarget(NAMED) === 'akinyi', String(repeatTarget(NAMED)));
  check('the block draws', showsRecents([NAMED]) === true);
  check('the row names the person as they were paid', NAMED.name === 'akinyi');
  check('and shows the address under that name', repeatDetail(NAMED) === AKINYI);
  check(
    'a person only ever paid by address still has an entry point',
    repeatTarget(ADDRESS_ONLY) === AKINYI && showsRecents([ADDRESS_ONLY]) === true
  );
  check('with nothing invented as a second line', repeatDetail(ADDRESS_ONLY) === null);
}

console.log('an account with no history has none:');
{
  check('no people, no block', showsRecents([]) === false);
  check(
    'and the block has a label for when it does draw, rather than an empty shell',
    RECENT_RECIPIENT_COPY.label.trim().length > 0
  );

  const noTarget = { name: 'someone', handle: null, address: '', lastPaidAt: '2026-10-20T06:00:00.000Z' };
  check('a row with no target is not an entry point', repeatTarget(noTarget) === null);
  check('and does not make the block draw on its own', showsRecents([noTarget]) === false);
  check(
    'a handle of whitespace is not a name to resolve',
    repeatTarget({ ...NAMED, handle: '   ' }) === AKINYI,
    String(repeatTarget({ ...NAMED, handle: '   ' }))
  );
}

console.log('a repeat enters the flow through the same door as any other send:');
{
  const target = repeatTarget(NAMED);

  check(
    'the tap target seeds the same `to` a typed or linked name would',
    sendSeed(new URLSearchParams({ to: target })).linked === target
  );
  check(
    'so the repeat is resolved, priced and signed on the one path',
    sendSeed(new URLSearchParams({ to: target })).linked === sendSeed(new URLSearchParams({ to: 'akinyi' })).linked
  );
  check('and the target is a name or an address, never a query string', !String(target).includes('?'));
}

console.log('the amount is empty until the person types it:');
{
  const seed = sendSeed(new URLSearchParams('to=akinyi&amount=1250.00'));

  check('the payee is taken', seed.linked === 'akinyi');
  check('the amount is not', Object.keys(seed).join(',') === 'linked', Object.keys(seed).join(','));
  check('there is no amount field to prefill', !('amount' in seed));
  check(
    'a link that carries only an amount names nobody',
    sendSeed(new URLSearchParams('amount=1250.00')).linked === null
  );
  check(
    'a retry link’s amount is dropped too',
    sendSeed(new URLSearchParams('to=akinyi&amount=1250.00')).linked === 'akinyi'
  );
  check('a blank payee is not a payee', sendSeed(new URLSearchParams('to=')).linked === null);
  check('the old pay link’s spelling still names the payee', sendSeed(new URLSearchParams('handle=akinyi')).linked === 'akinyi');
}

console.log('the confirmation carries the fee and the total, every time:');
{
  const rows = quoteRows(SEND_PREVIEW);
  const keys = rows.map((row) => row.key).join(',');
  const fee = rows.find((row) => row.key === 'fee');
  const total = rows.find((row) => row.key === 'total');

  check('the four rows, in the order they are read', keys === 'receive,fee,gas,total', keys);
  check('the platform fee is present', Boolean(fee));
  check(
    'labelled as the platform fee, with the rate seti takes',
    fee?.label === `${QUOTE_LABELS.fee} (2%)`,
    String(fee?.label)
  );
  check('and it is the figure the customer is charged', fee?.value === 'KES 25.00', String(fee?.value));
  check('the total is present', Boolean(total));
  check('named as what leaves the wallet', total?.label === QUOTE_LABELS.total, String(total?.label));
  check('and it is the whole figure, fee and gas included', total?.value === 'KES 1,276.50', String(total?.value));
  check('the total is the loud row', total?.total === true && fee?.total === false);
  check('what the payee receives is there too', rows[0]?.value === 'KES 1,250.00', String(rows[0]?.value));
  check('no row is drawn twice', new Set(rows.map((row) => row.key)).size === rows.length);
  check(
    'the fee reads the same on a repeat, because it is the same table',
    quoteRows(SEND_PREVIEW).find((row) => row.key === 'fee')?.value === fee?.value
  );
}

console.log('word of the block:');
{
  const words = Object.values(RECENT_RECIPIENT_COPY).join(' ');

  check('no em dash', !words.includes('—'));
  check('no exclamation mark', !words.includes('!'));
  check('the failed read says what to do instead', words.includes('Type their name instead'));
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
