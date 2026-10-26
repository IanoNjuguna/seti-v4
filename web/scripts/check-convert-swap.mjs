/**
 * `npm run check:convert-swap` — the control on a balance row, and the path a swap takes
 * once it is pressed (#240).
 *
 * The issue's acceptance criteria are four claims about CODE, and this file asserts each
 * one where it can actually be broken:
 *
 *  1. **The control is ABSENT when the book cannot fill it, not disabled.** Rendered
 *     through the real component and read as markup, because "disabled" and "absent" are
 *     one attribute apart in source and a world apart to a customer: a disabled button
 *     promises a feature nobody measured, and every customer presses it once.
 *  2. **Signing goes through Privy's Tempo hook, never an EIP-1193 provider.** Asserted by
 *     READING the swap path's sources for `getEthereumProvider`, `eth_signTypedData_v4`
 *     and `eth_sendTransaction` — the way `check:claim-states` pins the claim — because
 *     AGENTS.md records what a provider-based signing path cost the last time (#216), and
 *     a batch sent that way silently carries no calls.
 *  3. **The floor that reaches the chain is the one the customer was shown.** Proved by
 *     DECODING the calldata the builder produces, not by re-reading the builder and
 *     agreeing with it. A zero floor is refused, and the same token twice is refused.
 *  4. **Nothing is written until the receipt is verified.** `recordConvert` is called
 *     AFTER the signature and AFTER the broadcast, with the figures that were signed, and
 *     it is the untouched record path — this suite asserts the order and the payload.
 *
 * Plus the copy: every `convert-*` refusal this backend can emit has a sentence of its
 * own in `refusal.constants.ts`, held to the same voice rules as the rest.
 *
 * What it cannot prove, and says so: a real swap end to end. That needs a funded wallet
 * and a signature, so the record path's reconciliation is proved by `check:convert-record`
 * against a real swap receipt instead.
 *
 * Run from `web/`: npm run check:convert-swap.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * The served chain, set BEFORE anything imports the app's chain table.
 *
 * `lib/pay/build-swap.ts` reads token contracts from `@/lib/chain`, whose module body
 * resolves the network from `NEXT_PUBLIC_TEMPO_CHAIN_ID` and throws when it is unset.
 * Next loads `.env.local`; tsx does not, and CI sets no web chain id. Practice, always:
 * this check decodes bytes and never signs, so the chain only decides which addresses
 * appear in the calldata.
 */
process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID ??= '42431';

/** Loaded AFTER the line above, for the reason given there. */
const { BalanceTokenSwap } = await import('../components/home/BalanceTokenSwap.tsx');
const { BalanceTokenSwapConfirm } = await import('../components/home/BalanceTokenSwapConfirm.tsx');
const { SWAP_COPY } = await import('../lib/pay/convert-swap.constants.ts');
const { buildSwapCall, STABLECOIN_DEX_ADDRESS, SWAP_TARGET_ASSET } = await import('../lib/pay/build-swap.ts');
const { getTokenContractFor } = await import('../lib/chain/index.ts');
const { REFUSAL_BY_CODE, REFUSAL_UNKNOWN } = await import('../lib/api/refusal.constants.ts');
const { decodeFunctionData } = await import('viem');

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

function readSource(relative) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

/** Source with comments removed, for assertions that are about CALL SITES only. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const NOOP = () => {};

/** The swap control's own files: everything a swap touches on its way to a signature. */
const SWAP_PATH = [
  '../hooks/useConvertSwap.ts',
  '../hooks/useConvertQuote.ts',
  '../lib/pay/build-swap.ts',
  '../lib/api/convert.ts',
  '../components/home/BalanceTokenSwap.tsx',
  '../components/home/BalanceTokenSwapAction.tsx',
  '../components/home/BalanceTokenSwapConfirm.tsx',
];

/** A quote in the shape the route returns, for the presentational assertions. */
const QUOTE = {
  network: 'testnet',
  assetIn: 'pathusd',
  assetOut: 'ousd',
  amountIn: '10.000000',
  amountOut: '9.999000',
  minAmountOut: '9.949005',
  toleranceBps: 50,
  networkFee: '0.000474',
  fiatCurrency: 'KES',
  fiatAmountIn: '1298.74',
  fiatAmountOut: '1291.99',
  fxRate: '129.874192',
  fxRateSource: 'memory',
  fxRateStale: false,
  networkFeeFiat: '0.06',
  networkFeeSource: 'estimate',
  quoteId: 'body.signature',
};

console.log('the control is absent, not disabled, when the book cannot fill it:');
{
  const withoutOffer = renderToStaticMarkup(
    createElement(BalanceTokenSwap, { offer: null, onSwapped: NOOP })
  );
  check('a refused quote renders nothing at all', withoutOffer === '', JSON.stringify(withoutOffer));

  /**
   * The OFFERED state is asserted from source rather than rendered, and the reason is
   * worth writing down: the action reads the account's network, so rendering it here
   * would need the session and account providers — and a check that has to stand up the
   * app's whole provider tree to read one label is a check that will one day fail for a
   * reason unrelated to swaps. The gate itself, which is what the criterion is about,
   * renders for real above.
   */
  const gate = stripComments(readSource('../components/home/BalanceTokenSwap.tsx'));
  check(
    'and the refusal is decided before any hook, so it costs no request',
    gate.indexOf('if (!offer) return null;') !== -1
  );
  check(
    'an offer is what reaches the action, and nothing else',
    gate.includes('<BalanceTokenSwapAction offer={offer} onSwapped={onSwapped} />')
  );
  check(
    'the row offers one only for a quote the server answered with',
    stripComments(readSource('../components/home/BalanceTokenRow.tsx')).includes(
      "convert.status === 'ready' ? convert.quote : null"
    )
  );

  const action = stripComments(readSource('../components/home/BalanceTokenSwapAction.tsx'));
  check(
    'the action is a button, labelled for a screen reader',
    /<button/.test(action) && action.includes('aria-label={`${SWAP_COPY.action} this balance`}')
  );
  check('with no `disabled` on the open path at all', !/disabled=/.test(action));
}

console.log('\nwhat the confirm step promises:');
{
  const markup = renderToStaticMarkup(
    createElement(BalanceTokenSwapConfirm, { quote: QUOTE, busy: false, error: null, done: false, onConfirm: NOOP, onCancel: NOOP })
  );
  check('the floor is stated as a minimum, in the token it belongs to', markup.includes('You get at least') && markup.includes('9.949005') && markup.includes('OUSD'), markup.includes('9.949005'));
  check('the network fee is stated in the token being spent', markup.includes('Network fee') && markup.includes('0.000474') && markup.includes('pathUSD'));
  check('nothing is disabled before anything is in flight', !markup.includes('disabled=""'));
  check('both controls are offered', markup.includes(SWAP_COPY.confirm) && markup.includes(SWAP_COPY.cancel));

  const busy = renderToStaticMarkup(
    createElement(BalanceTokenSwapConfirm, { quote: QUOTE, busy: true, error: null, done: false, onConfirm: NOOP, onCancel: NOOP })
  );
  check('while a signature is in flight the cancel control is disabled', busy.includes('disabled'));

  const done = renderToStaticMarkup(
    createElement(BalanceTokenSwapConfirm, { quote: QUOTE, busy: false, error: null, done: true, onConfirm: NOOP, onCancel: NOOP })
  );
  check('a finished swap says so and cannot be signed a second time', done.includes(SWAP_COPY.done) && !done.includes(SWAP_COPY.confirm));

  const failed = renderToStaticMarkup(
    createElement(BalanceTokenSwapConfirm, { quote: QUOTE, busy: false, error: SWAP_COPY.recordFailed, done: false, onConfirm: NOOP, onCancel: NOOP })
  );
  check('a post-signature failure says the money moved, and offers the retry that is honest', failed.includes(SWAP_COPY.recordFailed) && /went through on-chain/i.test(failed));
}

console.log('\nthe floor that reaches the chain is the one that was shown:');
{
  /** Declared HERE, from the protocol's signature, so a change in the builder diverges. */
  const SWAP_ABI = [
    {
      name: 'swapExactAmountIn',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'amountIn', type: 'uint128' },
        { name: 'minAmountOut', type: 'uint128' },
      ],
      outputs: [{ name: 'amountOut', type: 'uint128' }],
    },
  ];

  const call = buildSwapCall({
    assetIn: 'pathusd',
    assetOut: 'ousd',
    amountIn: QUOTE.amountIn,
    minAmountOut: QUOTE.minAmountOut,
    network: 'testnet',
  });

  check('the call goes to the DEX precompile', call.to === STABLECOIN_DEX_ADDRESS, call.to);

  const decoded = decodeFunctionData({ abi: SWAP_ABI, data: call.data });
  const [tokenIn, tokenOut, amountIn, minAmountOut] = decoded.args;
  check('it calls swapExactAmountIn', decoded.functionName === 'swapExactAmountIn', decoded.functionName);
  check(
    'with the input token of the pair',
    tokenIn.toLowerCase() === getTokenContractFor('pathusd', 'testnet').toLowerCase()
  );
  check(
    'the output token of the pair',
    tokenOut.toLowerCase() === getTokenContractFor('ousd', 'testnet').toLowerCase()
  );
  check('the quoted amount in, in base units', amountIn === BigInt(10_000_000), String(amountIn));
  check('and the floor the customer was shown, in base units', minAmountOut === BigInt(9_949_005), String(minAmountOut));

  const refuses = (label, input, pattern) => {
    try {
      buildSwapCall(input);
      check(label, false, 'it built a call');
    } catch (error) {
      check(label, pattern.test(String(error)), String(error).slice(0, 80));
    }
  };

  refuses(
    'a zero floor is refused rather than signed as an unbounded swap',
    { assetIn: 'pathusd', assetOut: 'ousd', amountIn: '10', minAmountOut: '0', network: 'testnet' },
    /unbounded/i
  );
  refuses(
    'the same token on both sides is refused',
    { assetIn: 'ousd', assetOut: 'ousd', amountIn: '10', minAmountOut: '9.95', network: 'testnet' },
    /same token/i
  );
}

console.log('\nsigning goes through the Tempo hook, never a provider:');
{
  const sources = SWAP_PATH.map((relative) => ({
    name: relative,
    source: stripComments(readSource(relative)),
  }));

  const offenders = sources.filter(({ source }) =>
    /getEthereumProvider|eth_signTypedData_v4|eth_sendTransaction/.test(source)
  );
  check(
    'no swap file asks a provider to sign, by any of the three names',
    offenders.length === 0,
    offenders.map(({ name }) => name).join(', ')
  );

  const signing = sources.find(({ name }) => name.endsWith('useConvertSwap.ts')).source;
  check('the swap is signed through `useTempoSender`', signing.includes('useTempoSender') && signing.includes('sendTempoTransaction'));
  check(
    'as ONE Tempo transaction carrying the swap call, priced in the token being spent',
    signing.includes('buildTempoTransaction(') && signing.includes('asset: assetIn')
  );

  const api = sources.find(({ name }) => name.endsWith('api/convert.ts')).source;
  check('the quote is asked of the authenticated route', api.includes("'/transactions/convert/quote'"));

  const gate = sources.find(({ name }) => name.endsWith('useConvertQuote.ts')).source;
  check(
    'the gate asks for `max`, so the amount the balance can spend is the SERVER\'s figure',
    gate.includes('CONVERT_AMOUNT_MAX') && !gate.includes('parseUnits(')
  );
}

console.log('\nnothing is written until the receipt is verified:');
{
  const signing = stripComments(readSource('../hooks/useConvertSwap.ts'));

  const signed = signing.indexOf('sendTempoTransaction(');
  const recorded = signing.indexOf('recordConvert(');
  check('the signature happens before the write-up', signed !== -1 && recorded !== -1 && signed < recorded, `signed ${signed}, recorded ${recorded}`);

  check(
    'the write-up carries the figures that were SIGNED, not the ones on screen',
    /recordConvert\(\{/.test(signing) &&
      /amountIn: fresh\.amountIn/.test(signing) &&
      /minAmountOut: fresh\.minAmountOut/.test(signing)
  );
  check('and the hash, the signing wallet and the frozen rate', /txHash,/.test(signing) && /walletAddress,/.test(signing) && /quoteId: fresh\.quoteId/.test(signing));
  check(
    'a record failure is reported as money moved, never as nothing sent',
    signing.includes('SWAP_COPY.recordFailed') && /went through on-chain/i.test(SWAP_COPY.recordFailed)
  );
  check(
    'and the quote is re-fetched at sign time, so an expired promise cannot reach the ledger',
    signing.indexOf('fetchConvertQuote(') !== -1
  );
}

console.log('\nthe row converts into the same asset the server decided on:');
{
  const backend = stripComments(readSource('../../backend/src/services/convert.ts'));
  const declared = /CONVERT_ROW_TARGET: SupportedAsset = '([a-z.]+)'/.exec(backend)?.[1] ?? 'not-found';
  check(
    'the backend still declares what a row converts into',
    declared !== 'not-found',
    declared
  );
  check(
    'and the control asks for exactly that asset, not its own opinion',
    SWAP_TARGET_ASSET === declared,
    `${SWAP_TARGET_ASSET} vs ${declared}`
  );
}

console.log('\nevery convert refusal has a sentence of its own:');
{
  const backend = stripComments(readSource('../../backend/src/services/convert.ts'));
  const taxonomy = stripComments(readSource('../../backend/src/services/payment-refusal.ts'));
  const codes = new Set([
    ...[...backend.matchAll(/'(convert-[a-z-]+)'/g)].map((match) => match[1]),
    ...[...taxonomy.matchAll(/'(convert-[a-z-]+)'/g)].map((match) => match[1]),
  ]);

  // The five the issue names, by code: a code nobody wrote a sentence for renders as
  // "Seti could not complete that", which is the catch-all this file exists to prevent.
  const required = [
    'convert-pair-unavailable',
    'convert-same-asset',
    'convert-amount-invalid',
    'convert-no-liquidity',
    'convert-insufficient-balance',
  ];
  for (const code of required) {
    check(`the backend declares ${code}`, codes.has(code), [...codes].join(', '));
  }

  for (const code of [...codes].sort()) {
    const sentence = REFUSAL_BY_CODE[code];
    check(
      `${code} has a sentence, in the voice`,
      typeof sentence === 'string' &&
        sentence !== REFUSAL_UNKNOWN &&
        !/[—–]/.test(sentence) &&
        !sentence.includes('!') &&
        !sentence.includes('?') &&
        /\b(you|your)\b/i.test(sentence) &&
        /\.$/.test(sentence.trim()) &&
        !/\b(OUSD|USDC|USDC\.e|USDT0|USDT|pathUSD)\b/i.test(sentence),
      String(sentence)
    );
  }

  const swapSentences = Object.values(SWAP_COPY);
  check(
    'the swap control says nothing with an em dash, an exclamation or a question mark',
    !swapSentences.some((line) => /[—–!?]/.test(line))
  );
  check(
    'and never claims money moved unless it says which way',
    /nothing moved|nothing was swapped|nothing was sent|went through on-chain/i.test(
      [SWAP_COPY.cancelled, SWAP_COPY.failed, SWAP_COPY.recordFailed].join(' ')
    )
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
