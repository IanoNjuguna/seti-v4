/**
 * `npm run check:pay-flags` — does the pay step say a refusal, or does the selector?
 *
 * The coverage refusal has exactly one sentence and two places it can appear: the
 * token selector, beside the balance that can pay it, or the step, on its own. The
 * rule is not "who owns the code" but "is anything else drawing it", and it has now
 * been got wrong once: `merchantPayStepFlags` suppressed on the code alone, the
 * selector drew nothing in the spread case (no pin, no offer), and a refused payment
 * showed a pressable `Pay` with no reason above it (#235).
 *
 * So this asks the pure function directly, once per case, and pins the pairing:
 *
 *  1. **Pinned and short, with an offer.** The selector draws it, the step must not
 *     duplicate it.
 *  2. **Spread: no single balance covers.** Nothing is offered, so the STEP draws it,
 *     and the sentence is on the screen exactly once.
 *  3. **A balance problem.** That is the customer's entry and belongs on the field,
 *     not in a block message.
 *  4. **Any other refusal.** The step draws it, because the selector has no sentence
 *     for it.
 *
 * Run from `web/`: npm run check:pay-flags (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { merchantPayStepFlags } from '../components/pay/merchant-pay-step.ts';
import { COVERAGE_REFUSAL } from '../lib/pay/quote-asset.ts';
import { refusalMessageFor } from '../lib/api/refusal.constants.ts';

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

const SENTENCE = refusalMessageFor(COVERAGE_REFUSAL);

/**
 * The fields `merchantPayStepFlags` reads, and nothing else.
 *
 * A partial cast would let a field be missing and read as `undefined` at runtime, so
 * every case below states the ones that matter explicitly and the helper fills the
 * rest with values that cannot accidentally satisfy a refusal.
 */
function payment(overrides = {}) {
  return {
    amount: '500',
    isBusy: false,
    previewLoading: false,
    preview: { hasEnoughBalance: true },
    errorKind: null,
    error: null,
    errorCode: null,
    tokenSelector: { refusal: null },
    ...overrides,
  };
}

// 1. the selector is drawing it
{
  const flags = merchantPayStepFlags(
    payment({
      error: SENTENCE,
      errorCode: COVERAGE_REFUSAL,
      preview: { hasEnoughBalance: false },
      tokenSelector: { refusal: { sentence: SENTENCE, offer: 'ousd' } },
    })
  );
  check('the step stays out of the way when the selector draws the refusal', flags.blockError === null);
  // The server's balance verdict still governs `Pay`, and the selector beside it is
  // the thing that says why. What must not happen is a SECOND sentence, or a silent
  // control: those are the two assertions above and below this one.
  check('and the balance verdict still governs the control', flags.canPay === false);
}

// 2. nothing is drawing it
{
  const flags = merchantPayStepFlags(
    payment({
      error: SENTENCE,
      errorCode: COVERAGE_REFUSAL,
      preview: { hasEnoughBalance: false },
      tokenSelector: { refusal: null },
    })
  );
  check('the step draws the refusal when the selector has nothing to offer', flags.blockError === SENTENCE);
  check('so the screen never pairs a refusal with silence', flags.blockError === SENTENCE && flags.amountError === undefined);
}

// 3. a balance problem belongs on the field
{
  const flags = merchantPayStepFlags(
    payment({ error: 'Not enough OUSD to cover this payment.', errorKind: 'insufficient-funds' })
  );
  check('a balance problem is the field message, not a block', flags.amountError !== undefined && flags.blockError === null);
}

// 4. anything else
{
  const flags = merchantPayStepFlags(payment({ error: 'Nothing was sent.', errorCode: 'receipt-reverted' }));
  check('another refusal is drawn by the step', flags.blockError === 'Nothing was sent.');
}

check(
  'the step never suppresses on the code alone',
  !fixtureSource().includes('payment.errorCode === COVERAGE_REFUSAL;')
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

/** The step's own source, so the shortcut cannot come back unnoticed. */
function fixtureSource() {
  return readFileSync(new URL('../components/pay/merchant-pay-step.ts', import.meta.url), 'utf8');
}
