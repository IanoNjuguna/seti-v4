/**
 * `npm run check:claim-band` — the claims band on Activity (#465).
 *
 * The defect it exists for: a customer creates a claim, shares the link, and the claim then exists
 * nowhere in the app. `GET /users/:id/requests` answered all along and `listAsks()` had no caller,
 * so the one screen that could say "you are still waiting on KES 500" never asked.
 *
 * So this pins the selection and the words, against the REAL component:
 *
 *  1. **A settled claim is not in the band.** The payment that closed it is already a row in the
 *     ledger, with its own receipt; printing both puts one event on the screen twice.
 *  2. **Every other state is kept**, because each is a claim that can no longer be paid and would
 *     otherwise vanish: `open` → Waiting, `cancelled` → Withdrawn, `expired` → Lapsed.
 *  3. **Cancel exists only while a claim can still be paid**, and it names the amount — a list of
 *     identical "Cancel" buttons is not usable by a screen reader.
 *  4. **An account with no claims renders nothing at all**, not an empty heading.
 *  5. **The amount is currency-formatted and tabular**, never a bare number.
 *  6. **The band says nothing about how many payments settle a claim**, because that is #449 and
 *     still undecided.
 *
 * Run from `web/`: npm run check:claim-band (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivityClaimsBand } from '../components/activity/ActivityClaimsBand.tsx';
import { claimRows } from '../components/activity/claims.ts';
import { CLAIMS_COPY } from '../components/activity/ActivityClaims.constants.ts';

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

/** One claim as the server answers it, so the assertion is about the row, not about a mock. */
function claim(overrides) {
  return {
    publicId: 'abc123def456abc123',
    destinationHandle: 'ian',
    amount: '500.00',
    currency: 'KES',
    memo: 'Rent',
    status: 'open',
    createdAt: '2026-11-08T09:30:00.000Z',
    expiresAt: '2026-12-08T09:30:00.000Z',
    settledTxHash: null,
    ...overrides,
  };
}

const OPEN = claim({});
const EXPIRED = claim({ publicId: 'exp000000000000001', memo: 'The haircut', status: 'expired' });
const WITHDRAWN = claim({ publicId: 'can000000000000001', memo: 'Half the taxi', status: 'cancelled' });
const SETTLED = claim({ publicId: 'set000000000000001', memo: 'Lunch money', status: 'settled' });

const NOOP = () => {};
const render = (rows, extra = {}) =>
  renderToStaticMarkup(
    createElement(ActivityClaimsBand, { rows, cancelling: null, error: null, onCancel: NOOP, ...extra })
  );

console.log('\na settled claim is the ledger\'s, not the band\'s\n');
{
  const rows = claimRows([OPEN, SETTLED, EXPIRED, WITHDRAWN]);

  check('the settled claim is dropped', rows.length === 3, String(rows.length));
  check(
    'and the three that can no longer be paid are kept, in the server\'s order',
    rows.map((row) => row.publicId).join(',') === [OPEN, EXPIRED, WITHDRAWN].map((c) => c.publicId).join(',')
  );

  const markup = render(rows);
  check('its memo never reaches the screen', !markup.includes('Lunch money'));
  check('and nothing is labelled Paid here', !markup.includes(`>${CLAIMS_COPY.states.settled}<`));
}

console.log('\nevery state says what it is, in the customer\'s words\n');
{
  const rows = claimRows([OPEN, EXPIRED, WITHDRAWN]);
  const markup = render(rows);

  check('open reads Waiting', markup.includes(CLAIMS_COPY.states.open), CLAIMS_COPY.states.open);
  check('expired reads Lapsed', markup.includes(CLAIMS_COPY.states.expired));
  check('cancelled reads Withdrawn', markup.includes(CLAIMS_COPY.states.cancelled));
  check(
    'the three words are distinct',
    new Set(Object.values(CLAIMS_COPY.states)).size === 4,
    String(new Set(Object.values(CLAIMS_COPY.states)).size)
  );
}

console.log('\nthe row carries the figure the customer wrote\n');
{
  const rows = claimRows([OPEN]);
  const markup = render(rows);

  check('the amount is currency-formatted', markup.includes('KES') && markup.includes('500.00'));
  check('and set in tabular figures', markup.includes('font-tabular'));
  check(
    'the memo is the title',
    markup.includes('Rent') && rows[0].title === 'Rent',
    rows[0].title
  );
  check(
    'and the subtitle names the name it is paid to',
    markup.includes('paid to @ian'),
    rows[0].subtitle
  );
}

console.log('\na claim with no memo is still a row\n');
{
  const rows = claimRows([claim({ memo: '' })]);
  check('the title falls back to Claim', rows[0].title === CLAIMS_COPY.titleFallback, rows[0].title);
  check('and it is not blank in the markup', render(rows).includes(CLAIMS_COPY.titleFallback));
}

console.log('\ncancel belongs to the one state that can still be paid\n');
{
  const openRows = claimRows([OPEN]);
  const settledRows = claimRows([EXPIRED, WITHDRAWN]);
  const cancelCount = (markup) => (markup.match(/Cancel the claim for/g) ?? []).length;

  check('the open claim offers it', cancelCount(render(openRows)) === 1);
  check('a lapsed or withdrawn one does not', cancelCount(render(settledRows)) === 0);
  check(
    'and the label names the amount, so a list of them is usable',
    render(openRows).includes(CLAIMS_COPY.cancelLabel(openRows[0].amount))
  );
  check(
    'a claim being cancelled says so instead of firing twice',
    render(openRows, { cancelling: OPEN.publicId }).includes(CLAIMS_COPY.cancelling)
  );
}

console.log('\nan account with no claims gets no band\n');
{
  check('an empty list renders nothing at all', render([]) === '');
  check(
    'a list of only settled claims renders nothing either',
    render(claimRows([SETTLED])) === ''
  );
  const withError = render([], { error: CLAIMS_COPY.cancelFailed });
  /* React escapes the apostrophe in "Couldn't" to `&#x27;`, so the assertion is about the copy
     that reaches a browser, not the string in the source. */
  const escaped = CLAIMS_COPY.cancelFailed.replace(/'/g, '&#x27;');
  check('a failed cancel still has somewhere to speak', withError.includes(escaped));
}

console.log('\nthe band is wired to the reads that exist\n');
{
  const hook = readFileSync(new URL('../components/activity/useClaims.ts', import.meta.url), 'utf8');
  const page = readFileSync(
    new URL('../app/(product)/app/activity/page.tsx', import.meta.url),
    'utf8'
  );

  check('useClaims reads the list route', hook.includes('listAsks('));
  check('and cancels through the cancel route', hook.includes('cancelAsk('));
  check('a failed read does not read as "no claims"', hook.includes('setRows([])'));
  check('the page mounts the band', page.includes('<ActivityClaims />'));
  check(
    'above the ledger, not inside it',
    page.indexOf('<ActivityClaims />') < page.indexOf('<ActivityList'),
    'order'
  );
}

console.log('\nand nothing here promises a single payment (#449)\n');
{
  const copy = readFileSync(
    new URL('../components/activity/ActivityClaims.constants.ts', import.meta.url),
    'utf8'
  );
  for (const phrase of ['one payment', 'only once', 'paid so far', 'settles it']) {
    check(`no "${phrase}"`, !copy.toLowerCase().includes(phrase));
  }
}

console.log('\n' + '-'.repeat(74));
if (failed > 0) {
  console.log(`${failed} CHECK(S) FAILED.`);
  process.exit(1);
}
console.log(`All ${passed} checks passed.`);
