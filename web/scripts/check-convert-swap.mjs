/**
 * `npm run check:convert-swap` — how a swap is reached, and the path it takes once it is
 * pressed (#240, #328).
 *
 * The issue's acceptance criteria are four claims about CODE, and this file asserts each
 * one where it can actually be broken:
 *
 *  1. **The balance card offers NO swap, and the tile is the only door.** Asserted by
 *     READING the card's own sources (#328 slice 2) and by checking that the page the tile
 *     names exists — a tile pointing at a deleted page is a door to nowhere, and a control
 *     left on the card is a second one. It reads source rather than markup because the
 *     claim is now an ABSENCE, and because the components that drew the control are
 *     deleted: a check that imports them would only prove they still exist.
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
 *  5. **The failure hands over what it tells the customer to keep.** The record-failure
 *     sentence says "keep this reference", so the page must PRINT one: the hash in full,
 *     linked to the explorer of the network it settled on, with a copy that reports whether
 *     the copy happened (#413). Asserted by reading the state line, its model and the well,
 *     because the defect was that a sentence promised something no component drew.
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
import { existsSync, readFileSync } from 'node:fs';

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
const { SWAP_COPY } = await import('../lib/pay/convert-swap.constants.ts');
const { buildSwapCall, STABLECOIN_DEX_ADDRESS } = await import('../lib/pay/build-swap.ts');
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

/** The swap path's files: everything a swap touches on its way to a signature. */
const SWAP_PATH = [
  '../hooks/useConvertSwap.ts',
  '../hooks/useConvertQuote.ts',
  '../lib/pay/build-swap.ts',
  '../lib/api/convert.ts',
];

/**
 * The balance card's own files, named rather than globbed: `HomeActions.constants.ts`
 * lives in the same directory and DOES link to the swap page, because the tile is the
 * door that replaced these. A directory scan would have to subtract it and would pass
 * for the wrong reason the day another file gained a link too.
 */
const CARD_FILES = ['BalanceCard.tsx', 'BalanceTokens.tsx', 'BalanceTokenRow.tsx'];

/** The components that drew the control, deleted in #328 slice 2. */
const REMOVED = [
  'BalanceTokenSwap.tsx',
  'BalanceTokenSwapAction.tsx',
  'BalanceTokenSwapConfirm.tsx',
  'BalanceTokenSwap.types.ts',
  'BalanceTokenSwap.constants.ts',
];

console.log('the balance card offers no swap, and the tile is the only door:');
{
  const sources = CARD_FILES.map((name) => ({
    name,
    source: stripComments(readFileSync(new URL(`../components/home/${name}`, import.meta.url), 'utf8')),
  }));

  const doors = sources.filter(({ source }) => source.includes('/app/swap'));
  check(
    'nothing on the card links to the swap page',
    doors.length === 0,
    doors.map(({ name }) => name).join(', ')
  );

  /**
   * The quote request is the half that costs something: the row asked the book about
   * every non-zero balance on mount (#240), so removing the control without removing the
   * read would leave four requests answering a question nobody displays.
   */
  const asking = sources.filter(({ source }) => /useConvertQuote|<BalanceTokenSwap/.test(source));
  check(
    'and nothing there asks the book for a quote, so a card costs no requests',
    asking.length === 0,
    asking.map(({ name }) => name).join(', ')
  );

  const orphans = REMOVED.filter((name) =>
    existsSync(new URL(`../components/home/${name}`, import.meta.url))
  );
  check(
    'the control and its confirm step are deleted, not orphaned',
    orphans.length === 0,
    orphans.join(', ')
  );

  /**
   * The tile is now the ONLY way in, so this half is about the door that remains: it has
   * to name the swap page, and the swap page has to exist. A tile pointing at a deleted
   * route is a door to nowhere, and no assertion about the card can catch it.
   */
  const actions = stripComments(readSource('../components/home/HomeActions.constants.ts'));
  check(
    'the Swap tile is the one door, and it names the swap page',
    /key: 'swap'[^}]*href: '\/app\/swap'/.test(actions)
  );
  check(
    'and that page exists',
    existsSync(new URL('../app/(product)/app/swap/page.tsx', import.meta.url))
  );
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
    amountIn: '10.000000',
    minAmountOut: '9.949005',
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

console.log('\nthe page says what the pair is worth, and how much can be swapped (#337):');
{
  /**
   * The rate is the server's, and this half of the suite only proves the page reads it:
   * the arithmetic itself is asserted in `check:convert`, where the quote lives.
   */
  const quoteSource = stripComments(readSource('../../backend/src/services/convert.ts'));
  check(
    'the quote answers with a rate',
    /rate: string;/.test(quoteSource) && quoteSource.includes('rate: rateLine(amountIn, amountOut)')
  );

  /**
   * The line must be printed, not derived: a component that divided `amountOut` by
   * `amountIn` would be a second opinion about the quote on screen, and the two would
   * disagree the moment one of them rounded.
   */
  const rate = stripComments(readSource('../components/swap/SwapRateLine.tsx'));
  check('the rate line prints the quote\'s own `rate`', rate.includes('quote.rate') && rate.includes('swapRateLine('));
  check('and never recomputes it from the two amounts', !/amountIn|amountOut/.test(rate));

  const page = stripComments(readSource('../components/swap/SwapForm.tsx'));
  check(
    'the page puts that line directly under the heading (#417)',
    page.includes('<SwapRateLine quote={form.quote} />') &&
      page.indexOf('<SwapRateLine') > page.indexOf('SWAP_FORM_COPY.title')
  );

  /**
   * The ceiling is the server's `max` resolution — balance less the gas the swap costs — so
   * it is asked once per pair, and never read off the balance row, which would overstate it
   * by exactly the fee.
   */
  const form = stripComments(readSource('../hooks/useSwapForm.ts'));
  check(
    'the ceiling is asked with `max`, so typing does not re-ask it',
    form.includes('const ceiling = useConvertQuote({') && form.includes('amount: CONVERT_AMOUNT_MAX')
  );
  check(
    'and the state carries the server\'s figure for it',
    form.includes('ceiling.quote?.amountIn') && form.includes('shown?.amountIn ?? null')
  );

  /**
   * `Max` fills the field with that figure and is unavailable until the server has answered
   * (#417). It is no longer printed as a caption beside the amount: the caption moved into
   * the card's footer as the balance, and the guarantee that survives is the one that
   * matters — the control cannot offer a figure this build derived.
   */
  const fields = stripComments(readSource('../components/swap/SwapFields.tsx'));
  check(
    'Max is unavailable until the server has resolved a spendable figure',
    fields.includes('onClick={form.onAll}') && /disabled=\{form\.busy \|\| form\.spendable === null\}/.test(fields)
  );
}

console.log('\nthe page is a pair and an amount, not four form fields (#417):');
{
  const fields = stripComments(readSource('../components/swap/SwapFields.tsx'));
  const amountField = stripComments(readSource('../components/swap/SwapAmountField.tsx'));
  const card = stripComments(readSource('../components/swap/SwapCard.tsx'));
  const form = stripComments(readSource('../hooks/useSwapForm.ts'));

  /*
   * The amount is the figure the page is about, at figure size. Asserted as a CLASS on the
   * one element: the defect was that it wore the same 16px recipe as the two pickers, so it
   * read as the third form field rather than as the number being swapped.
   */
  check(
    'the amount renders at the figure size, in the pay card',
    amountField.includes('SWAP_FIGURE_CLASS') && !amountField.includes('text-body-md')
  );
  check(
    'and that size is one class, so a second one cannot win by emission order',
    /export const SWAP_FIGURE_CLASS =\s*'[^']*text-heading-md[^']*'/.test(
      stripComments(readSource('../components/swap/SwapForm.constants.ts'))
    )
  );

  /*
   * The `get` side prints the SERVER's `amountOut`. A number computed here would be a second
   * opinion about the quote on screen, and the two would disagree the moment one rounded.
   */
  check(
    'the get card prints the quote\'s `amountOut`, and never a figure of its own',
    fields.includes('formatAssetUnits(quote.amountOut)') && !fields.includes('parseUnits(')
  );

  check(
    'the pair is two cards with the control between them',
    fields.indexOf('<SwapCard') < fields.indexOf('<SwapFlipControl') &&
      fields.indexOf('<SwapFlipControl') < fields.lastIndexOf('<SwapCard') &&
      card.includes('<SwapTokenPill')
  );

  /*
   * The flip is the one edit that sets BOTH choices: `onSource` clears the target because a
   * new source invalidates the pair, so a flip routed through it would blank the side the
   * customer just flipped to.
   */
  check(
    'the flip sets both sides at once, and clears a figure that was in other units',
    /onFlip[\s\S]*setSourceChoice\(assetOut\)[\s\S]*setTargetChoice\(assetIn\)[\s\S]*setDraft\(''\)/.test(
      form
    )
  );
  check(
    'and it is offered only when the get side is a balance this account holds',
    /const canFlip =[\s\S]*sources\.some\(\(option\) => option\.asset === assetOut\)/.test(form)
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
  check(
    'the receipt is polled for a WINDOW, not a fixed count of attempts (#413)',
    /const RECORD_WINDOW_MS = [\d_]+/.test(signing) &&
      /Date\.now\(\) >= deadline/.test(signing) &&
      !/RECORD_ATTEMPTS/.test(signing)
  );
}

console.log('\nthe record failure hands over the reference it asks the customer to keep:');
{
  const model = stripComments(readSource('../components/swap/SwapForm.types.ts'));
  const line = stripComments(readSource('../components/swap/SwapStateLine.tsx'));
  const well = stripComments(readSource('../components/swap/SwapReference.tsx'));
  const form = stripComments(readSource('../hooks/useSwapForm.ts'));

  check(
    'the state line model carries the hash, and null on every other line',
    model.includes('export interface SwapReferenceModel') &&
      model.includes('reference: SwapReferenceModel | null')
  );
  check(
    'the state line renders it when there is one',
    line.includes("from './SwapReference'") &&
      line.includes('reference !== null') &&
      line.includes('<SwapReference')
  );
  check(
    'the hash is printed IN FULL and linked to the explorer of its own network',
    well.includes('{txHash}') &&
      well.includes('getExplorerTxUrlFor(txHash, network)') &&
      !/txHash\.slice\(|\.\.\./.test(well)
  );
  check(
    'and a copy that fails says so, rather than leaving the press unacknowledged',
    well.includes('writeToClipboard(txHash)') &&
      well.includes("'failed'") &&
      well.includes('SWAP_REFERENCE_COPY.copyFailed')
  );
  check(
    'the swap error line is the one that carries it',
    /swapLine\(\s*'alert',\s*swap\.error,\s*swap\.txHash === null \? null : \{ txHash: swap\.txHash, network \}/.test(
      form
    )
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