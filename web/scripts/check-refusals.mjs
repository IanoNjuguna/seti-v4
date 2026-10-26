/**
 * `npm run check:refusals` — the three things Seti says it will not do (#133).
 *
 * A refusal is a promise in the negative, which makes it the one kind of
 * marketing claim a customer can test: hold a payment and see whether Seti sits
 * in the middle, try to be paid with no account, try to top up with a card. So
 * the sentences have to be true of the CODE, not of intent, and this script is
 * where that is decided. It does four jobs.
 *
 *  1. **The copy is one list of three.** `REFUSAL_ROWS` has exactly three rows,
 *     named by id, and the heading that says "Three" counts them. A fourth
 *     refusal, a missing one, or a row swapped for a different one fails here.
 *
 *  2. **The sentences RENDER.** The real component tree is rendered to the HTML
 *     a browser with JS disabled receives, and the markup is read: three `<dt>`
 *     refusals, three `<dd>` facts, the section's own `#refusals` anchor (which
 *     the nav and the ⌘K palette link to), and the band composed on the landing
 *     page between the integrations row and the close. A component that exists
 *     but is not on the page is not a page that says it.
 *
 *  3. **Each claim is still true of the backend.** This is the half that bites
 *     when the product changes rather than the copy:
 *       - custody — no file under `backend/src/services` or `backend/src/routes`
 *         builds a signing client, so the backend holds no key that could move a
 *         customer's money, and the balance the app shows is read off the chain at
 *         the account's own wallet;
 *       - account — the public charge create route carries no auth guard, and the
 *         signature is the credential;
 *       - fiat — no Stripe or Bridge call site, and the off-ramp audit actions
 *         exist in the taxonomy with nothing writing them.
 *     If a rail, an escrow or an auth guard lands, the sentence above it becomes
 *     false and this check goes red, which is the whole reason it exists.
 *
 *  4. **The voice holds.** No em dash, no en dash used as one, no exclamation, no
 *     question mark, no stablecoin name, no "revolutionary" vocabulary, no claim
 *     that Seti is a bank, and second person in every row. The same rules run over
 *     the sentence a REFUSED PAYMENT shows before any signature
 *     (`no-single-asset-covers`, #223), which is not on the page but is read at the
 *     moment the customer needs it to be true.
 *
 * Run from `web/`: npm run check:refusals (part of the root `verify` gate).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RefusalsSection } from '../app/components/landing/RefusalsSection.tsx';
import {
  REFUSAL_ROWS,
  REFUSALS_EYEBROW,
  REFUSALS_HEADING,
} from '../app/components/landing/RefusalsSection.constants.ts';
import { REFUSAL_BY_CODE, REFUSAL_UNKNOWN } from '../lib/api/refusal.constants.ts';
import { COVERAGE_REFUSAL, pinAsset } from '../lib/pay/quote-asset.ts';
import { TokenSelector } from '../components/token-selector/TokenSelector.tsx';
import { TOKEN_SELECTOR_COPY } from '../components/token-selector/TokenSelector.constants.ts';
import {
  buildTokenSelector,
  selectorLine,
} from '../components/token-selector/token-selector.model.ts';
import { MENU_LINKS, SEARCH_SECTIONS } from '../app/components/landing/LandingNav.constants.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const BACKEND = fileURLToPath(new URL('../../backend/src/', import.meta.url));

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

/** Every `.ts` file under a directory, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** The backend sources a claim can be tested against, minus the test doubles. */
function backendFiles(dirs) {
  return dirs
    .flatMap((dir) => walk(join(BACKEND, dir)))
    .filter((file) => !file.endsWith('.check.ts'))
    .map((file) => ({
      name: relative(BACKEND, file),
      source: readFileSync(file, 'utf8'),
    }));
}

/** Strip comments, so prose about a thing is not read as the thing. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const sentences = REFUSAL_ROWS.flatMap((row) => [row.label, row.detail]);

console.log('the three are one list, and the heading counts them:');
check('there are three refusals', REFUSAL_ROWS.length === 3, `${REFUSAL_ROWS.length}`);
check(
  'they are the three the issue names, in order',
  REFUSAL_ROWS.map((row) => row.id).join(',') === 'custody,account,fiat',
  REFUSAL_ROWS.map((row) => row.id).join(',')
);
check(
  'no refusal is empty or repeated',
  REFUSAL_ROWS.every((row) => row.label.trim().length > 10 && row.detail.trim().length > 20) &&
    new Set(REFUSAL_ROWS.map((row) => row.label)).size === 3
);
check(
  'the heading says Three, and "Three" is the number shown',
  /\bThree\b/.test(REFUSALS_HEADING) && REFUSAL_ROWS.length === 3
);
check('the eyebrow names the band', REFUSALS_EYEBROW.trim() === 'What we refuse');

console.log('the voice, on every sentence in the band:');
check(
  'no em dash and no en dash standing in for one',
  !sentences.some((line) => /[—–]/.test(line)),
  sentences.find((line) => /[—–]/.test(line))
);
check(
  'no exclamation mark',
  !sentences.some((line) => line.includes('!')),
  sentences.find((line) => line.includes('!'))
);
check(
  'no question mark: these are statements, not questionnaires',
  !sentences.some((line) => line.includes('?')),
  sentences.find((line) => line.includes('?'))
);
check(
  'no stablecoin name where a customer is looking',
  !sentences.some((line) => /\b(OUSD|USDC|USDC\.e|USDT0|USDT|pathUSD)\b/.test(line)),
  sentences.find((line) => /\b(OUSD|USDC|USDC\.e|USDT0|USDT|pathUSD)\b/.test(line))
);
check(
  'no "gas": the money that leaves is a platform fee',
  !sentences.some((line) => /\bgas\b/i.test(line))
);
check(
  'no revolutionary vocabulary, and no grade invented for a rail',
  !sentences.some((line) =>
    /revolution|seamless|unleash|empower|effortless|world-class|bank-grade|military-grade|next-gen/i.test(
      line
    )
  )
);
check(
  'Seti is never called a bank or a neobank',
  // The rule is about Seti's own identity, not about the word. "No bank transfer"
  // and "a bank account" are a refusal and a destination; "Seti is a bank" is the
  // claim the house rule forbids, so the pattern is scoped to the subject.
  sentences.every((line) => !/\bneobank\b/i.test(line)) &&
    sentences.every((line) => !/\b(seti|we)\b[^.]{0,40}\b(is|are)\b[^.]{0,15}\bbank\b/i.test(line)),
  sentences.find((line) => /\b(seti|we)\b[^.]{0,40}\b(is|are)\b[^.]{0,15}\bbank\b/i.test(line))
);
check(
  'every refusal speaks to the reader, second person',
  REFUSAL_ROWS.every((row) => /\byou\b|\byour\b/i.test(`${row.label} ${row.detail}`)),
  REFUSAL_ROWS.filter((row) => !/\byou\b|\byour\b/i.test(`${row.label} ${row.detail}`))
    .map((row) => row.id)
    .join(',')
);
check(
  'every detail is a finished sentence',
  REFUSAL_ROWS.every((row) => /\.$/.test(row.detail.trim()))
);

console.log('the sentence a payment gives before any signature (#223):');
{
  // This code is not on the landing page, so the band's own rules above do not
  // reach it — and it is the one sentence a customer reads at the moment they were
  // told, until #223, that they were short of money while looking at a card that
  // said otherwise. So it is held to the same voice here: it names where the money
  // IS, it names no token (a screen shows the customer's currency), and it says
  // what to do next.
  const code = 'no-single-asset-covers';
  const sentence = REFUSAL_BY_CODE[code];

  check('the code has a sentence of its own, not the generic fallback', Boolean(sentence) && sentence !== REFUSAL_UNKNOWN, String(sentence));
  check('no em dash and no en dash standing in for one', !/[—–]/.test(sentence), sentence);
  check('no exclamation mark', !sentence.includes('!'), sentence);
  check('no question mark', !sentence.includes('?'), sentence);
  check(
    'no stablecoin name where a customer is looking',
    !/\b(OUSD|USDC|USDC\.e|USDT0|USDT|pathUSD)\b/i.test(sentence),
    sentence
  );
  check('it speaks to the reader, second person', /\byou\b|\byour\b/i.test(sentence), sentence);
  check('it is a finished sentence', /\.$/.test(sentence.trim()), sentence);
  check('it says where the money is, which is the thing "not enough" got wrong', /more than one balance/i.test(sentence), sentence);
  check('it says what to do next', /add money/i.test(sentence), sentence);

  // And the backend declares the same code, so the sentence cannot outlive the
  // refusal it was written for (or arrive for a code nobody sends).
  const taxonomy = readFileSync(join(BACKEND, 'services/payment-refusal.ts'), 'utf8');
  check('the backend declares the code that renders this sentence', taxonomy.includes(`'${code}'`));
}

console.log('the wallet sentences a signature failure shows (#226):');
{
  // None of these is on the landing page, so the band's rules above do not reach
  // them. The last one is new with #226: setting a wallet up in place used to fail
  // into an empty catch, and the person got the same sentence about a wallet that
  // was never coming. Failure copy is held to the same voice as the promises,
  // because it is read at the worst possible moment.
  const walletCodes = [
    'wallet-missing',
    'wallet-signing-failed',
    'wallet-not-ready',
    'wallet-create-failed',
  ];
  const walletSentences = walletCodes.map((code) => REFUSAL_BY_CODE[code]);

  check(
    'every wallet state has a sentence of its own',
    walletSentences.every((line) => typeof line === 'string' && line !== REFUSAL_UNKNOWN && line.length > 40)
  );
  check('no two wallet states say the same thing', new Set(walletSentences).size === walletCodes.length);
  check('no em dash and no en dash standing in for one', !walletSentences.some((line) => /[—–]/.test(line)));
  check('no exclamation mark', !walletSentences.some((line) => line.includes('!')));
  check('no question mark', !walletSentences.some((line) => line.includes('?')));
  check(
    'no stablecoin name where a customer is looking',
    !walletSentences.some((line) => /\b(OUSD|USDC|USDC\.e|USDT0|USDT|pathUSD)\b/i.test(line))
  );
  check('every one of them says nothing was claimed', walletSentences.every((line) => /nothing was claimed/i.test(line)));
  check(
    'the failed set-up says what failed and what to do next',
    /failed/i.test(REFUSAL_BY_CODE['wallet-create-failed']) &&
      /sign in again/i.test(REFUSAL_BY_CODE['wallet-create-failed'])
  );
}

console.log('the token selector: the same refusal, with the balance that can pay it (#228):');
{
  /**
   * The state #223 made reachable and #228 made actionable: a pinned balance is
   * short, and another balance covers. Rendered through the REAL component tree, so
   * this is an assertion about what a customer reads rather than about a branch.
   *
   * The rows are the home payload's shape (#224): one per asset, each with its own
   * value in the dashboard's currency. `priced` is null on the refused path, because
   * a refused preview is not a preview.
   */
  const ROWS = [
    { asset: 'ousd', symbol: 'OUSD', amount: '0.000000', value: '0.00' },
    { asset: 'pathusd', symbol: 'pathUSD', amount: '4.500000', value: '4.50' },
    { asset: 'usdt0', symbol: 'USDT0', amount: '1240.000000', value: '1240.00' },
  ];

  const model = (overrides = {}) =>
    buildTokenSelector({
      rows: ROWS,
      currency: 'KES',
      loading: false,
      unavailable: false,
      priced: null,
      pinned: null,
      offer: null,
      ...overrides,
    });

  const render = (selector) =>
    renderToStaticMarkup(createElement(TokenSelector, { model: selector, onChoose: () => {} }));

  const sentence = REFUSAL_BY_CODE[COVERAGE_REFUSAL];

  check(
    'an unpinned quote carries NO asset, so the server still picks the row that covers',
    Object.keys(pinAsset(null)).length === 0 && Object.keys(pinAsset(undefined)).length === 0,
    `keys on the request: ${Object.keys(pinAsset(null)).join(',') || 'none'}`
  );
  check(
    'a pinned quote carries exactly the chosen token, and nothing else',
    JSON.stringify(pinAsset('usdt0')) === JSON.stringify({ asset: 'usdt0' }),
    JSON.stringify(pinAsset('usdt0'))
  );
  check(
    'an empty balance is not an option, because it cannot pay',
    model().options.length === 2 && !model().options.some((option) => option.asset === 'ousd'),
    model().options.map((option) => option.asset).join(',')
  );
  {
    const priced = model({ priced: 'usdt0' });
    const line = selectorLine(priced);
    check(
      'the default is the row that covers: the token the PRICE named, not one the UI picked',
      priced.paying?.asset === 'usdt0' && line?.label === `Paying from USDT0`,
      `${priced.paying?.asset} / ${line?.label}`
    );
    check(
      'and the line holds what that balance holds, in the customer’s currency',
      line?.detail === 'holds KES 1,240.00',
      line?.detail
    );
    check(
      'the price wins over the pin, so the token shown and the fee line can never disagree',
      model({ priced: 'usdt0', pinned: 'pathusd' }).paying?.asset === 'usdt0'
    );
  }
  {
    const single = model({ rows: ROWS.filter((row) => row.asset === 'usdt0'), priced: 'usdt0' });
    const html = render(single);
    check(
      'one funded balance costs no tap: it is a line, and there is no control to press',
      single.choosable === false && !html.includes('<button') && html.includes('Paying from USDT0'),
      `${single.choosable} / ${html.includes('<button')}`
    );
  }
  {
    const refused = model({ pinned: 'pathusd', offer: 'usdt0' });
    const html = render(refused);
    check(
      'a pinned token that cannot cover renders #223’s sentence, the one the code owns',
      refused.refusal?.sentence === sentence,
      refused.refusal?.sentence
    );
    check(
      'and offers the balance that CAN pay, in one tap',
      refused.refusal?.offer?.asset === 'usdt0' && html.includes('Pay from USDT0'),
      refused.refusal?.offer?.asset
    );
    check(
      'the sentence is drawn once, and the way out is beside it',
      html.split(sentence).length === 2 &&
        html.indexOf(sentence) < html.indexOf('Pay from USDT0')
    );
    check(
      'the refusal says nothing about a token of its own: the selector is the only place one is named',
      !/\b(OUSD|USDC|USDC\.e|USDT0|USDT|pathUSD)\b/.test(sentence)
    );
  }
  {
    const spread = model({ pinned: 'pathusd' });
    const html = render(spread);
    check(
      'when no single balance covers, nothing is offered: switching would only refuse again',
      spread.refusal === null && !html.includes('Pay from'),
      String(spread.refusal)
    );
  }
  {
    const failed = model({ unavailable: true });
    check(
      'a failed balance read is said in words, since the payment still prices without it',
      render(failed).includes(TOKEN_SELECTOR_COPY.unavailable)
    );
  }
  {
    const paying = model({ priced: 'usdt0' });
    check(
      'the amount field never appears in this control: no figure but the balance’s own',
      !render(paying).includes('Amount')
    );
  }
}


console.log('the sentences render, on the page, under the anchor they are linked by:');
{
  const html = renderToStaticMarkup(createElement(RefusalsSection));

  check('the band is a section with the #refusals anchor', html.includes('id="refusals"'));
  check(
    'all three refusals are in the markup',
    REFUSAL_ROWS.every((row) => html.includes(row.label)),
    REFUSAL_ROWS.filter((row) => !html.includes(row.label))
      .map((row) => row.id)
      .join(',')
  );
  check(
    'all three facts are in the markup',
    REFUSAL_ROWS.every((row) => html.includes(row.detail)),
    REFUSAL_ROWS.filter((row) => !html.includes(row.detail))
      .map((row) => row.id)
      .join(',')
  );
  check('the heading and eyebrow are in the markup', html.includes(REFUSALS_HEADING) && html.includes(REFUSALS_EYEBROW));
  check(
    'three terms and three definitions, no more',
    (html.match(/<dt/g) ?? []).length === 3 && (html.match(/<dd/g) ?? []).length === 3,
    `${(html.match(/<dt/g) ?? []).length} dt, ${(html.match(/<dd/g) ?? []).length} dd`
  );
  check(
    'the rendered band carries no em dash and no exclamation',
    !/[—–!]/.test(html),
    (html.match(/[^\s]{0,20}[—–!][^\s]{0,20}/) ?? [''])[0]
  );

  const page = readFileSync(join(WEB, 'app/page.tsx'), 'utf8');
  const order = ['<PartnersSection', '<RefusalsSection', '<ClosingSection'].map((tag) =>
    page.indexOf(tag)
  );
  check('the landing page composes the band', order[1] !== -1);
  check(
    'it sits after the integrations row and before the close',
    order[0] !== -1 && order[0] < order[1] && order[1] < order[2],
    order.join(',')
  );
  check(
    'the nav and the palette reach it by the anchor it renders',
    MENU_LINKS.some((link) => link.href === '#refusals') &&
      SEARCH_SECTIONS.some((section) => section.id === 'refusals')
  );
}

console.log('"Seti never holds your money." — the backend holds no key that could move it:');
{
  const sources = backendFiles(['services', 'routes']);

  // A wallet client or an account built from a key is what custody looks like in
  // code: something on OUR side that can sign for the customer. There is none,
  // and the customer's own Privy wallet is the only signer.
  const signers = sources.filter((file) =>
    /privateKeyToAccount\s*\(|createWalletClient\s*\(|mnemonicToAccount\s*\(|hdKeyToAccount\s*\(|sendTransaction\s*\(\s*calls/.test(
      stripComments(file.source)
    )
  );
  check(
    'no service or route can sign a transaction',
    signers.length === 0,
    signers.map((file) => file.name).join(',')
  );

  // The balance the app shows is a chain read at the account's own wallet, which
  // is what makes "the balance you see is your own wallet's balance" true.
  const balance = sources.find((file) => file.name.endsWith('services/balance.ts'));
  check(
    'the balance is read from the chain at the wallet, not from a Seti ledger',
    Boolean(balance) && /getOnChainBalance\s*\(/.test(balance.source),
    balance ? 'no chain read found' : 'no balance service'
  );

  // Settlement plans a swap and hands it to the customer's wallet; it cannot sign
  // it. This is the sentence a reader's "who is holding it" question rests on.
  const settlement = sources.find((file) => file.name.endsWith('services/settlement.ts'));
  check(
    'settlement plans and prices, and says the backend cannot sign',
    Boolean(settlement) && /cannot sign/i.test(settlement.source)
  );

  // The record path fails closed when the recipient has no address of its own,
  // which is the code that keeps "straight to yours" true: there is no path that
  // records a payment to a wallet Seti made up.
  const transactions = sources.find((file) => file.name.endsWith('services/transactions.ts'));
  check(
    'a payment with no recipient address of its own is refused, not recorded',
    Boolean(transactions) && /merchant-no-payout-address/.test(transactions.source)
  );
}

console.log('"You do not need an account to get paid." — the receiving route asks for a signature:');
{
  const routePath = join(BACKEND, 'routes/public-charges.ts');
  const route = readFileSync(routePath, 'utf8');
  const code = stripComments(route);

  check('the route file exists, so the claim has a surface behind it', route.length > 0);
  check(
    'it registers the public create with no auth guard in front of it',
    /app\.post\(\s*'\/'/.test(code) && !/preHandler|authenticate|requireAuth|verifySession|bearer/i.test(code),
    /preHandler|authenticate|requireAuth|verifySession|bearer/i.exec(code)?.[0]
  );
  check(
    'the signature is what authorises a charge',
    /chargeVerifies\s*\(/.test(code) && /charge-signature-invalid/.test(code)
  );

  const taxonomy = readFileSync(join(BACKEND, 'services/payment-refusal.ts'), 'utf8');
  check(
    'the refusal taxonomy still names a charge whose signature does not hold',
    taxonomy.includes('charge-signature-invalid')
  );
}

console.log('"No cards, no bank transfer." — there is no fiat rail to be a card or a bank:');
{
  const sources = backendFiles(['services', 'routes', 'config']);

  // Both keys are declared in `config/env.ts` and read by nothing: a wired Stripe
  // or Bridge integration is the shape a card or bank path would take first.
  const railCallSites = sources.filter(
    (file) =>
      !file.name.endsWith('config/env.ts') &&
      /BRIDGE_API_KEY|STRIPE_SECRET_KEY/.test(stripComments(file.source))
  );
  check(
    'no Stripe or Bridge key has a call site',
    railCallSites.length === 0,
    railCallSites.map((file) => file.name).join(',')
  );

  // The off-ramp actions are declared in ONE taxonomy and nothing writes them, so
  // there is no payout to an account at a bank to find.
  const offrampWriters = sources.filter(
    (file) =>
      !file.name.endsWith('services/audit.ts') &&
      /offramp\.(initiate|complete)/.test(stripComments(file.source))
  );
  check(
    'the off-ramp audit actions are declared and never written',
    offrampWriters.length === 0,
    offrampWriters.map((file) => file.name).join(',')
  );

  const audit = readFileSync(join(BACKEND, 'services/audit.ts'), 'utf8');
  check(
    'the off-ramp actions exist as a taxonomy, which is what makes the absence visible',
    /'offramp\.initiate'/.test(audit) && /'offramp\.complete'/.test(audit)
  );

  // No card or bank acceptance code anywhere in the money path.
  const fiatTerminals = sources.filter((file) =>
    /\bcard_number|cardNumber|cvc\b|iban\b|swift_code|bacs\b|bankAccount\b/i.test(
      stripComments(file.source)
    )
  );
  check(
    'no card or bank-account field is accepted anywhere',
    fiatTerminals.length === 0,
    fiatTerminals.map((file) => file.name).join(',')
  );
}

console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed > 0) {
  console.error(
    '\nThe landing page is saying something the code does not back, or the copy broke the voice. Fix the copy (or drop the refusal) rather than the check.'
  );
  process.exit(1);
}
console.log('ok  three refusals, rendered and still true of the backend');
