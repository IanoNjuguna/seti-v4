/**
 * `npm run check:amount-privacy` — the mask's contract, and the guard on future figures.
 *
 * Three things a screenshot cannot show, and one that no reviewer reliably catches:
 *
 *  1. the mask is a FIXED six dots, never one per digit (the count leaks magnitude);
 *  2. the control names what it governs (`amounts`, not `balances`);
 *  3. every money figure in `components/home` consults the flag — a new row that
 *     prints money without it ships a visible amount on a screen the customer has
 *     cleared, and it would look perfectly fine in review;
 *  4. the provider is mounted in the app shell, and nothing is written to storage,
 *     because the privacy notice states that no such preference is stored.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  AMOUNT_MASK,
  AMOUNT_MASK_LABEL,
  AMOUNT_PRIVACY_COPY,
} from '../lib/privacy/amount-privacy.constants.ts';

const WEB = path.resolve(import.meta.dirname, '..');

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

function read(relPath) {
  return readFileSync(path.join(WEB, relPath), 'utf8');
}

console.log('the mask:');
check('six characters, whatever the amount is', AMOUNT_MASK.length === 6, `${AMOUNT_MASK.length}`);
check('all of them are the same dot', [...AMOUNT_MASK].every((character) => character === '•'));
check('it is announced as hidden, not as punctuation', AMOUNT_MASK_LABEL === 'hidden');
check('the control says amounts, not balances', AMOUNT_PRIVACY_COPY.hide === 'Hide amounts');
check('and its opposite is the reveal', AMOUNT_PRIVACY_COPY.show === 'Show amounts');

console.log('every money figure on Home consults the flag:');
{
  /**
   * Files in this folder that are NOT the Home screen. `SendResult` is the send
   * panel's confirmation: it prints what the customer just sent, which is the answer
   * to the action they took a second ago, and masking it would be the panel refusing
   * to tell them what happened. Everything else in this folder renders Home.
   */
  const NOT_HOME_SCREEN = new Set(['SendResult.tsx']);

  const dir = path.join(WEB, 'components/home');
  const money = readdirSync(dir)
    .filter((file) => file.endsWith('.tsx'))
    .filter((file) => /formatFiat\(|formatBalance\(/.test(read(`components/home/${file}`)));

  check('the scan finds the figures it is meant to guard', money.length >= 3, money.join(', '));

  for (const file of money.filter((name) => !NOT_HOME_SCREEN.has(name))) {
    const source = read(`components/home/${file}`);
    check(`${file} uses useAmountPrivacy`, source.includes('useAmountPrivacy'));
  }
}

console.log('the flag lives in the shell, and is not stored:');
{
  const layout = read('app/(product)/app/layout.tsx');
  check('the provider is mounted in the app layout', layout.includes('AmountPrivacyProvider'));

  const context = read('lib/privacy/amount-privacy.context.tsx');
  check('no localStorage', !context.includes('localStorage'));
  check('no sessionStorage', !context.includes('sessionStorage'));
  check('no cookie', !context.includes('cookie'));
  check(
    'a component outside the provider fails loudly rather than showing amounts',
    context.includes('useAmountPrivacy must be used inside AmountPrivacyProvider')
  );
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
