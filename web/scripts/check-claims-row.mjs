/**
 * `npm run check:claims-row` — the claim row says what it is, and offers an action only when one exists.
 *
 * The defect this exists for is the one a screenshot cannot show: a row for a settled or withdrawn claim
 * that still offers `Withdraw`. That reads as a customer having a choice they do not have, and the only
 * thing the control can produce is a refusal. The state words are the other half — a claim's four states
 * must all be speakable, or a screen reader hears a row with no status.
 *
 * Four claims:
 *
 *  1. Every state has a word, and the word is not the enum's spelling.
 *  2. Only `open` offers an action.
 *  3. A settled claim does not read as waiting, and a lapsed one does not read as open.
 *  4. The figure is rendered tabular, because a list of amounts that jitters is not a ledger.
 *
 * Run from `web/`: npm run check:claims-row (part of the root `verify` gate).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClaimRow } from '../components/activity/ClaimRow.tsx';
import { CLAIM_STATE_LABEL, isOpen } from '../components/activity/Claims.constants.ts';

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

const claim = (status) => ({
  publicId: '8f2c1a4e7b9d0e51aa',
  destinationHandle: 'akinyi',
  amount: '1500.00',
  currency: 'KES',
  memo: 'Rent, half of it',
  status,
  createdAt: '2026-11-01T09:00:00.000Z',
  expiresAt: '2026-12-01T09:00:00.000Z',
  settledTxHash: null,
});

const render = (status) =>
  renderToStaticMarkup(
    createElement(ClaimRow, { claim: claim(status), withdrawing: false, onWithdraw: () => undefined })
  );

console.log('every state is speakable:');
for (const status of ['open', 'settled', 'cancelled', 'expired']) {
  check(`${status} has a word`, typeof CLAIM_STATE_LABEL[status] === 'string' && CLAIM_STATE_LABEL[status].length > 0);
}
check('the words are the customer’s, not the enum’s', CLAIM_STATE_LABEL.cancelled === 'Withdrawn', CLAIM_STATE_LABEL.cancelled);

console.log('only an open claim asks for anything:');
{
  check('open can be withdrawn', isOpen('open'));
  for (const status of ['settled', 'cancelled', 'expired']) {
    check(`${status} cannot`, !isOpen(status));
  }

  /* The LABEL, not the substring: a withdrawn claim's state word contains "Withdraw", and a
     substring test would fail on the row that is behaving correctly. */
  check('the open row renders a control', render('open').includes('>Withdraw<'));
  for (const status of ['settled', 'cancelled', 'expired']) {
    check(`the ${status} row does not`, !render(status).includes('>Withdraw<'));
  }
}

console.log('a row cannot be read as the wrong state:');
{
  check('settled is not waiting', !render('settled').includes('Waiting'));
  check('expired is not open', !render('expired').includes('Waiting'));
  check('withdrawn says so', render('cancelled').includes('Withdrawn'));
}

console.log('the money reads like money:');
{
  const html = render('open');

  check('the figure carries the currency', html.includes('KES 1,500.00'), html.slice(0, 120));
  check('in tabular digits', html.includes('font-tabular'));
  check('with the memo under it', html.includes('Rent, half of it'));
}

console.log(`\n${passed} assertions passed.`);
if (failed > 0) {
  console.log(`${failed} FAILED.`);
  process.exit(1);
}
