/**
 * Payment error classification checks.
 *
 * Run with:  npm run check:errors  (from mobile/)
 *
 * The gas case exists because Tempo pays network fees in the same stablecoin
 * the customer spends. A wallet can hold enough for the payment and still fail
 * once the fee is taken from what remains — and that must not surface as a
 * generic failure, or a precondition looks like a bug.
 *
 * These assertions pin the routing. They are pure functions, so no device,
 * wallet, or network is involved.
 */
import assert from 'node:assert/strict';

// Mirrors classifyPaymentError in usePayMerchant.ts. Duplicated deliberately:
// the hook imports React Native modules, so it cannot be imported in a plain
// Node check. Keep the two in step.
type PayErrorKind = 'insufficient-gas' | 'insufficient-funds' | 'rejected' | 'unknown';

function classifyPaymentError(error: unknown): { kind: PayErrorKind; message: string } {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const text = raw.toLowerCase();

  const gasMarkers = [
    'insufficient funds for gas',
    'insufficient gas',
    'gas required exceeds',
    'max fee per gas',
    'intrinsic gas too low',
    'could not satisfy max cost',
    'fee token',
  ];
  if (gasMarkers.some((m) => text.includes(m))) {
    return {
      kind: 'insufficient-gas',
      message: 'Not enough {ASSET} left to cover the network fee. Add a little, then try again.',
    };
  }

  if (text.includes('insufficient funds') || text.includes('exceeds balance')) {
    return {
      kind: 'insufficient-funds',
      message: 'Not enough {ASSET} to cover this payment.',
    };
  }

  if (
    text.includes('rejected') ||
    text.includes('denied') ||
    text.includes('user cancelled') ||
    text.includes('user canceled')
  ) {
    return { kind: 'rejected', message: 'Payment cancelled.' };
  }

  return {
    kind: 'unknown',
    message: error instanceof Error && error.message ? error.message : 'Payment failed. Please try again.',
  };
}

let count = 0;
function ok(label: string, fn: () => void): void {
  fn();
  count += 1;
  console.log(`ok    ${label}`);
}

const kindOf = (e: unknown) => classifyPaymentError(e).kind;

// --- Insufficient gas must be its own state -------------------------------

const gasCases = [
  'insufficient funds for gas * price + value',
  'Insufficient gas for intrinsic transaction cost',
  'gas required exceeds allowance',
  'max fee per gas less than block base fee',
  'intrinsic gas too low',
  'could not satisfy max cost (intrinsic gas too low)',
  'Fee token balance too low to cover the network fee',
];

for (const message of gasCases) {
  ok(`gas: ${message.slice(0, 46)}`, () => {
    assert.equal(kindOf(new Error(message)), 'insufficient-gas');
  });
}

// --- Ordering matters: gas must win over the generic funds case -----------

ok('"insufficient funds for gas" classifies as gas, not funds', () => {
  // Both substrings are present; the specific diagnosis has to win, or the
  // customer is told to top up their payment balance when they need only a
  // few cents of headroom for the fee.
  const result = classifyPaymentError(new Error('insufficient funds for gas * price + value'));
  assert.equal(result.kind, 'insufficient-gas');
  assert.ok(!result.kind.includes('funds'));
});

// --- Other causes keep their own classification ---------------------------

ok('plain insufficient funds is a payment-balance problem', () => {
  assert.equal(kindOf(new Error('insufficient funds for transfer')), 'insufficient-funds');
});

ok('exceeds balance is a payment-balance problem', () => {
  assert.equal(kindOf(new Error('ERC20: transfer amount exceeds balance')), 'insufficient-funds');
});

for (const message of ['User rejected the request', 'Request denied', 'user cancelled', 'User canceled']) {
  ok(`rejection: ${message}`, () => {
    assert.equal(kindOf(new Error(message)), 'rejected');
  });
}

ok('an unrecognised error falls through to unknown', () => {
  assert.equal(kindOf(new Error('something else entirely')), 'unknown');
});

ok('a non-Error throw does not crash the classifier', () => {
  assert.equal(kindOf(undefined), 'unknown');
  assert.equal(kindOf(null), 'unknown');
  assert.equal(kindOf('a bare string'), 'unknown');
  assert.equal(kindOf(42), 'unknown');
});

// --- Copy is presentable and names the asset ------------------------------

ok('gas copy names the asset via the {ASSET} placeholder', () => {
  const { kind, message } = classifyPaymentError(new Error('insufficient gas'));
  assert.equal(kind, 'insufficient-gas');
  assert.ok(message.includes('{ASSET}'), 'must interpolate the real token');

  const rendered = message.replace('{ASSET}', 'OUSD');
  assert.ok(!rendered.includes('{ASSET}'), 'placeholder must be substitutable');
  assert.ok(rendered.includes('OUSD'));
  assert.ok(rendered.includes('network fee'), 'must say what the shortfall is for');
});

ok('copy follows DESIGN.md: no exclamation marks', () => {
  const messages = [
    classifyPaymentError(new Error('insufficient gas')).message,
    classifyPaymentError(new Error('insufficient funds')).message,
    classifyPaymentError(new Error('rejected')).message,
    classifyPaymentError(new Error('boom')).message,
  ];
  for (const m of messages) {
    assert.ok(!m.includes('!'), `exclamation mark in: ${m}`);
  }
});

ok('gas copy is distinct from the funds copy', () => {
  const gas = classifyPaymentError(new Error('insufficient gas')).message;
  const funds = classifyPaymentError(new Error('insufficient funds')).message;
  assert.notEqual(gas, funds, 'the two states must not read identically');
});

console.log(`\n${count} assertions passed.`);
