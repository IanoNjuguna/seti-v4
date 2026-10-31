/**
 * `npm run check:refusals` — the refusals the product still makes, and the money
 * invariant behind them (#133, trimmed by #267).
 *
 * This began as the gate over a landing band that said what Seti will not do. That
 * band is gone (#267): its copy, its component and the two navigation entries that
 * reached it went together, and every assertion here that read them went with them —
 * a list of exactly three rows, a heading whose word "Three" counted them, the markup
 * the band rendered, the band's place on the landing page, and whether the nav and
 * the ⌘K palette reached its anchor. There is no longer copy to hold to a rule, and
 * asserting that a deleted component renders would be asserting nothing. What is left
 * is the half that was never about a band, and it is the half that bites when the
 * PRODUCT changes rather than the copy. It does four jobs.
 *
 *  1. **The backend holds no key that could move a customer's money.** No file under
 *     `backend/src/services` or `backend/src/routes` builds a signing client; the
 *     balance the app shows is read off the chain at the account's own wallet;
 *     settlement plans a swap and says the backend cannot sign it; and a payment with
 *     no recipient address of its own is refused rather than recorded. If a rail, an
 *     escrow or a hold lands, the claim the page used to make becomes false and this
 *     check goes red. No landing copy makes that claim any more, and that is not a
 *     reason to stop checking it: it is the one thing here that is about money.
 *
 *  2. **Receiving still asks for a signature, not an account.** The public charge
 *     create route carries no auth guard, the signature is the credential, and the
 *     taxonomy still names a charge whose signature does not hold.
 *
 *  3. **There is still no card and no bank rail.** No Stripe or Bridge key has a call
 *     site, the off-ramp audit actions are declared in one taxonomy with nothing
 *     writing them, and no file in the money path accepts a card or bank field.
 *
 *  4. **The voice holds on the copy the customer still reads.** No em dash, no en
 *     dash used as one, no exclamation, no question mark, no stablecoin name, no
 *     "gas", second person, a finished sentence — over the sentence a REFUSED PAYMENT
 *     shows before any signature (`no-single-asset-covers`, #223), the four wallet
 *     sentences a signature failure shows (#226), and the token selector's refusal
 *     (#228). None of these is on the landing page, and every one of them is read at
 *     the worst possible moment, which is why they are held to the rules the deleted
 *     band's copy was held to.
 *
 * Run from `web/`: npm run check:refusals (part of the root `verify` gate).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { REFUSAL_BY_CODE, REFUSAL_NETWORK, REFUSAL_NETWORK_STATUS, REFUSAL_UNKNOWN } from '../lib/api/refusal.constants.ts';
import { ApiError } from '../lib/api/client.ts';
import { describePrivySignInFailure } from '../lib/auth/auth.constants.ts';
import {
  SESSION_ENDED,
  SESSION_UNREACHABLE,
  SIGN_IN_FAILED_TITLE,
} from '../lib/auth/session-problem.constants.ts';
import { bootstrapStoredSession } from '../lib/auth/session-bootstrap.ts';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../lib/auth/auth.constants.ts';
import { COVERAGE_REFUSAL, pinAsset } from '../lib/pay/quote-asset.ts';
import { TokenSelector } from '../components/token-selector/TokenSelector.tsx';
import { TOKEN_SELECTOR_COPY } from '../components/token-selector/TokenSelector.constants.ts';
import {
  buildTokenSelector,
  selectorLine,
} from '../components/token-selector/token-selector.model.ts';

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

console.log("the backend holds no key that could move a customer's money:");
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

console.log('receiving asks for a signature, not an account:');
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

console.log('there is no card and no bank rail:');
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

console.log('\nthe words a session that could not be confirmed gets (#284):');
{
  // Copy first, because the copy is what a person reads at the worst moment and it
  // is the half with no other gate on it. Every rule here is the one the wallet
  // sentences are held to in `check-claim-states.mjs`, plus the one this line broke:
  // ONE instruction per sentence.
  const sentence = (problem) => problem.message;

  check(
    'the two events have their own heading, so the block never reads as one event',
    SESSION_ENDED.title !== SESSION_UNREACHABLE.title,
    `${SESSION_ENDED.title} / ${SESSION_UNREACHABLE.title}`
  );
  check(
    'the heading carries the action when the session is over',
    /sign in/i.test(SESSION_ENDED.title),
    SESSION_ENDED.title
  );
  check(
    'the heading names Seti, not the customer, when it did not answer',
    /seti/i.test(SESSION_UNREACHABLE.title),
    SESSION_UNREACHABLE.title
  );
  check(
    'the ended sentence says what happened, not what to press',
    /session/i.test(sentence(SESSION_ENDED)) && !/try again/i.test(sentence(SESSION_ENDED)),
    sentence(SESSION_ENDED)
  );
  check(
    'the unanswered sentence tells nobody to sign in, because their session was kept',
    !/sign in/i.test(sentence(SESSION_UNREACHABLE)),
    sentence(SESSION_UNREACHABLE)
  );
  check(
    'neither one wraps a sentence in brackets, which is what made it two sentences',
    ![SESSION_ENDED, SESSION_UNREACHABLE].some((problem) => /[()]/.test(sentence(problem)))
  );
  check(
    'no em dash, no en dash, no exclamation, no question mark',
    ![SESSION_ENDED, SESSION_UNREACHABLE].some((problem) => /[—–!?]/.test(sentence(problem))),
    `${sentence(SESSION_ENDED)} ${sentence(SESSION_UNREACHABLE)}`
  );
  check(
    'one sentence each, finished',
    [SESSION_ENDED, SESSION_UNREACHABLE].every(
      (problem) => problem.message.split('.').filter((part) => part.trim()).length === 1 &&
        /\.$/.test(problem.message)
    )
  );
  check(
    'no token name where a customer is looking',
    ![SESSION_ENDED, SESSION_UNREACHABLE].some((problem) =>
      /\b(OUSD|USDC|USDC\.e|USDT0|USDT|pathUSD)\b/i.test(problem.message)
    )
  );
  check(
    'a failed attempt keeps its own heading, so the two are not confused',
    /could not sign in/i.test(SIGN_IN_FAILED_TITLE) &&
      SIGN_IN_FAILED_TITLE !== SESSION_ENDED.title &&
      SIGN_IN_FAILED_TITLE !== SESSION_UNREACHABLE.title,
    SIGN_IN_FAILED_TITLE
  );

  // The same outage one screen later: a sign-in attempt that never reached the
  // server. It used to say "We could not reach Seti. Check your connection and try
  // again.", which is the customer's fault assigned to them while we deploy.
  const offlineAttempt = describePrivySignInFailure(
    new ApiError(REFUSAL_NETWORK, REFUSAL_NETWORK_STATUS)
  );
  check(
    'a sign-in attempt that never reached the server says what the restore says',
    offlineAttempt === SESSION_UNREACHABLE.message,
    offlineAttempt
  );
}

console.log('\na session that could not be confirmed is not a logout:');
{
  // The behaviour, not the wording: what the bootstrap does to the stored pair on
  // each of the three answers. This is the half that was wrong (#284): a 5xx used to
  // clear the session exactly like a 401, so every deploy signed everybody out.
  const ACCOUNT = { id: 'acc-1', email: 'a@seti.test', firstName: null, lastName: null, phone: null };

  const storage = () => {
    const held = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (key) => (held.has(key) ? held.get(key) : null),
        setItem: (key, value) => held.set(key, String(value)),
        removeItem: (key) => held.delete(key),
      },
    };
    return held;
  };

  const storeSession = (held, user = ACCOUNT) => {
    held.set(AUTH_USER_KEY, JSON.stringify(user));
    held.set(AUTH_TOKEN_KEY, 'stored-token');
  };

  let calls = 0;
  const answer = (status, body) => {
    calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    };
  };

  // 1. The server refused the token: the pair goes, and it says the session ended.
  {
    const held = storage();
    storeSession(held);
    answer(401, { error: 'Invalid or expired token', code: 'unauthorized' });
    const outcome = await bootstrapStoredSession();

    check('a refused token lands on the ended sentence', outcome.problem === SESSION_ENDED, outcome.kind);
    check('a refused token takes the stored pair with it', held.size === 0, `${held.size} keys left`);
  }

  // 2. The server did not answer: the pair STAYS, and it does not say sign in again.
  {
    const held = storage();
    storeSession(held);
    answer(500, { error: 'boom' });
    const outcome = await bootstrapStoredSession();

    check('a 5xx lands on the unanswered sentence', outcome.problem === SESSION_UNREACHABLE, outcome.kind);
    check(
      'a 5xx does NOT clear the stored session, which is the whole fix',
      held.get(AUTH_USER_KEY) !== undefined && held.get(AUTH_TOKEN_KEY) === 'stored-token',
      `${held.size} keys left`
    );
    check('it asked once more before giving up', calls === 2, `${calls} requests`);
  }

  // 3. Nothing answered at all — offline, DNS, a blocked origin.
  {
    const held = storage();
    storeSession(held);
    calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      throw new TypeError('Failed to fetch');
    };
    const outcome = await bootstrapStoredSession();

    check('an unreachable server lands on the unanswered sentence', outcome.problem === SESSION_UNREACHABLE);
    check('an unreachable server keeps the stored session', held.size === 2, `${held.size} keys left`);
  }

  // 4. The server answered, and it is somebody else: neither kept nor reported as a
  //    silent sign-out. Cleared, with the same one action as the expiry.
  {
    const held = storage();
    storeSession(held, { ...ACCOUNT, id: 'acc-2', email: 'other@seti.test' });
    answer(200, { user: ACCOUNT });
    const outcome = await bootstrapStoredSession();

    check('a different account is refused, not adopted', outcome.problem === SESSION_ENDED, outcome.kind);
    check('and the pair it disagreed with is gone', held.size === 0, `${held.size} keys left`);
  }

  // 5. The server confirmed it: restored, from the SERVER's copy.
  {
    const held = storage();
    storeSession(held, { ...ACCOUNT, firstName: 'stale' });
    answer(200, { user: ACCOUNT });
    const outcome = await bootstrapStoredSession();

    check('a confirmed match restores the session', outcome.kind === 'restored', outcome.kind);
    check(
      'and the account it carries is the server’s, not the stored one',
      outcome.kind === 'restored' && outcome.user.firstName === null,
      JSON.stringify(outcome.kind === 'restored' ? outcome.user : null)
    );
  }

  delete globalThis.window;
  delete globalThis.fetch;
}

console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed > 0) {
  console.error(
    '\nThe product is saying something the code does not back, or the copy broke the voice. Fix the copy (or drop the refusal) rather than the check.'
  );
  process.exit(1);
}
console.log("ok  no key to a customer's money, no fiat rail, and the refusals still read in our voice");
