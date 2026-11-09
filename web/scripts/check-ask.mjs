/**
 * `npm run check:ask` — the claim screen's amount is a field, not a keypad (#513).
 *
 * The grid was copied from the payment step, where a tap at a counter is the interaction. An ask is
 * a form: the payee, the note, the expiry, and an amount that is usually three digits. Under a field
 * that already opens the system keyboard, the grid was a second keyboard, half the page, and the
 * reason "Create claim" sat below the fold.
 *
 * It stays on the payment step (`MerchantAmountSection`), so this suite holds both ends: the ask
 * draws no keys, and the pay step still does. The second half is the amount's SHAPE, which the grid
 * used to enforce at the key and which a typed value now has to be checked against before the submit
 * is offered.
 *
 * Run from `web/`: npm run check:ask (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskFigure } from '../components/ask/AskFigure.tsx';
import {
  ASK_AMOUNT_PATTERN,
  ASK_REFUSALS,
  isValidAskAmount,
} from '../components/ask/ask.constants.ts';

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

const figure = renderToStaticMarkup(
  createElement(AskFigure, { amount: '50', disabled: false, onAmount: () => {}, error: null })
);

console.log('the ask draws a figure, and no keys:');

check('no digit key is rendered', !/<button/.test(figure), figure.slice(0, 120));
check('no keypad group is labelled', !/Amount keypad/.test(figure));
check('the amount is a real input', /<input/.test(figure));
check('and it asks for a decimal keyboard', /inputmode="decimal"/i.test(figure));
check('the currency sits beside the figure', /KES/.test(figure));
check('a typed figure reaches the markup', /value="50"/.test(figure));

console.log('\nand the pay step keeps its keypad, where the tap is the interaction:');
{
  const merchant = read('../components/pay/MerchantAmountSection.tsx');
  check('the pay step still renders the grid', /<PayKeypad/.test(merchant));
  const ask = read('../components/ask/AskFigure.tsx');
  check(
    'the ask no longer imports it',
    !/PayKeypad/.test(ask.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/gm, '')),
    'PayKeypad appears in AskFigure'
  );
}

console.log('\nthe amount keeps the shape the keypad used to enforce:');
{
  /* `07` is here on purpose: the keypad never BUILT that string, but the service accepts it, and a
     client rule stricter than the server's would refuse an amount the ask can be created for. */
  const valid = ['5', '50', '50.25', '0.5', '07', '123456789', '999999999.99'];
  const invalid = ['', ' ', '0', '0.00', '1.234', '12.', '.5', '1e9', '1234567890', '-5'];

  check(
    'every figure the service accepts passes',
    valid.every((amount) => isValidAskAmount(amount)),
    valid.filter((amount) => !isValidAskAmount(amount)).join(', ')
  );
  check(
    'and every figure it refuses is refused here too',
    invalid.every((amount) => !isValidAskAmount(amount)),
    invalid.filter((amount) => isValidAskAmount(amount)).join(', ')
  );
  check(
    'the pattern is the service\u2019s, not a looser one',
    ASK_AMOUNT_PATTERN.source === '^[0-9]{1,9}(\\.[0-9]{1,2})?$',
    ASK_AMOUNT_PATTERN.source
  );
  check(
    'a refused amount has a sentence, which is the refusal\u2019s own',
    /two decimals/.test(ASK_REFUSALS['amount-invalid'] ?? ''),
    ASK_REFUSALS['amount-invalid']
  );
}

console.log('\nthe form says why, rather than greying its only action:');
{
  const hook = read('../components/ask/useAsk.ts');
  const screen = read('../components/ask/AskScreen.tsx');
  check('the hook answers an amount error', /amountError:/.test(hook));
  check('the form refuses to submit an invalid amount', /canSubmit:[\s\S]{0,120}amountValid/.test(hook));
  check('and the figure prints that error', /ask\.amountError \?\? ask\.error/.test(screen));
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
