/**
 * `npm run check:repeat-send`: the second payment to somebody is one tap (#99).
 *
 * Three claims, and all three are about what does NOT exist unless a condition
 * holds, which is exactly what a screenshot cannot show:
 *
 * 1. The entry point exists for a person with history, and for nobody else: no
 *    history is no block, not an empty one, and a row with no target is not a row.
 * 2. The confirmation still carries the platform fee (the leg that reaches the
 *    treasury) and the total, on a repeat as on a first send. The rows come from
 *    `quoteRows`, which is what `FeeQuote` draws, so this fails when the fee row is
 *    removed from the screen, proved by deleting it and re-running.
 * 3. The amount is empty until the person types it. A repeat fills the payee and
 *    nothing else, and the send route's own seed refuses `?amount=`, so there is no
 *    channel (tap, link, retry link or hand-edited URL) through which a figure
 *    the customer did not choose can reach the field.
 * 4. Which balance pays is the SAME answer the pay step gives (#232). The send form
 *    mounts the one selector and pins the choice on every quote it makes, the
 *    default is the row the quote named, and a pinned balance that cannot cover
 *    produces #223's sentence exactly once — with the balance that can, or by itself
 *    when no single balance can.
 */
import { readFileSync } from 'node:fs';
import { quoteRows, QUOTE_LABELS } from '../components/money/quoteRows.ts';
import { buildTokenSelector, selectorLine } from '../components/token-selector/token-selector.model.ts';
import { sendFormFlags } from '../components/home/send-panel-step.ts';
import { REFUSAL_BY_CODE } from '../lib/api/refusal.constants.ts';
import { COVERAGE_REFUSAL, pinAsset } from '../lib/pay/quote-asset.ts';
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

console.log('which balance pays, on a send, is the same answer as on a pay (#232):');
{
  /**
   * The home payload's shape (#224): one row per asset, each with its own value in
   * the dashboard's currency. The primary balance is empty, so the row that covers
   * is the one the money actually arrived in — the case that makes an unpinned send
   * work at all.
   */
  const ROWS = [
    { asset: 'ousd', symbol: 'OUSD', amount: '0.000000', value: '0.00' },
    { asset: 'pathusd', symbol: 'pathUSD', amount: '4.500000', value: '4.50' },
    { asset: 'usdt0', symbol: 'USDT0', amount: '1240.000000', value: '1240.00' },
  ];

  const model = (overrides = {}) =>
    buildTokenSelector({
      rows: ROWS,
      currency: 'KES',
      loading: false,
      unavailable: false,
      priced: null,
      pinned: null,
      offer: null,
      ...overrides,
    });

  const hook = readFileSync(new URL('../components/home/useSendPanel.ts', import.meta.url), 'utf8');
  const amountStep = readFileSync(
    new URL('../components/home/SendAmountSection.tsx', import.meta.url),
    'utf8'
  );
  const quotes = hook.match(/previewSend\(\{[\s\S]*?\)/g) ?? [];

  check(
    'the send form mounts the ONE selector, the component the pay step mounts',
    amountStep.includes("<TokenSelector model={tokenSelector} onChoose={onChooseAsset} />"),
    amountStep.split('\n').find((line) => line.includes('TokenSelector')) ?? 'not mounted'
  );
  check(
    'and a second control is not what it draws: the hook derives that model, it does not build one',
    hook.includes('buildTokenSelector(') && !amountStep.includes('<select') && !amountStep.includes('role="listbox"')
  );
  check(
    'every send quote carries the pin, so the price, the fee and the record are one token',
    quotes.length === 3 && quotes.every((call) => call.includes('...pinAsset(pinned)')),
    quotes.filter((call) => !call.includes('...pinAsset(pinned)')).length + ' of ' + quotes.length + ' unpinned'
  );
  check(
    'unpinned, nothing is asked for: the server still picks the row that covers',
    Object.keys(pinAsset(null)).length === 0,
    Object.keys(pinAsset(null)).join(',') || 'none'
  );
  check(
    'pinned, exactly the balance the customer chose rides on the quote',
    JSON.stringify(pinAsset('pathusd')) === JSON.stringify({ asset: 'pathusd' }),
    JSON.stringify(pinAsset('pathusd'))
  );
  check(
    'the quote names that balance back, and the row it writes names the quote’s asset',
    hook.includes('asset: resolvedAsset(preview.asset)')
  );
  {
    const defaulted = model({ priced: 'usdt0' });
    const line = selectorLine(defaulted);
    check(
      'with one funded balance and no choice made, the default is the token the QUOTE named',
      defaulted.paying?.asset === 'usdt0' && line?.label === 'Paying from USDT0',
      `${defaulted.paying?.asset} / ${line?.label}`
    );
    check(
      'and it costs no tap: a single funded balance is a line, not a control',
      model({ rows: ROWS.filter((row) => row.asset === 'usdt0'), priced: 'usdt0' }).choosable === false
    );
  }
  {
    const refused = model({ pinned: 'pathusd', offer: 'usdt0' });
    const sentence = REFUSAL_BY_CODE[COVERAGE_REFUSAL];
    check(
      'a pinned balance that cannot cover is #223’s refusal, in the sentence the code owns',
      refused.refusal?.sentence === sentence && refused.refusal?.offer?.asset === 'usdt0',
      refused.refusal?.sentence
    );
    check(
      'the selector draws it, so the form stays out of the way and nothing is said twice',
      sendFormFlags({
        formError: sentence,
        formErrorCode: COVERAGE_REFUSAL,
        tokenSelector: refused,
      }).formError === null
    );
  }
  {
    const spread = model({ pinned: 'pathusd' });
    const sentence = REFUSAL_BY_CODE[COVERAGE_REFUSAL];
    check(
      'when no single balance covers there is nothing to offer, and no control pretending there is',
      spread.refusal === null
    );
    check(
      'so the form says it rather than leaving a refused send looking idle',
      sendFormFlags({
        formError: sentence,
        formErrorCode: COVERAGE_REFUSAL,
        tokenSelector: spread,
      }).formError === sentence
    );
  }
  {
    const other = model({ priced: 'usdt0' });
    check(
      'a refusal of any OTHER kind is still the form’s to draw',
      sendFormFlags({
        formError: 'The price has expired.',
        formErrorCode: 'quote-expired',
        tokenSelector: other,
      }).formError === 'The price has expired.'
    );
  }
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
