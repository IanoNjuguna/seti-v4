/**
 * `npm run check:pay-states` — the three payer states of the public pay page (#153).
 *
 * The page is served to a stranger with no session and no wallet, so it cannot detect
 * either. The state is a DECLARATION in the URL (`?pay=empty`, `?pay=none`), and this
 * check renders all three through the real component tree and reads the HTML, because
 * a state that exists only as a branch is not a state anyone can be in.
 *
 * Four things are pinned:
 *
 *  1. **Who said what.** The declaration resolves exactly, and anything unrecognised
 *     (a hand-edited query, a repeated key, a script tag) resolves to the ordinary
 *     paying state rather than to a refusal.
 *  2. **What each state draws.** The funded state: deep link, copyable request at the
 *     TOTAL. The empty wallet: the explicit line, before the code. No wallet: the
 *     explicit line, and NO payment prompt anywhere in the markup.
 *  3. **No dead ends.** Every declaration is reachable from the paying state, every
 *     state has a one-tap way back to the request, and every link's URL resolves to
 *     the state it names. The re-read keeps the payer's declaration, so a refresh
 *     cannot turn a refusal into a payment prompt.
 *  4. **The copy is honest.** The requirement line, the fee before anything is signed,
 *     the custody sentence, no token names, no promise of an on-ramp, no wallet
 *     creation, no em dash and no exclamation mark.
 *
 * Run from `web/`: npm run check:pay-states (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PayPublicView } from '../components/pay-public/PayPublicView.tsx';
import { PAY_COPY, PAYER_COPY } from '../components/pay-public/PayPublic.constants.ts';
import { payDeadline, payerHref, payerLinks, payRequestValues, resolvePayerState } from '../components/pay-public/pay-public.payer.ts';
import { FIXTURE_PAYEE_DIRECTORY, fixtureChargeSource } from '../lib/charges/charge.fixture.ts';
import { loadCharge } from '../lib/charges/load-charge.ts';

const NOW = new Date('2026-10-22T09:00:00.000Z');
const ID = 'ch_8f2c1a4e7b9d';
const ADDRESS = '0x8fad55b7c481bd76889fbf1eb719789f87db5113';

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

/** A charge loaded from the TEST DOUBLE, exactly as `check:pay-charge` loads one. */
async function load(id, deps = {}) {
  return loadCharge(id, {
    now: NOW,
    source: fixtureChargeSource,
    directory: FIXTURE_PAYEE_DIRECTORY,
    ...deps,
  });
}

/** The page's own view, rendered to the HTML a JS-disabled browser receives. */
function render(result, payer) {
  return renderToStaticMarkup(
    createElement(PayPublicView, {
      charge: result.charge,
      payee: result.payee,
      status: result.status,
      payer,
    })
  );
}

const pending = await load(ID);
const html = {
  wallet: render(pending, 'wallet'),
  empty: render(pending, 'empty'),
  none: render(pending, 'none'),
};

console.log('the declaration, read from the URL:');
check('a bare link is the paying state', resolvePayerState(undefined) === 'wallet');
check(
  'each declared state is read as itself',
  ['wallet', 'empty', 'none'].every((state) => resolvePayerState(state) === state)
);
check(
  'anything unrecognised is the paying state, never a refusal',
  ['', 'NONE', 'Empty', 'no-wallet', '<script>alert(1)</script>', 'none '].every(
    (raw) => resolvePayerState(raw) === 'wallet'
  )
);
check(
  'a repeated key takes the first value, so it cannot smuggle a second state in',
  resolvePayerState(['none', 'wallet']) === 'none' && resolvePayerState(['wallet', 'none']) === 'wallet'
);
check('the paying state is written without the key', payerHref(ID, 'wallet') === `/pay/${ID}`);
check(
  'a declared state is written with exactly its own name',
  payerHref(ID, 'empty') === `/pay/${ID}?pay=empty` && payerHref(ID, 'none') === `/pay/${ID}?pay=none`
);

console.log('a URL, resolved and rendered, is the state its link names:');
{
  const MARKER = {
    wallet: (page) => page.includes(PAY_COPY.scanCaption) && !page.includes(PAYER_COPY.emptyLine) && !page.includes(PAYER_COPY.noneLine),
    empty: (page) => page.includes(PAYER_COPY.emptyLine) && page.includes(PAY_COPY.scanCaption) && !page.includes(PAYER_COPY.noneLine),
    none: (page) => page.includes(PAYER_COPY.noneLine) && !page.includes(PAY_COPY.scanCaption),
  };
  for (const payer of ['wallet', 'empty', 'none']) {
    const href = payerHref(ID, payer);
    const declared = new URL(href, 'https://seti.live').searchParams.get('pay') ?? undefined;
    const page = render(pending, resolvePayerState(declared));
    check(`${href} renders that state and no other`, MARKER[payer](page), `resolved ${resolvePayerState(declared)}`);
  }
}

console.log('every state draws the same three facts first:');
for (const payer of ['wallet', 'empty', 'none']) {
  check(`[${payer}] the page says what paying needs`, html[payer].includes(PAYER_COPY.need));
  check(
    `[${payer}] the 2% and the total are drawn before any prompt`,
    html[payer].includes('Platform fee (2%)') &&
      html[payer].indexOf('Platform fee (2%)') < html[payer].indexOf(PAYER_COPY.section)
  );
  check(
    `[${payer}] the custody sentence is drawn, once, in the same words`,
    html[payer].split(PAY_COPY.custody).length === 2
  );
  check(
    `[${payer}] the figure is the customer's, in the customer's currency`,
    html[payer].includes('KES 1,250.00') && !/(OUSD|USDC|USDT0|pathUSD)/.test(html[payer])
  );
}

console.log('a funded wallet: the request, the deep link, and the copyable details:');
check('the code is drawn with an accessible name', html.wallet.includes('role="img"'));
check(
  'the payload is a real link a wallet can be handed',
  html.wallet.includes(`href="seti://pay/${ID}"`)
);
check(
  'the address, the amount and the reference are all copyable',
  ['Copy the address', 'Copy the amount to send', 'Copy the reference'].every((label) =>
    html.wallet.includes(`aria-label="${label}"`)
  )
);
{
  const values = payRequestValues(pending.charge);
  check('the copied address is the full recipient address', values.address === ADDRESS, values.address);
  check(
    'the copied amount is the TOTAL, never the principal',
    values.amount === 'KES 1,275.00',
    values.amount
  );
  check('the reference is the charge id', values.reference === ID);
  check(
    'all three values are printed in the markup, not hidden behind a control',
    html.wallet.includes(ADDRESS) && html.wallet.includes('KES 1,275.00') && html.wallet.includes(ID)
  );
}
check(
  'the funded payer is told to scan, and offered the way out if that is not true',
  html.wallet.includes(PAY_COPY.scanCaption) &&
    html.wallet.includes(PAYER_COPY.switchEmpty) &&
    html.wallet.includes(PAYER_COPY.switchNone)
);

console.log('a wallet with no dollars in it: the line comes before the code:');
check('the state is stated in words', html.empty.includes(PAYER_COPY.emptyLine));
check('and so is what changes it', html.empty.includes(PAYER_COPY.emptyNext));
check(
  'the two near misses are named: another coin, another network',
  html.empty.includes(PAYER_COPY.emptyOther)
);
check(
  'the line is read before the code, so nobody scans an empty wallet',
  html.empty.indexOf(PAYER_COPY.emptyLine) < html.empty.indexOf(PAY_COPY.scanCaption)
);
check(
  'the payer is told what happened to their money',
  html.empty.includes('Nothing has left your wallet')
);
{
  const expiring = {
    async read() {
      const base = await fixtureChargeSource.read(ID);
      return { kind: 'found', payload: { ...base.payload, expiresAt: '2026-10-31T12:00:00.000Z' } };
    },
  };
  const result = await load(ID, { source: expiring });
  const withDeadline = render(result, 'empty');
  check(
    "the deadline printed is the charge's own",
    payDeadline(result.charge) === '31 October 2026' &&
      withDeadline.includes('This request stays open until 31 October 2026.'),
    payDeadline(result.charge)
  );
  check(
    'a charge with no deadline says so instead of inventing one',
    html.empty.includes('This request has no deadline.')
  );
}

console.log('no wallet at all: an explicit line, and no payment prompt:');
check('the refusal is in words', html.none.includes('You cannot pay this request'));
check('and it says the state the payer declared', html.none.includes(PAYER_COPY.noneLine));
check('the code is not drawn', !html.none.includes('role="img"'));
check(
  'the deep link is not drawn',
  !html.none.includes('seti://') && !html.none.includes(PAY_COPY.uriCaption)
);
check('the scan instruction is not drawn', !html.none.includes(PAY_COPY.scanCaption));
check(
  'no destination is offered to copy: no copy control, no "pay from another wallet" block',
  !html.none.includes('aria-label="Copy the address"') && !html.none.includes(PAYER_COPY.diyTitle)
);
check(
  'no wallet is offered either: creating one is out of scope, and an empty one is the same dead end',
  !html.none.includes('href="/app"') && !html.none.includes('Sign in')
);
check('a real next step is given instead', html.none.includes(PAYER_COPY.noneNext));
check(
  'and the one promise the page can keep: the link survives',
  html.none.includes(PAYER_COPY.noneKeep(null))
);
check('the payer is told what happened to their money', html.none.includes('Nothing has left your wallet'));

console.log('no dead ends: every answer is one tap from every other:');
{
  const targetOf = (href) => resolvePayerState(new URL(href, 'https://seti.live').searchParams.get('pay') ?? undefined);
  const declared = payerLinks(ID, 'wallet').map((link) => targetOf(link.href));
  check(
    'the paying state offers both other answers',
    declared.join(',') === 'empty,none',
    declared.join(',')
  );
  for (const payer of ['empty', 'none']) {
    check(
      `[${payer}] has a one-tap way back to the request`,
      payerLinks(ID, payer).some((link) => targetOf(link.href) === 'wallet')
    );
  }
  check(
    'every link lands on the state it names',
    ['wallet', 'empty', 'none'].every((payer) =>
      payerLinks(ID, payer).every((link) => {
        const named = link.href.includes('pay=none') ? 'none' : link.href.includes('pay=empty') ? 'empty' : 'wallet';
        return targetOf(link.href) === named;
      })
    )
  );
  check(
    'the "check again" link keeps the declaration, so a refresh is not a new prompt',
    html.none.includes(`href="/pay/${ID}?pay=none"`) && html.empty.includes(`href="/pay/${ID}?pay=empty"`)
  );
  check(
    'and the paying state keeps its bare path, so links already in the world still work',
    html.wallet.includes(`href="/pay/${ID}"`)
  );
}

console.log('the copy does not promise what does not exist:');
{
  const strings = [
    ...Object.values(PAYER_COPY).filter((value) => typeof value === 'string'),
    PAYER_COPY.stayOpen(null),
    PAYER_COPY.stayOpen('31 October 2026'),
    PAYER_COPY.noneKeep(null),
    PAYER_COPY.noneKeep('31 October 2026'),
  ];
  const forbidden = ['Buy dollars', 'Top up', 'top up', 'M-Pesa', 'Mpesa', 'Sign up', 'Get the app', 'Download'];
  check(
    'no on-ramp, no wallet, no app is offered in any state',
    strings.every((text) => !forbidden.some((word) => text.includes(word))),
    strings.find((text) => forbidden.some((word) => text.includes(word))) ?? ''
  );
  check(
    'no token name appears in any payer line',
    strings.every((text) => !/(OUSD|USDC|USDT0|pathUSD)/.test(text))
  );
  check(
    'no em dash and no exclamation mark',
    strings.every((text) => !text.includes('—') && !text.includes('!'))
  );
}

console.log('the route wires the declaration to the page:');
{
  const route = readFileSync(new URL('../app/pay/[id]/page.tsx', import.meta.url), 'utf8');
  check('it reads the query string', route.includes('await searchParams'));
  check('it resolves the state through the one resolver', route.includes('resolvePayerState(pay)'));
  check('and it passes the state to the view', route.includes('payer={payer}'));
  check('the page still never reads a session or a cookie', !/cookies\(|getServerSession|headers\(/.test(route));
}

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
