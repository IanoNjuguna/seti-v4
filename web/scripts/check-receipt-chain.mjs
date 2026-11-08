/**
 * `npm run check:receipt-chain` — the chain detail on a receipt (#406).
 *
 * The defect this exists for is an absence: #407 took the indexer strip off every Activity row
 * (right), and the transaction hash then appeared NOWHERE in the product — not in the sheet, not in
 * the text export. A customer who wanted to check a transfer against the chain, or hand the hash to
 * somebody who would, had nothing to hand over.
 *
 * Five things are pinned, against the REAL card and the REAL text export:
 *
 *  1. **The hash is on the card**, in full — a shortened hash proves nothing to a person pasting it
 *     into an explorer.
 *  2. **Both ends and the asset are there**, full, and they come from the PAYMENT leg rather than
 *     from the transaction's sender: on a batched payment the sender is the settlement account.
 *  3. **The text export carries the same block**, because the printed or saved copy is the one that
 *     survives a screenshot.
 *  4. **A receipt with no hash renders no chain block at all**, rather than a heading over nothing.
 *  5. **A row that recorded no asset omits the asset line** rather than inventing one.
 *
 * Run from `web/`: npm run check:receipt-chain (part of the root `verify` gate).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReceiptChain } from '../components/receipt/ReceiptChain.tsx';
import { deriveReceiptCard, buildReceiptText } from '../components/receipt/receipt.card.ts';
import { RECEIPT_COPY } from '../components/receipt/Receipt.constants.ts';

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

const HASH = '0x9f2be51d63a7c4c0f1b7de2b5f0f4a1c3d6e8b9a0c2d4e6f8a1b3c5d7e9f0a1b';
const CUSTOMER = '0x5e0812aC9B7F43De0B0C9d6dA2b4b0e4C6f5a7B2';
const PAYEE = '0xD41aA2c3B4d5E6f708192a3B4c5D6e7F8091a2B3';
const SETTLEMENT = '0x00000000000000000000000000000000000000Fe';

/** A confirmed outbound payment, shaped exactly as `GET /transactions/:id/receipt` answers. */
const RECEIPT = {
  hash: HASH,
  network: 'testnet',
  networkLabel: 'Practice',
  blockNumber: 1234,
  timestamp: '2026-11-08T09:30:00.000Z',
  status: 'confirmed',
  // The transaction's sender is NOT the customer on a batched payment: the payment leg is.
  from: SETTLEMENT,
  legs: [
    { index: 1, role: 'payment', label: 'Recipient', asset: 'ousd', tokenAddress: '0x1', from: CUSTOMER, to: PAYEE, amount: '500000000', mine: true },
    { index: 2, role: 'platform-fee', label: 'Platform fee', asset: 'ousd', tokenAddress: '0x1', from: CUSTOMER, to: SETTLEMENT, amount: '10204081', mine: true },
  ],
  networkFee: { asset: 'ousd', amount: '1000', fiatAmount: null },
  total: { asset: 'ousd', amount: '510204081', fiatAmount: '510.20', fiatCurrency: 'KES' },
  ledger: { direction: 'out', fiatAmount: 500, fiatCurrency: 'KES', platformFeeFiat: 10, fxRate: 1, fxRateSource: 'test', fxRateAsOf: null, title: 'Payment' },
  explorerUrl: `https://explore.tempo.xyz/tx/${HASH}`,
};

const card = deriveReceiptCard(RECEIPT, 'KES');
const markup = renderToStaticMarkup(createElement(ReceiptChain, { chain: card.chain }));

console.log('\nthe hash is on the document, whole:\n');
{
  check('the card carries a chain block', card.chain !== null);
  check('the hash is printed in full', markup.includes(HASH), HASH.slice(0, 12));
  check('and is not elided', !markup.includes('…'));
}

console.log('\nboth ends, from the payment leg, plus the asset:\n');
{
  check('the sender shown is the payment leg\'s', card.chain.from === CUSTOMER.toLowerCase() || card.chain.from === CUSTOMER, card.chain.from);
  check('not the transaction\'s own sender', card.chain.from !== SETTLEMENT, card.chain.from);
  check('the recipient is printed in full', markup.includes(PAYEE));
  check('so is the sender', markup.includes(CUSTOMER));
  check('the asset is named', card.chain.asset === 'ousd' && markup.includes('ousd'));
  check('each value has its label', [RECEIPT_COPY.chainHash, RECEIPT_COPY.chainFrom, RECEIPT_COPY.chainTo, RECEIPT_COPY.chainAsset].every((label) => markup.includes(label)));
}

console.log('\nthe text export carries the same block:\n');
{
  const text = buildReceiptText(RECEIPT, 'KES');
  check('the export has the block title', text.includes(RECEIPT_COPY.chainTitle));
  check('with the full hash', text.includes(HASH));
  check('and both ends', text.includes(CUSTOMER) && text.includes(PAYEE));
  check('and the asset', text.includes(`ousd`));
}

console.log('\na row that cannot name a chain fact says nothing:\n');
{
  const noHash = deriveReceiptCard({ ...RECEIPT, hash: '' }, 'KES');
  check('no hash, no chain block', noHash.chain === null);

  const noAsset = deriveReceiptCard(
    { ...RECEIPT, legs: [{ ...RECEIPT.legs[0], asset: '' }], total: { ...RECEIPT.total, asset: '' } },
    'KES'
  );
  check('no asset, the asset line is absent rather than empty', noAsset.chain?.asset === null);
  const noAssetMarkup = renderToStaticMarkup(createElement(ReceiptChain, { chain: noAsset.chain }));
  check('and its label is not printed', !noAssetMarkup.includes(RECEIPT_COPY.chainAsset));
}

console.log('\n' + '-'.repeat(74));
if (failed > 0) {
  console.log(`${failed} CHECK(S) FAILED.`);
  process.exit(1);
}
console.log(`All ${passed} checks passed.`);
