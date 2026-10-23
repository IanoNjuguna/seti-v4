/**
 * `npm run check:pay-tiers` — the two display tiers of the public pay page (#154).
 *
 * Anyone can make a charge naming any address. So the page owes the payer a distinction
 * it can act on: a merchant a person at Seti has reviewed, or a stranger's request. Both
 * pages are rendered here through the REAL component tree (frame included, so the mark on
 * the page is part of the proof), at the tier the server would resolve, and read as HTML.
 *
 * Six things are pinned:
 *
 *  1. **The rule.** The tier takes three answers and nothing else: a name bound to this
 *     address, a claim signature that holds, and a merchant record someone reviewed. A
 *     name that verifies with no review behind it is NOT the verified tier, which is the
 *     case a volume-based or age-based shortcut would have got wrong.
 *  2. **What the verified tier adds.** The merchant's name and a mark that says what was
 *     checked, and nothing about the money.
 *  3. **What the unverified tier keeps.** The address, our mark, "Payment facilitated by
 *     Seti" and the charge id — and the one agreed sentence saying the recipient is not
 *     verified with Seti. A name is NOT drawn here: an unverified page cannot display a
 *     name the address did not sign for.
 *  4. **Nothing is removed.** Every fact the unverified page draws is drawn on the
 *     verified one, asserted by loop so a fact added to one tier and not the other fails.
 *     Stronger: ONE charge rendered twice, differing only inside the recipient block.
 *  5. **Display only.** Neither page claims custody, a guarantee, a refund or that Seti
 *     pays the merchant, and both keep the fee, the total and the address identical.
 *  6. **The stored attribute exists.** The merchant record carries the review date and
 *     the evidence that earned it, with a CHECK that refuses one without the other, so
 *     the badge is never fed by a field nobody can audit.
 *
 * Run from `web/`: npm run check:pay-tiers (part of the root `verify` gate).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PayPageFrame } from '../components/pay-public/PayPageFrame.tsx';
import { PayPublicView } from '../components/pay-public/PayPublicView.tsx';
import { PAY_COPY, PAYER_COPY } from '../components/pay-public/PayPublic.constants.ts';
import { payeeIdentity, payeeTier } from '../components/pay-public/pay-public.tier.ts';
import { FIXTURE_PAYEE_DIRECTORY, fixtureChargeSource } from '../lib/charges/charge.fixture.ts';
import { loadCharge } from '../lib/charges/load-charge.ts';

const NOW = new Date('2026-10-22T09:00:00.000Z');

/** A reviewed business: the only fixture that reaches the verified tier. */
const MERCHANT_ID = 'ch_3c8d1f6a7b24';
const MERCHANT_ADDRESS = '0xb4c6c9290dd4bc6e498670c6e1e1f978b118bbda';
const MERCHANT_NAME = 'Mwangi Suppliers';
const MERCHANT_HANDLE = 'mwangisuppliers';

/** A name whose claim verifies, with no reviewed merchant behind it. */
const NAMED_NOT_REVIEWED_ID = 'ch_8f2c1a4e7b9d';
const PERSON_NAME = 'Ian Njuguna';

/** A claim whose signature no longer holds. */
const LAPSED_ID = 'ch_7a1e3d5b9c22';
const LAPSED_NAME = 'Kade Stores';

/** No name for the address at all. */
const STRANGER_ID = 'ch_2b6d9c0f4a13';
const STRANGER_ADDRESS = '0x596f4c3b5856d7acd8453666db0624ed3ed3caad';

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

/** A directory that answers like a backend read would, so one charge can be drawn twice. */
function directoryReturning(answer) {
  return {
    async findNamedPayee() {
      return answer;
    },
  };
}

const REVIEWED = directoryReturning({
  handle: MERCHANT_HANDLE,
  name: MERCHANT_NAME,
  address: MERCHANT_ADDRESS,
  verified: true,
  merchantVerifiedAt: '2026-10-02T09:00:00.000Z',
});

const UNREVIEWED = directoryReturning({
  handle: MERCHANT_HANDLE,
  name: MERCHANT_NAME,
  address: MERCHANT_ADDRESS,
  verified: true,
  merchantVerifiedAt: null,
});

async function load(id, deps = {}) {
  return loadCharge(id, { now: NOW, source: fixtureChargeSource, directory: FIXTURE_PAYEE_DIRECTORY, ...deps });
}

/** THE PAGE, frame included, as a browser with JavaScript off receives it. */
function render(result, payer = 'wallet') {
  return renderToStaticMarkup(
    createElement(
      PayPageFrame,
      null,
      createElement(PayPublicView, {
        charge: result.charge,
        payee: result.payee,
        status: result.status,
        payer,
      })
    )
  );
}

/**
 * The page cut at the two seams that bound everything the tier's own vocabulary reaches:
 * the recipient eyebrow above it, and the payer's switch links below it. If the head and
 * the tail of two renderings are byte-identical, every difference between them lives in
 * between — the recipient block and the one sentence under the fee rows that names the
 * recipient (`feeNote`). Nothing else about the page may move.
 */
function splitAtTier(html) {
  const eyebrow = html.indexOf('>Paying<');
  const links = html.indexOf(PAYER_COPY.switchEmpty, eyebrow);
  return {
    head: html.slice(0, eyebrow),
    block: html.slice(eyebrow, links),
    tail: html.slice(links),
  };
}

const verifiedCharge = await load(MERCHANT_ID, { directory: REVIEWED });
const unverifiedCharge = await load(MERCHANT_ID, { directory: UNREVIEWED });
const namedNotReviewed = await load(NAMED_NOT_REVIEWED_ID);
const lapsed = await load(LAPSED_ID);
const stranger = await load(STRANGER_ID);

if (
  [verifiedCharge, unverifiedCharge, namedNotReviewed, lapsed, stranger].some(
    (result) => result.kind !== 'charge'
  )
) {
  console.log('FAIL  the fixture answered a charge for every case this check renders');
  process.exit(1);
}

const page = {
  verified: render(verifiedCharge),
  unverified: render(unverifiedCharge),
  namedNotReviewed: render(namedNotReviewed),
  lapsed: render(lapsed),
  stranger: render(stranger),
};

console.log('the tier takes three answers, and nothing else:');
check(
  'a name bound to the address, a claim that holds, and a reviewed merchant is the verified tier',
  payeeTier(verifiedCharge.payee) === 'verified'
);
check(
  'the same name with no reviewed merchant behind it is NOT the verified tier',
  payeeTier(unverifiedCharge.payee) === 'unverified'
);
check(
  'a claim whose signature no longer holds is not the verified tier, whatever the record says',
  payeeTier(lapsed.payee) === 'unverified'
);
check('an address with no Seti name is not the verified tier', payeeTier(stranger.payee) === 'unverified');
check(
  'the tier is read from the merchant record, not from the amount, the memo or the status',
  payeeTier(namedNotReviewed.payee) === 'unverified' &&
    namedNotReviewed.charge.amount !== verifiedCharge.charge.amount
);
check(
  'and the same charge drawn with two directory answers lands in two tiers',
  verifiedCharge.charge.id === unverifiedCharge.charge.id &&
    verifiedCharge.charge.amount === unverifiedCharge.charge.amount &&
    payeeTier(verifiedCharge.payee) !== payeeTier(unverifiedCharge.payee)
);
check(
  'a directory that does not answer the review date is not read as a review',
  await (async () => {
    const silent = {
      async findNamedPayee() {
        return { handle: MERCHANT_HANDLE, name: MERCHANT_NAME, address: MERCHANT_ADDRESS, verified: true };
      },
    };
    const result = await load(MERCHANT_ID, { directory: silent });
    return result.kind === 'charge' && payeeTier(result.payee) === 'unverified';
  })()
);

console.log('the verified tier adds the name, and a mark that says what was checked:');
check('the merchant’s name is the heading', page.verified.includes(`>${MERCHANT_NAME}<`));
check(
  'the heading the block draws is the tier’s own vocabulary',
  payeeIdentity(verifiedCharge.payee).heading === MERCHANT_NAME &&
    payeeIdentity(unverifiedCharge.payee).heading === `@${MERCHANT_HANDLE}`
);
check(`the verified mark is drawn`, page.verified.includes(PAY_COPY.verifiedBadge));
check('and the sentence behind the mark is drawn', page.verified.includes(PAY_COPY.verifiedNote));
check('the handle is still named', page.verified.includes(`@${MERCHANT_HANDLE}`));
check(
  'the mark is not the only thing telling a payer: the sentence is beside it',
  page.verified.indexOf(PAY_COPY.verifiedBadge) < page.verified.indexOf(PAY_COPY.verifiedNote)
);

console.log('the unverified tier draws a name it signed for, never one it did not:');
check('the unverified page keeps the handle, not the name', page.namedNotReviewed.includes(`@ian`));
check('the person’s name is NOT drawn on it', !page.namedNotReviewed.includes(PERSON_NAME));
check(`the lapsed claim keeps its handle`, page.lapsed.includes(`@kade-store`));
check('and its name is NOT drawn either, because that address no longer signs for it', !page.lapsed.includes(LAPSED_NAME));
check(
  'a stranger’s page has no name-shaped heading at all',
  !page.stranger.includes(MERCHANT_NAME) && !page.stranger.includes(LAPSED_NAME)
);

console.log('the unverified tier says so, in the agreed words:');
check(
  'the sentence is exactly the one agreed, character for character',
  PAY_COPY.unverifiedNote === 'The recipient is not verified with Seti. The address above is where the money goes.'
);
check('and it is drawn on every unverified page', ['namedNotReviewed', 'lapsed', 'stranger'].every((key) => page[key].includes(PAY_COPY.unverifiedNote)));
check(`the mark is drawn`, page.stranger.includes(PAY_COPY.unverifiedBadge));
check(
  'it reads as a statement about Seti, not an endorsement of the recipient',
  !/safe|trusted|secure|approved|recommended|guaranteed/i.test(PAY_COPY.unverifiedNote)
);
check(
  'no verified mark leaks into an unverified page',
  ['namedNotReviewed', 'lapsed', 'stranger'].every((key) => !page[key].includes(PAY_COPY.verifiedBadge))
);

console.log('the facts that never disappear, asserted by loop on BOTH tiers:');
{
  const FACTS = [
    { name: 'the address the money goes to', needle: MERCHANT_ADDRESS },
    { name: 'our facilitated-by line', needle: PAY_COPY.facilitatedBy },
    { name: 'the charge id', needle: MERCHANT_ID },
    { name: 'our own mark on the page', needle: `>${PAY_COPY.brand}<` },
  ];
  check('the fact list is the four a stranger’s page shows', FACTS.length === 4);
  for (const fact of FACTS) {
    check(`[unverified] ${fact.name} is drawn`, page.unverified.includes(fact.needle));
    check(`[verified] ${fact.name} is drawn too (nothing removed)`, page.verified.includes(fact.needle));
  }
  check(
    'the address is drawn before the facilitated-by line, so the line explains it',
    page.unverified.indexOf(MERCHANT_ADDRESS) < page.unverified.indexOf(PAY_COPY.facilitatedBy)
  );
  check(
    'a stranger’s page carries the same four facts',
    page.stranger.includes(STRANGER_ADDRESS) &&
      page.stranger.includes(PAY_COPY.facilitatedBy) &&
      page.stranger.includes(STRANGER_ID)
  );
}

console.log('one charge, two tiers: the difference is confined to the recipient block:');
{
  const a = splitAtTier(page.verified);
  const b = splitAtTier(page.unverified);
  check('both renderings were cut at the same two seams', a.head !== '' && a.tail !== '' && b.head !== '' && b.tail !== '');
  check('everything above the recipient is identical: state, amount, memo', a.head === b.head);
  check('everything from the payer links down is identical: the request, the fee, custody', a.tail === b.tail);
  check('and the recipient block itself is what differs', a.block !== b.block);
  check(
    'the block that differs is the name, the mark and the sentence, nothing else',
    a.block.includes(MERCHANT_NAME) && b.block.includes(`@${MERCHANT_HANDLE}`)
  );
  check(
    'the sentence under the fee rows still promises the same money to the same amount',
    page.verified.includes('receives the full KES 4,200.00') &&
      page.unverified.includes('receives the full KES 4,200.00')
  );
}

console.log('display only: the money is the same on both pages:');
{
  const verifiedAmounts = ['KES 4,200.00', 'KES 4,284.00', 'Platform fee (2%)'];
  check(
    'the amount, the fee row and the total are drawn on both',
    verifiedAmounts.every((text) => page.verified.includes(text) && page.unverified.includes(text))
  );
  check('the same charge id is on both', page.verified.includes(MERCHANT_ID) && page.unverified.includes(MERCHANT_ID));
  check(
    'the same address is on both, so the tier cannot redirect a payment',
    page.verified.includes(MERCHANT_ADDRESS) && page.unverified.includes(MERCHANT_ADDRESS)
  );
  check(
    'the custody sentence is drawn on both, once, in the same words',
    page.verified.split(PAY_COPY.custody).length === 2 && page.unverified.split(PAY_COPY.custody).length === 2
  );
}

console.log('neither page claims custody, a guarantee, or that Seti pays the merchant:');
{
  const FORBIDDEN = /guarantee|guaranteed|insured|refund|escrow|custody|we will pay|Seti pays|Seti holds your|backed by Seti/i;
  for (const key of ['verified', 'unverified', 'stranger']) {
    check(`[${key}] no guarantee, refund or custody claim`, !FORBIDDEN.test(page[key]), FORBIDDEN.exec(page[key])?.[0] ?? '');
  }
  check(
    'the verified sentence claims what was checked and no more',
    !/hold|pay the merchant|refund|guarantee/i.test(PAY_COPY.verifiedNote)
  );
}

console.log('the copy keeps the voice, and the words are not softened:');
{
  const strings = [
    PAY_COPY.verifiedBadge,
    PAY_COPY.verifiedNote,
    PAY_COPY.unverifiedBadge,
    PAY_COPY.unverifiedNote,
    PAY_COPY.facilitatedBy,
    PAY_COPY.requestLabel,
    PAY_COPY.noNameNote,
  ];
  check('no em dash and no exclamation mark', strings.every((text) => !text.includes('—') && !text.includes('!')));
  check('no token name appears', strings.every((text) => !/(OUSD|USDC|USDT0|pathUSD)/.test(text)));
  check(
    'no product vocabulary a payer has to learn',
    strings.every((text) => !/non-custodial|settlement|blockchain|on-chain|protocol/i.test(text))
  );
}

console.log('both tiers are width-independent, so 390 and 1280 draw the same block:');
{
  const blocks = [splitAtTier(page.verified).block, splitAtTier(page.unverified).block];
  check(
    'neither recipient block branches on a breakpoint',
    blocks.every((block) => !/\b(sm|md|lg|xl):/.test(block))
  );
  check(
    'the page frame is the fluid one, and it is the same on both',
    ['verified', 'unverified'].every((key) => page[key].includes('max-w-md') && page[key].includes('min-h-dvh'))
  );
  check(
    'the longest string drawn is the shortened address, so 42 characters never set the width',
    [page.verified, page.unverified, page.stranger].every((html) => !html.includes(`>${MERCHANT_ADDRESS}<`))
  );
}

console.log('the stored attribute exists, with the evidence that earned it:');
{
  const migration = readFileSync(
    new URL('../../backend/prisma/migrations/20261023120000_merchant_verification/migration.sql', import.meta.url),
    'utf8'
  );
  const schema = readFileSync(new URL('../../backend/prisma/schema.prisma', import.meta.url), 'utf8');
  const merchant = schema.slice(schema.indexOf('model Merchant'), schema.indexOf('model Transaction'));

  check('the migration adds the review date', migration.includes('ADD COLUMN "verifiedAt"'));
  check('and the evidence beside it', migration.includes('ADD COLUMN "verifiedEvidence"'));
  check(
    'a CHECK refuses one without the other, so a badge cannot be set without a reason',
    migration.includes('merchants_verified_evidence_chk') && migration.includes('btrim("verifiedEvidence")')
  );
  check(
    'both columns are nullable and additive, so the previous revision keeps running',
    !/ADD COLUMN[^;]*NOT NULL/i.test(migration) && migration.includes('ADD COLUMN')
  );
  check(
    'the schema declares both on the merchant record',
    merchant.includes('verifiedAt') && merchant.includes('verifiedEvidence')
  );
  check(
    'the tier reads the review date and nothing implicit',
    (() => {
      const source = readFileSync(
        new URL('../components/pay-public/pay-public.tier.ts', import.meta.url),
        'utf8'
      );
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      return (
        code.includes('merchantVerifiedAt') &&
        code.includes('payee.verified') &&
        !/amount|memo|volume|age\b|status/.test(code)
      );
    })()
  );
}

console.log('the route draws the frame, so the mark is part of the page in both tiers:');
{
  const route = readFileSync(new URL('../app/pay/[id]/page.tsx', import.meta.url), 'utf8');
  check('the route uses the one frame', route.includes('<PayPageFrame>'));
  check('and hands the charge to the view unchanged', route.includes('<PayPublicView'));
  check('the view draws the recipient with its charge id', (() => {
    const view = readFileSync(new URL('../components/pay-public/PayPublicView.tsx', import.meta.url), 'utf8');
    return view.includes('<PayRecipient payee={payee} chargeId={charge.id} />');
  })());
}

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
