/**
 * `npm run check:receipt` — the receipt says which token moved (#238).
 *
 * The receipt is the artefact a customer keeps, quotes to support and hands to an
 * accountant, and it was the last surface where the token model disappeared: the
 * document carried `asset` on every figure, the activity detail row printed it, and
 * the card said only "KES 500.00". So this is a RENDERING check, not a payload
 * check: the claim is about what a customer is handed, and asserting it against the
 * document would pass while the component printed nothing at all.
 *
 * Four things are pinned:
 *
 *  1. **The word is Home's word.** `assetName` is compared against `TEMPO_ASSETS`,
 *     the table the balance rows are read from, for every supported asset — so the
 *     two surfaces cannot spell one token two ways, and a symbol added to the table
 *     without the receipt's map fails here.
 *  2. **It renders, under the figure.** The real `ReceiptCard` is rendered to the
 *     HTML a browser with no JavaScript receives, and the header's text is read back
 *     out of it: the word, the fiat figure, then the token line.
 *  3. **Absent stays absent.** A row written before the asset was recorded renders
 *     exactly the header it rendered before this line existed — no dash, no
 *     "undefined" — and the exported text has no stray line either.
 *  4. **Named once.** A receipt whose figure is already a token amount does not print
 *     the symbol twice; an inbound receipt names it the same way as an outgoing one.
 *
 * Run from `web/`: npm run check:receipt (part of the root `verify` gate).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReceiptCard } from '../components/receipt/ReceiptCard.tsx';
import { RECEIPT_COPY } from '../components/receipt/Receipt.constants.ts';
import { buildReceiptText, deriveReceiptCard } from '../components/receipt/receipt.card.ts';
import { assetName } from '../components/receipt/receipt.format.ts';
import { TEMPO_ASSETS } from '../lib/chain/chain.assets.ts';

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

const HASH = `0x${'ab'.repeat(32)}`;
const CUSTOMER = '0x9999999999999999999999999999999999999999';
const MERCHANT = '0x1111111111111111111111111111111111111111';
const TREASURY = '0x2222222222222222222222222222222222222222';

/**
 * A receipt document shaped the way `GET /transactions/:id/receipt` returns one:
 * a payment leg, a fee leg and a gas leg in one token, one fiat figure for the row.
 */
function documentOf(asset = 'usdt0') {
  return {
    hash: HASH,
    network: 'testnet',
    networkLabel: 'Practice',
    blockNumber: 4711023,
    timestamp: '2026-10-13T11:32:00.000Z',
    status: 'confirmed',
    from: CUSTOMER,
    legs: [
      {
        index: 1,
        role: 'payment',
        label: 'Java House, Westlands',
        asset,
        tokenAddress: '0x20c00000000000000000000014f22ca97301eb73',
        from: CUSTOMER,
        to: MERCHANT,
        amount: '3.861004',
        mine: true,
      },
      {
        index: 2,
        role: 'platform-fee',
        label: 'Platform fee',
        asset,
        tokenAddress: '0x20c00000000000000000000014f22ca97301eb73',
        from: CUSTOMER,
        to: TREASURY,
        amount: '0.077220',
        mine: true,
      },
    ],
    networkFee: { asset, amount: '0.000027', fiatAmount: '0.35' },
    total: { asset, amount: '3.938251', fiatAmount: '510.00', fiatCurrency: 'KES' },
    ledger: {
      direction: 'out',
      fiatAmount: 500,
      fiatCurrency: 'KES',
      platformFeeFiat: 10,
      fxRate: 129.5,
      fxRateSource: 'test',
      fxRateAsOf: '2026-10-13T11:32:00.000Z',
      title: 'Java House, Westlands',
    },
    explorerUrl: `https://explorer.tempo.xyz/tx/${HASH}`,
  };
}

/** The same document as a row written before the asset was stored on any figure. */
function legacyOf(asset = 'usdt0') {
  const legacy = documentOf(asset);
  for (const leg of legacy.legs) delete leg.asset;
  delete legacy.total.asset;
  delete legacy.networkFee.asset;
  return legacy;
}

/** The card as a browser that has not run any JavaScript receives it. */
function renderCard(document) {
  const card = deriveReceiptCard(document, null);
  const html = renderToStaticMarkup(createElement(ReceiptCard, { card, shareUrl: null }));
  return { card, html };
}

/** The header's text, in document order, with the markup stripped. */
function headerText(html) {
  const start = html.indexOf('<header');
  const end = html.indexOf('</header>');
  if (start < 0 || end < 0) return null;
  return html
    .slice(start, end)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

console.log('the word is the one Home uses for the same asset:');
for (const entry of TEMPO_ASSETS) {
  check(
    `${entry.asset} is printed as the registry symbol Home prints`,
    assetName(entry.asset) === entry.symbol,
    `${assetName(entry.asset)} vs ${entry.symbol}`
  );
}
check(
  'a symbol the map has never seen is still not invented',
  assetName('xyzzy') === 'XYZZY',
  assetName('xyzzy')
);

console.log('\nthe card renders it, under the amount:');
{
  const { card, html } = renderCard(documentOf('usdt0'));
  const text = headerText(html);

  check('the card carries a token line', card.assetLine === `${RECEIPT_COPY.assetPrefix} USDT0`, String(card.assetLine));
  check('the amount line itself still names no token', !card.figure.includes('USDT0'), card.figure);
  check(
    'the header reads: the word, then the figure, then the token',
    text === `${card.word} ${card.figure} ${card.assetLine}`,
    text
  );
  check('and the token line is in the markup a browser receives', html.includes(card.assetLine));

  const other = renderCard(documentOf('pathusd'));
  check(
    'a second token is named by its own word, not the first one',
    headerText(other.html) === `${other.card.word} ${other.card.figure} ${RECEIPT_COPY.assetPrefix} pathUSD`,
    headerText(other.html)
  );

  /**
   * The mutation, stated as an assertion: the same card with the token line dropped
   * is exactly what this check would report. If the render is deleted, the header
   * above loses the line and fails.
   */
  const stripped = renderToStaticMarkup(
    createElement(ReceiptCard, { card: { ...card, assetLine: null }, shareUrl: null })
  );
  check(
    'dropping the token line changes the header, so the assertion bites',
    headerText(stripped) !== text && !headerText(stripped).includes('USDT0'),
    headerText(stripped)
  );
}

console.log('\na row with no asset renders exactly as it did before:');
{
  const { card, html } = renderCard(legacyOf('usdt0'));
  const text = headerText(html);

  check('no token line is derived', card.assetLine === null, String(card.assetLine));
  check('the header is the word and the figure, nothing else', text === `${card.word} ${card.figure}`, text);
  check('no "undefined" in the markup', !html.includes('undefined'));
  check('no dash standing in for a token', !text.includes('—') && !text.includes(assetName('usdt0')));
}

console.log('\nthe token is named exactly once:');
{
  const noFiat = documentOf('usdt0');
  noFiat.ledger.fiatAmount = 0;
  noFiat.ledger.fiatCurrency = null;
  noFiat.total.fiatCurrency = null;

  const { card, html } = renderCard(noFiat);
  const text = headerText(html);

  check('the figure falls back to the token amount', card.figure.includes(assetName('usdt0')), card.figure);
  check('and no second line repeats the symbol', card.assetLine === null, String(card.assetLine));
  check('so the header names it once', countOf(text, assetName('usdt0')) === 1, text);

  const inbound = documentOf('usdt0');
  inbound.ledger.direction = 'in';
  const inboundCard = renderCard(inbound);
  check(
    'an inbound receipt names it the same way, with no direction claim',
    inboundCard.card.word === RECEIPT_COPY.received &&
      headerText(inboundCard.html) ===
        `${inboundCard.card.word} ${inboundCard.card.figure} ${RECEIPT_COPY.assetPrefix} USDT0`,
    headerText(inboundCard.html)
  );
}

console.log('\nthe exported text carries it too, because that copy leaves the app:');
{
  const { card } = renderCard(documentOf('usdt0'));
  const lines = buildReceiptText(documentOf('usdt0'), null).split('\n');

  check('the export has the token on its own line', lines.includes(`${RECEIPT_COPY.assetPrefix} USDT0`));
  check('in the card\u2019s own words', lines.includes(`${RECEIPT_COPY.assetPrefix} ${assetName('usdt0')}`));
  check('directly under the figure', lines[lines.indexOf(card.figure) + 1] === `${RECEIPT_COPY.assetPrefix} USDT0`);

  const legacyLines = buildReceiptText(legacyOf('usdt0'), null).split('\n');
  check('and a legacy export gains no line at all', !legacyLines.some((line) => line.startsWith(`${RECEIPT_COPY.assetPrefix} `)));
  check('and no "undefined" in it', !legacyLines.some((line) => line.includes('undefined')));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
