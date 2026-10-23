/**
 * `npm run check:activity-search` — finding a payment by who it was to.
 *
 * The search is a filter over rows the screen already holds, so its rules are pure
 * functions and this suite is where they are pinned: which field a query is allowed
 * to match, that a query with a letter in it never comes back because of a figure,
 * that a band with no matches is dropped rather than drawn empty, and that clearing
 * returns every row that was there before. A screenshot can show a filled field; it
 * cannot show any of that.
 *
 * The bands are built through the real path (`groupByDay` -> `bandsOf`), so this
 * also fails if pruning changes the order or the band a row sits under.
 */
import {
  countMatches,
  filterBands,
  isAmountQuery,
  matchesQuery,
  normalizeQuery,
  queryParam,
} from '../components/activity/activity.search.ts';
import { bandsOf, groupByDay } from '../components/activity/activity.format.ts';
import { ACTIVITY_SEARCH_COPY } from '../components/activity/ActivitySearch.constants.ts';

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

/** A fixed clock: bands are computed against a `today`, so the check owns one. */
const TODAY = new Date('2026-10-21T09:00:00+03:00');

let seq = 0;
function row(overrides = {}) {
  seq += 1;
  return {
    id: `t${seq}`,
    merchant: 'Akinyi Groceries',
    category: 'Payment',
    amount: -1250,
    direction: 'out',
    currency: 'KES',
    date: new Date('2026-10-21T09:00:00+03:00'),
    status: 'completed',
    payeeHandle: null,
    to: null,
    from: null,
    ...overrides,
  };
}

function bandsFor(transactions) {
  return bandsOf(groupByDay(transactions, TODAY), TODAY);
}

function ids(bands) {
  return bands.flatMap((band) => band.days.flatMap((day) => day.transactions.map((t) => t.id)));
}

function labels(bands) {
  return bands.map((band) => band.label).join('|');
}

/**
 * One account's ledger: two payments to the same shop, one week apart and in two
 * months; a coffee; a transfer named by the handle that was signed; and a row whose
 * only name is the address the money went to.
 */
const WALLET = '0x9f2c4b7e5d1a0c3f8b62d4e7a91c5b8d0f3e6a41b';
const LEDGER = [
  row({ id: 'aky-oct', date: new Date('2026-10-21T09:00:00+03:00') }),
  row({ id: 'akai-pending', date: new Date('2026-10-22T08:00:00+03:00'), amount: -75, status: 'pending' }),
  row({ id: 'java', merchant: 'Java House', amount: -450, date: new Date('2026-10-20T12:00:00+03:00') }),
  row({
    id: 'handle',
    merchant: 'Sent to 0x4d1e…77aa',
    amount: -600,
    payeeHandle: 'wanjiku',
    date: new Date('2026-10-19T12:00:00+03:00'),
  }),
  row({ id: 'address', merchant: 'Sent to 0x9f2c…a41b', amount: -300, to: WALLET, date: new Date('2026-10-18T12:00:00+03:00') }),
  row({ id: 'aky-sep', date: new Date('2026-09-12T10:00:00+03:00') }),
];
const BANDS = bandsFor(LEDGER);

console.log('typing the first letters of a name:');
{
  const found = filterBands(BANDS, normalizeQuery('Aki'));

  check('the shop comes back', ids(found).includes('aky-oct'));
  check('every payment to it comes back, across both months', ids(found).length === 3, ids(found).join(','));
  check('what did not match is gone', !ids(found).includes('java') && !ids(found).includes('handle'));
  check('newest first is the server order, kept', ids(found).join(',') === 'akai-pending,aky-oct,aky-sep', ids(found).join(','));
  check('the pending match is still in the Pending band', labels(found).startsWith('Pending'), labels(found));
  check('the bands it did not touch are dropped, and its own are kept in order', labels(found) === 'Pending|This month|September', labels(found));
  check('matching is case and space insensitive', ids(filterBands(BANDS, normalizeQuery('  AKI  '))).join(',') === ids(found).join(','));
}

console.log('the other names a row carries:');
{
  check('the handle gives the payment a name too', ids(filterBands(BANDS, normalizeQuery('wanjiku'))).join(',') === 'handle');
  check('part of the address behind the name finds the row', ids(filterBands(BANDS, normalizeQuery('9f2c4b'))).join(',') === 'address');
  check('the address is matched without case', matchesQuery(LEDGER[4], normalizeQuery(WALLET.toUpperCase().slice(0, 10))) === true);
  check('a category is not a name, so it does not match', matchesQuery(row({ merchant: 'Java House', category: 'Transfer' }), normalizeQuery('transfer')) === false);
}

console.log('amounts:');
{
  const found = filterBands(BANDS, normalizeQuery('1250'));

  check('a number finds the rows with that figure', ids(found).join(',') === 'aky-oct,aky-sep', ids(found).join(','));
  check('the thousands separator the row shows is accepted', ids(filterBands(BANDS, normalizeQuery('1,250.00'))).join(',') === 'aky-oct,aky-sep');
  check('a currency word in front of it is accepted', ids(filterBands(BANDS, normalizeQuery('kes 450'))).join(',') === 'java');
  check('a figure matches even when the name does not', ids(filterBands(BANDS, normalizeQuery('450'))).join(',') === 'java');
  check('a decimal query is a number', isAmountQuery('1250.5') === true);
}

console.log('a query with a letter in it is never an amount:');
{
  check('not classified as a number', isAmountQuery('a1250') === false);
  check('not classified as a number, even with digits and a space', isAmountQuery('j 450') === false);
  check('it does not come back on the figure alone', matchesQuery(row({ merchant: 'Java House', amount: -1250 }), normalizeQuery('j1250')) === false);
  check('and a name query finds nothing when no name matches', filterBands(BANDS, normalizeQuery('zzz')).length === 0);
  /** The gate's load-bearing case: stripping a currency word leaves NO digits, and an
   *  empty string is a substring of every figure. Without the classification, "kes"
   *  would return the whole ledger. */
  check('a currency word on its own is not a number', isAmountQuery('kes') === false);
  check('so it matches nothing rather than every figure', filterBands(BANDS, normalizeQuery('kes')).length === 0);
  check('a word that merely contains "kes" is not a number either', matchesQuery(row({ merchant: 'Java House', amount: -1250 }), normalizeQuery('kesho')) === false);
}

console.log('a query with no matches:');
{
  const title = ACTIVITY_SEARCH_COPY.noMatches('zzz');
  const { noMatchesBody, noMatchesMore } = ACTIVITY_SEARCH_COPY;

  check('it says so in words, not an empty page', title.includes('No payments match'), title);
  check('it names the query back', title.includes('zzz'), title);
  check('it offers the way out', noMatchesBody.toLowerCase().includes('clear'), noMatchesBody);
  check('a partly loaded history is not claimed to be the whole one', noMatchesMore.includes('Load more'), noMatchesMore);
  check('the two bodies are different sentences', noMatchesBody !== noMatchesMore);
  check('no em dash in either', !`${title}${noMatchesBody}${noMatchesMore}`.includes('—'));
  check('countMatches agrees there is nothing', countMatches(filterBands(BANDS, 'zzz')) === 0);
}

console.log('clearing:');
{
  const cleared = filterBands(BANDS, normalizeQuery(''));

  check('an empty query returns every band', labels(cleared) === labels(BANDS), labels(cleared));
  check('and every row', countMatches(cleared) === LEDGER.length, `${countMatches(cleared)} of ${LEDGER.length}`);
  check('whitespace counts as empty', normalizeQuery('   ') === '');
  check('so whitespace shows the whole ledger too', countMatches(filterBands(BANDS, normalizeQuery('   '))) === LEDGER.length);
  check('a cleared query leaves no ?q= behind', queryParam('') === null && queryParam('   ') === null);
  check('a typed query is written trimmed', queryParam('  aky ') === 'aky');
  check('the unfiltered page is not mutated by a search', countMatches(BANDS) === LEDGER.length, `${countMatches(BANDS)} of ${LEDGER.length}`);
}

console.log('what a screen reader hears:');
{
  check('one match reads as one', ACTIVITY_SEARCH_COPY.match(1) === '1 payment matches');
  check('several matches read as several', ACTIVITY_SEARCH_COPY.match(3) === '3 payments match');
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
