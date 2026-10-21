/**
 * `npm run check:activity-bands` — the ledger's arithmetic, not its paint.
 *
 * A screenshot proves a band rendered; it cannot prove a pending row LEFT the month
 * it used to sit in, that no row was dropped between the two bands, or that a page
 * boundary in the middle of a month did not produce a second heading for it. Those
 * are the failure modes of #95, and they are all pure functions.
 */
import { appendPage, bandsOf, groupByDay, monthLabel } from '../components/activity/activity.format.ts';

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
function row(date, status = 'completed', extra = {}) {
  seq += 1;
  return {
    id: `t${seq}`,
    merchant: `Merchant ${seq}`,
    category: 'Payment',
    amount: -100,
    direction: 'out',
    currency: 'KES',
    date: new Date(date),
    status,
    ...extra,
  };
}

function labelsOf(bands) {
  return bands.map((band) => band.label);
}

function rowsOf(bands) {
  return bands.flatMap((band) => band.days.flatMap((day) => day.transactions));
}

/** The whole path the screen takes: rows -> day groups -> bands. */
function bandsFor(transactions) {
  return bandsOf(groupByDay(transactions, TODAY), TODAY);
}

console.log('a ledger with one pending payment and two settled months:');
{
  const bands = bandsFor([
    row('2026-10-21T08:00:00+03:00'),
    row('2026-10-14T12:00:00+03:00', 'pending'),
    row('2026-09-30T18:00:00+03:00'),
    row('2026-09-02T11:00:00+03:00'),
  ]);

  check('three bands: Pending, This month, September', labelsOf(bands).join('|') === 'Pending|This month|September', labelsOf(bands).join('|'));
  check('the pending band is first and marked as the state band', bands[0].pending === true);
  check('date bands are not marked as the state band', bands.slice(1).every((band) => band.pending === false));
  check(
    'the pending row left its date: This month holds only the settled one',
    bands[1].days.flatMap((day) => day.transactions).length === 1
  );
  check('the pending band holds exactly that row', rowsOf([bands[0]]).filter((t) => t.status === 'pending').length === 1);
  check('no row was lost between the bands', rowsOf(bands).length === 4, `${rowsOf(bands).length} of 4`);
  check('no row appears twice', new Set(rowsOf(bands).map((t) => t.id)).size === 4);
}

console.log('a ledger with nothing pending:');
{
  const bands = bandsFor([row('2026-10-21T08:00:00+03:00'), row('2026-10-20T08:00:00+03:00')]);

  check('the Pending band does not render', !labelsOf(bands).includes('Pending'), labelsOf(bands).join('|'));
  check('the bands are months only', labelsOf(bands).join('|') === 'This month', labelsOf(bands).join('|'));
  check('both days are grouped under it', bands[0].days.length === 2);
}

console.log('a day that is both pending and settled:');
{
  const bands = bandsFor([
    row('2026-10-21T08:00:00+03:00'),
    row('2026-10-21T09:00:00+03:00', 'pending'),
  ]);
  const pending = bands.find((band) => band.pending);
  const month = bands.find((band) => !band.pending);

  check('the day splits across the two bands rather than vanishing from one', pending.days.length === 1 && month.days.length === 1);
  check('the same day key is used in both', pending.days[0].key === month.days[0].key);
  check('nothing was duplicated or dropped', rowsOf(bands).length === 2);
}

console.log('month labels:');
{
  check('the month being lived in says so', monthLabel(new Date('2026-10-03T12:00:00+03:00'), TODAY) === 'This month');
  check('an earlier month in the same year is named', monthLabel(new Date('2026-08-03T12:00:00+03:00'), TODAY) === 'August');
  check(
    'another year keeps its year',
    monthLabel(new Date('2025-08-03T12:00:00+03:00'), TODAY) === 'August 2025',
    monthLabel(new Date('2025-08-03T12:00:00+03:00'), TODAY)
  );
}

console.log('a page boundary inside one month:');
{
  const firstPage = groupByDay([row('2026-10-21T08:00:00+03:00'), row('2026-10-20T08:00:00+03:00')], TODAY);
  const secondPage = [row('2026-10-19T08:00:00+03:00'), row('2026-10-18T08:00:00+03:00')];
  const bands = bandsOf(appendPage(firstPage, secondPage, TODAY), TODAY);

  check('the second page does not open a second band for the same month', labelsOf(bands).length === 1, labelsOf(bands).join('|'));
  check('it lands as extra day groups inside the one band', bands[0].days.length === 4, `${bands[0].days.length} days`);
  check('every row is still there', rowsOf(bands).length === 4);
}

console.log('states the bands do not know about:');
{
  const bands = bandsFor([row('2026-10-21T08:00:00+03:00', 'failed'), row('2026-08-01T08:00:00+03:00', 'failed')]);

  check('a failed row is not treated as pending', !labelsOf(bands).includes('Pending'), labelsOf(bands).join('|'));
  check('it stays in its own month', labelsOf(bands).join('|') === 'This month|August', labelsOf(bands).join('|'));
}

console.log('an empty history:');
{
  check('no rows, no bands', bandsOf([], TODAY).length === 0);
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
