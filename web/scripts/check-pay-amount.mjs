/**
 * `npm run check:pay-amount` — the amount is a figure with a keypad, not a form field (#440).
 *
 * The step used to draw `<Input label="Amount">`: a 48px labelled text box as the biggest element
 * on a payment screen, while every payment app in the reference set puts the figure at display size
 * with a keypad under it. This suite pins the three parts of that change that can silently rot:
 *
 *  1. **The arithmetic.** `applyKey` is a pure function, so the rules that keep an amount a number
 *     are tested directly: one decimal point, two decimals, no leading zero, a cap, and a backspace
 *     that cannot throw on an empty string.
 *  2. **The controls.** Twelve keys, every one `type="button"` (inside a form a default submit
 *     button is how a decimal point becomes a payment), the backspace named for a screen reader.
 *  3. **The order on the step.** Figure, then the keypad, then the token (whose row carries the
 *     balance the amount has to fit inside), then the quote.
 *
 * Run from `web/`: npm run check:pay-amount (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyKey } from '../components/pay/pay-keypad.ts';
import { PayAmountFigure, PayKeypad } from '../components/pay/PayAmount.tsx';
import { PAY_AMOUNT_COPY, PAY_FIGURE_CLASS, PAY_KEYPAD_KEYS } from '../components/pay/Pay.constants.ts';

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

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

console.log('the keypad builds a number, one key at a time:');
{
  check('digits append', applyKey('1', '2') === '12');
  check('a first zero is replaced, not doubled', applyKey('0', '7') === '7', applyKey('0', '7'));
  check('one decimal point only', applyKey('12.5', '.') === '12.5');
  check('a decimal point on an empty amount starts at zero', applyKey('', '.') === '0.');
  check('two decimals, and not a third', applyKey('12.34', '5') === '12.34', applyKey('12.34', '5'));
  check('backspace drops the last character', applyKey('12.34', 'back') === '12.3');
  check('backspace on empty stays empty', applyKey('', 'back') === '');
  check('nine integer digits, then no more', applyKey('123456789', '1') === '123456789');
  check('a key that is not a digit or the point changes nothing', applyKey('12', 'x') === '12');
}

console.log('\nthe keypad is twelve buttons that cannot submit:');
{
  const html = renderToStaticMarkup(
    createElement(PayKeypad, { id: 'pay-amount', amount: '', disabled: false, onAmount: () => {} })
  );

  check('twelve keys', (html.match(/<button/g) ?? []).length === 12, String((html.match(/<button/g) ?? []).length));
  check('every key is type="button"', (html.match(/type="button"/g) ?? []).length === 12);
  check(
    'the digits are all there, in order',
    PAY_KEYPAD_KEYS.map((k) => k.label).join('') === '123456789.0⌫',
    PAY_KEYPAD_KEYS.map((k) => k.label).join('')
  );
  check('the backspace is named for a screen reader', html.includes(`aria-label="${PAY_AMOUNT_COPY.backspace}"`));
  check('the grid is a group with a name', /role="group"[^>]*aria-label="Amount keypad"|aria-label="Amount keypad"[^>]*role="group"/.test(html));
  check('no key carries a fill at rest', !/bg-surface-soft(?![\s\S]{0,40}active:)/.test(html.replace(/active:bg-surface-soft/g, '')));
}

console.log('\nthe figure is a figure, and it is still typeable:');
{
  const html = renderToStaticMarkup(
    createElement(PayAmountFigure, {
      id: 'pay-amount',
      amount: '500',
      currency: 'KES',
      disabled: false,
      onAmount: () => {},
    })
  );

  check('it is a real input', /<input/.test(html));
  check('with a decimal keyboard on a touch device', /inputMode="decimal"|inputmode="decimal"/.test(html));
  check('it carries the amount', /value="500"/.test(html));
  check('and the quote currency beside it', /KES/.test(html));
  check(
    'at display size, not the small form-input size',
    /text-display-md/.test(PAY_FIGURE_CLASS),
    PAY_FIGURE_CLASS
  );
  check(
    'with no border: it is not a field to fill in',
    !/border|ring-1/.test(PAY_FIGURE_CLASS),
    PAY_FIGURE_CLASS
  );

  const unquoted = renderToStaticMarkup(
    createElement(PayAmountFigure, { id: 'pay-amount', amount: '', currency: '', disabled: false, onAmount: () => {} })
  );
  check('before a quote exists the unit is not invented', !/KES|USD/.test(unquoted));
}

console.log('\nthe step reads figure, balance, keypad, token, quote:');
{
  const section = read('../components/pay/MerchantAmountSection.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  const order = ['<PayAmountFigure', '<PayKeypad', '<TokenSelector', '<FeeQuote'];

  const positions = order.map((needle) => section.indexOf(needle));
  check(
    'in that order, and every part is present',
    positions.every((at) => at > -1) && positions.every((at, i) => i === 0 || at > positions[i - 1]),
    positions.join(' < ')
  );
  check(
    'the balance is not printed twice: the token row owns it',
    !/paying\.held/.test(section),
    'a second copy of the held figure'
  );
  check(
    'the labelled form input is gone',
    !/<Input/.test(section),
    'a form field survived on the pay step'
  );
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
