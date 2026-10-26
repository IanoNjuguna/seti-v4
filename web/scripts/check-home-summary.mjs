/**
 * `npm run check:home-summary` — Home's two arithmetic claims: which window it
 * summarises, and what the balance card is made of.
 *
 * PART ONE, the window and the ranking. Two decisions that are easy to get wrong and
 * invisible in a screenshot: picking the window by SIZE rather than by index (so a new
 * window cannot silently relabel the row), and slicing the server's merchant ranking
 * without re-sorting it (a second opinion about the same data). Everything else on the
 * row is the server's own figures, formatted by the same function the analytics panel
 * uses.
 *
 * PART TWO, the token rows (#227), and this half RENDERS the card. The claim the issue
 * makes is that the figure on the card equals the sum of the rows under it, and a claim
 * about what a customer sees can only be checked in the markup that customer receives:
 * asserting it against the payload would pass while the component printed anything at
 * all. So a fixture dashboard — built the way `homeBalanceInFiat` builds one, one row
 * per listed asset with `value = amount * rate` and `balance = sum(value)` — is rendered
 * through the real `BalanceCard`, the figure and the row values are read back OUT OF THE
 * HTML, and the two are added up as cents. What is pinned:
 *
 *  1. the rendered figure equals the sum of the rendered row values, and both equal the
 *     payload's own `balance` — three readings of one number, none of them recomputed;
 *  2. one row per asset SUPPLIED, in the supplied order: nothing is re-sorted, nothing is
 *     added (so a chain that lists three renders three) and nothing is dropped;
 *  3. a zero row renders and recedes to the muted ink, while a funded row keeps its white
 *     name and value: a token with nothing in it is a line of record, not a missing line;
 *  4. an account with no funds renders every row at zero under one `KES 0.00` figure — the
 *     surface looks answered rather than broken;
 *  5. no raw colour anywhere in the two files that print the rows: the rows are ink
 *     tokens, so `design/revolut.md` stays the only vocabulary.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * The served chain, set BEFORE anything imports the app's chain table.
 *
 * The card used to be pure presentational code. It is not any more: a token row asks
 * whether the book can fill a swap (#240), and that gate reaches `@/lib/chain`, whose
 * module body calls `resolveNetwork()` and throws when `NEXT_PUBLIC_TEMPO_CHAIN_ID` is
 * unset. Next loads `.env.local`; tsx does not, and CI sets no web chain id, so this
 * check failed in CI while passing on a machine that had one. Practice, always: nothing
 * here signs or spends. Skipped when the environment already named one.
 */
process.env.NEXT_PUBLIC_TEMPO_CHAIN_ID ??= '42431';

/**
 * Loaded AFTER the line above, which is why they are dynamic: the chain table evaluates
 * the env var at module load, so a static import would hoist past the default.
 */
const { AmountPrivacyProvider } = await import('../lib/privacy/amount-privacy.context.tsx');
const { BalanceCard } = await import('../components/home/BalanceCard.tsx');
const { PAID_RECENTLY_LIMIT, longestWindow, paidRecently } = await import(
  '../components/home/home.summary.ts'
);
const { formatFiat } = await import('../lib/formatCurrency.ts');

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

function windowOf(days, merchants = []) {
  return { days, in: '0.00', out: '0.00', net: '0.00', count: 0, skipped: 0, merchants };
}

function merchant(name, count, total) {
  return { name, count, total };
}

console.log('the window Home summarises:');
check('an answer with no windows picks none', longestWindow([]) === null);
check('the two the server ships: the longer one wins', longestWindow([windowOf(7), windowOf(30)])?.days === 30);
check('and order does not decide it', longestWindow([windowOf(30), windowOf(7)])?.days === 30);
check('one window is itself', longestWindow([windowOf(7)])?.days === 7);
check(
  'a window added later is picked by SIZE, not by position',
  longestWindow([windowOf(7), windowOf(90), windowOf(30)])?.days === 90
);

console.log('who was paid, in whose order:');
{
  const ranked = [
    merchant('Java House', 4, '3120.00'),
    merchant('Naivas', 9, '2980.50'),
    merchant('Uber', 2, '1240.00'),
    merchant('Carrefour', 1, '834.00'),
    merchant('KPLC', 1, '620.00'),
  ];
  const picked = paidRecently(windowOf(30, ranked));

  check('three rows, because three is what Home has room for', picked.length === 3);
  check(
    'the server ranking is kept as it arrived',
    picked.map((entry) => entry.name).join('|') === 'Java House|Naivas|Uber',
    picked.map((entry) => entry.name).join('|')
  );
  check('the limit is the constant, not a literal at the call site', PAID_RECENTLY_LIMIT === 3);
  check('a shorter ranking is taken whole', paidRecently(windowOf(30, ranked.slice(0, 2))).length === 2);
  check('the totals come through untouched', picked[0].total === '3120.00' && picked[1].count === 9);
}

console.log('where the section must not render:');
check('no window at all', paidRecently(null).length === 0);
check('a window with nothing ranked', paidRecently(windowOf(30, [])).length === 0);
check(
  'a caller asking for fewer gets fewer, and still in order',
  paidRecently(windowOf(30, [merchant('A', 1, '1.00'), merchant('B', 1, '1.00')]), 1)[0].name === 'A'
);

// ---------------------------------------------------------------------------
// PART TWO: the card's rows, read back out of the rendered markup.
// ---------------------------------------------------------------------------

/** KES per USD, the one rate `getHomeDashboard` converts every row at. */
const RATE = 129.5;
const CURRENCY = 'KES';

/**
 * A dashboard, built the way the server builds one (`homeBalanceInFiat`): each row's
 * `value` is its amount at the single rate, and `balance` is the sum of exactly those
 * value strings. The fixture deliberately does the arithmetic production code does, so
 * the identity asserted below is the server's own, not a number picked to make it pass.
 */
function dashboard(tokens) {
  const assets = tokens.map((token) => ({ ...token, value: (Number(token.amount) * RATE).toFixed(2) }));
  const balance = assets.reduce((sum, row) => sum + Number(row.value), 0).toFixed(2);

  return { balance, currency: CURRENCY, assets, monthToDateDelta: 0, recentTransactions: [] };
}

/** The card as it is served to a browser that has not run any JavaScript. */
function renderCard(payload) {
  return renderToStaticMarkup(
    createElement(AmountPrivacyProvider, null, createElement(BalanceCard, { data: payload, view: 'signed-in' }))
  );
}

/** The one figure on the card, addressed by its own id rather than by shape. */
function figureOf(markup) {
  return markup.match(/id="balance-figure"[^>]*>([^<]+)</)?.[1]?.trim() ?? null;
}

/**
 * The rows as rendered: the name is the first text run in the row, the value is the last
 * fiat string in it. Nothing is read from the payload — the name, the units and the
 * masked value all sit in the same chunk, which is why the value is the LAST figure.
 */
function rowsOf(markup) {
  return markup
    .split('<li')
    .slice(1)
    .map((chunk) => {
      const cell = chunk.split('</li>')[0];
      const fiat = [...cell.matchAll(/\b[A-Z]{3} [\d,]+\.\d{2}/g)].map((match) => match[0]);

      return {
        cell,
        name: cell.match(/>([^<]+)</)?.[1]?.trim() ?? '',
        value: fiat.at(-1) ?? null,
      };
    });
}

/** `KES 15,480.00` as integer cents, so a sum cannot drift in a float. */
function cents(fiat) {
  return Math.round(Number(fiat.replace(/[^0-9.]/g, '')) * 100);
}

const sumOf = (rows) => rows.reduce((total, row) => total + cents(row.value), 0);

/**
 * A row by position, or a stand-in that fails the assertions rather than throwing one.
 * A check that CRASHES when a row goes missing reports a stack trace where it should
 * report the disagreement, and `npm` renders both the same way.
 */
const rowAt = (rows, index) => rows[index] ?? { cell: '', name: '', value: null };

/** Mainnet's list: four assets, two of them held. */
const MAINNET = [
  { asset: 'ousd', symbol: 'OUSD', amount: '120.000000' },
  { asset: 'pathusd', symbol: 'pathUSD', amount: '30.500000' },
  { asset: 'usdt0', symbol: 'USDT0', amount: '0.000000' },
  { asset: 'usdc.e', symbol: 'USDC.e', amount: '0.000000' },
];

console.log('\nthe card and the rows under it:');
{
  const payload = dashboard(MAINNET);
  const markup = renderCard(payload);
  const rows = rowsOf(markup);
  const figure = figureOf(markup);
  const payloadFigure = formatFiat(Number(payload.balance), CURRENCY);

  check('the card renders its figure', figure !== null, String(figure));
  check('and one row per asset the chain lists', rows.length === 4, `${rows.length}`);
  check(
    'named in the registry spelling, in the order the payload carried',
    rows.map((row) => row.name).join('|') === 'OUSD|pathUSD|USDT0|USDC.e',
    rows.map((row) => row.name).join('|')
  );
  check(
    'every row prints its own value',
    rows.every((row) => row.value !== null),
    JSON.stringify(rows.map((row) => row.value))
  );
  check(
    'THE IDENTITY: the figure equals the sum of the rendered row values',
    cents(figure) === sumOf(rows),
    `${figure} vs ${sumOf(rows) / 100}`
  );
  check(
    'and both are the payload figures, not a recomputation in the UI',
    figure === payloadFigure && sumOf(rows) === cents(payloadFigure),
    `${figure} / ${payload.balance}`
  );
  check(
    'the rows print the units the ledger holds',
    rowAt(rows, 0).cell.includes('120.00') && rowAt(rows, 1).cell.includes('30.50'),
    rowAt(rows, 0).cell.slice(0, 160)
  );
  check('every row value sits inside the mask the card governs', rows.every((row) => row.cell.includes('••••••')));
}

console.log('a zero is a row, and a quieter one:');
{
  const rows = rowsOf(renderCard(dashboard(MAINNET)));

  check(
    'a zero row prints KES 0.00 rather than nothing',
    rowAt(rows, 2).value === `${CURRENCY} 0.00`,
    String(rowAt(rows, 2).value)
  );
  check(
    'a funded row keeps its name and value in the white ink',
    /text-on-dark(?![-\w])/.test(rowAt(rows, 0).cell),
    rowAt(rows, 0).cell.slice(0, 160)
  );
  check(
    'a zero row recedes to the muted ink and never wears the white one',
    rowAt(rows, 2).cell.includes('text-on-dark-mute') && !/text-on-dark(?![-\w])/.test(rowAt(rows, 2).cell),
    rowAt(rows, 2).cell.slice(0, 200)
  );
}

console.log('the chain decides the rows, not the component:');
{
  // USDT0 is mainnet-only. A practice payload carries three, and a fourth row here would be
  // the component inventing a token this network does not list.
  const practice = renderCard(dashboard([MAINNET[0], MAINNET[1], MAINNET[3]]));
  check('three supplied, three rendered', rowsOf(practice).length === 3);
  check('and the token this chain does not list appears nowhere', !practice.includes('USDT0'));

  // Supplied OUT of value order on purpose: the server ranks the rows and the card is a
  // pass-through. A component that sorted them would be a second opinion about the ledger,
  // and this is the assertion that notices.
  const unsorted = [
    { asset: 'usdc.e', symbol: 'USDC.e', amount: '1.000000' },
    { asset: 'ousd', symbol: 'OUSD', amount: '500.000000' },
  ];
  const outOfOrder = rowsOf(renderCard(dashboard(unsorted)));
  check(
    'the supplied order is kept, never re-sorted',
    outOfOrder.map((row) => row.name).join('|') === 'USDC.e|OUSD',
    outOfOrder.map((row) => row.name).join('|')
  );
}

console.log('an account with nothing in it:');
{
  const markup = renderCard(dashboard(MAINNET.map((token) => ({ ...token, amount: '0.000000' }))));
  const rows = rowsOf(markup);
  const figure = figureOf(markup);

  check('the figure is nil, not a placeholder', figure === `${CURRENCY} 0.00`, String(figure));
  check(
    'and all four rows are there, at zero',
    rows.length === 4 && rows.every((row) => row.value === `${CURRENCY} 0.00`),
    JSON.stringify(rows.map((row) => row.value))
  );
  check('the identity still holds at zero', cents(figure) === sumOf(rows));
  check('the list is still labelled, so the surface is answered rather than empty', markup.includes('Held in'));
}

console.log('the rows are ink tokens, not colours:');
{
  /**
   * Comments are stripped before the scan, and they have to be: `#227` is an issue
   * reference and reads as a three-digit hex to any regex that does not know better.
   * What ships is what is scanned, exactly as `check:asset-words` does it.
   */
  const stripComments = (source) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  for (const file of ['BalanceTokens.tsx', 'BalanceTokenRow.tsx']) {
    const source = stripComments(readFileSync(path.join(WEB, 'components/home', file), 'utf8'));
    check(`${file} has no raw hex`, !/#[0-9a-f]{3,8}\b/i.test(source));
  }
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
