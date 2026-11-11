/**
 * `npm run check:analytics-page` — the analytics tab is three bands, not eight blocks (#441), and
 * the figure it leads with follows the money (#534).
 *
 * The defect this suite exists for is arrangement, so the assertions are about ORDER and MEMBERSHIP
 * rather than paint: a screenshot proves a band rendered, it cannot prove that `in` and `out` are the
 * two segments of one bar, that the qualifier has no heading of its own, or that the four demoted
 * panels are gone rather than merely unused.
 *
 * Eight claims:
 *
 *  1. **Three bands, in order.** Summary, then series, then detail, in the component that composes
 *     them.
 *  2. **The period control is in band 1, above the hero.** It governs the page, so it cannot sit
 *     above nothing.
 *  3. **The hero is the direction that moved.** Money in when anything came in; money out when
 *     nothing did. A window with no inflow must never open on a negative figure, because a week of
 *     paying merchants would then read as a loss (#534).
 *  4. **The three figures under the bar** (`Payments`, `Typical payment`, `Net`) carry their values,
 *     so the arithmetic the hero used to state in a caption is still checkable.
 *  5. **`in` and `out` are one bar, not a row of figures.** Two segments, each labelled with its own
 *     amount, and a fee caption that is not a third segment — and no caption at all when the fee is
 *     zero.
 *  6. **The qualifier is ONE sentence with no heading**, and a pending movement outranks the
 *     consistency line rather than both printing.
 *  7. **Band 3 offers three switches, the windowed one first**, with the all-time scope stated in the
 *     panel instead of inside the label.
 *  8. **Band 2 draws its days below the old fifty-payment floor**, which is where the page used to
 *     print a sentence instead of a chart.
 *
 * Run from `web/`: npm run check:analytics-page (part of the root `verify` gate).
 */
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalyticsSummaryBand } from '../components/activity/AnalyticsSummaryBand.tsx';
import { AnalyticsSeriesBand } from '../components/activity/AnalyticsSeriesBand.tsx';
import { AnalyticsDetailBand } from '../components/activity/AnalyticsDetailBand.tsx';
import { merchantShare } from '../components/activity/AnalyticsMerchants.tsx';
import { splitShare } from '../components/activity/AnalyticsSplitBar.tsx';
import { heroDirection } from '../components/activity/Analytics.constants.ts';
import { DayRow } from './fixtures/analytics.fixture.ts';

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

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

/** The hero figure's own text: the one element pinned to a single line. */
function heroFigure(html) {
  const match = html.match(/whitespace-nowrap[^>]*>([^<]*)</);
  return match ? match[1] : '';
}

console.log('three bands, in order:');
{
  const source = read('../components/activity/ActivityAnalytics.tsx');

  check('the summary band comes first', source.indexOf('<AnalyticsSummaryBand') < source.indexOf('<AnalyticsSeriesBand'));
  check('the series band is second', source.indexOf('<AnalyticsSeriesBand') < source.indexOf('<AnalyticsDetailBand'));
  check('there are exactly three bands', (source.match(/<Analytics(Summary|Series|Detail)Band/g) ?? []).length === 3);
}

console.log('the period control is band 1, and the hero is the direction that moved:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.band1));

  check('the picker renders', /role="group"/.test(html));
  check('it comes before the figure', html.indexOf('role="group"') < html.indexOf('KES 5,000.00'));
  check('with inflow, the hero is money in', html.includes('Money in') && heroFigure(html) === 'KES 5,000.00');
  check('the caption names the window', html.includes('last 30 days'));
}
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.payerOnly));

  check('with no inflow, the hero is money out', html.includes('Money out'));
  check('and prints the outflow', heroFigure(html) === 'KES 148.03', heroFigure(html));
  check('never the net', !heroFigure(html).includes('-'), heroFigure(html));
  check('the rule itself cannot hand back a minus', heroDirection({ in: '0.00', out: '148.03' }).value === '148.03');
}

console.log('the three figures under the bar:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.band1));

  check('payments', html.includes('Payments') && html.includes('>60<'));
  check('the typical payment is the median of the hero direction', html.includes('Typical payment') && html.includes('KES 1,000.00'));
  check('and the net is the subtraction of the bar', html.includes('Net') && html.includes('KES 1,250.00'));
}
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.payerOnly));

  check('a payer-only window sorts its own direction', html.includes('KES 10.21'), 'typical = paidOut.median');
  check('and still shows the net, small', html.includes('KES -148.03'));
}

console.log('money in and money out are one bar:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.band1));

  check('both directions are labelled', html.includes('Money in') && html.includes('Money out'));
  check('with their own amounts', html.includes('KES 5,000.00') && html.includes('KES 3,750.00'));
  check('the fee is a caption, not a segment', html.includes('Includes KES 75.00 fee'));
  check('the bar is decorative', html.includes('aria-hidden'));

  check('shares add up on the one bar', splitShare('5000', '3750').join('/') === '57/43', splitShare('5000', '3750').join('/'));
  check('a direction with nothing does not get a sliver', splitShare('5000', '0').join('/') === '100/0');
  check('an empty window is one neutral rule', splitShare('0', '0').join('/') === '0/0');
  check('a tiny direction still reads as present', splitShare('100000', '1')[1] === 2);
}
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.payerOnly));

  check('a zero fee gets no caption', !html.includes('Includes KES 0.00 fee'));
}

console.log('one qualifying sentence, and a pending movement outranks it:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.band1));

  check('it says how many days were active', html.includes('3 of the last 30 days had a payment'));
  check('it names the dry spell', html.includes('6 days ago'));
  check('and it does not also print the settlement line', !html.includes('Nothing pending'));
  check('it has no heading of its own', !html.includes('<h3') && !html.includes('Consistency'));
}
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.waiting));

  check('a movement in flight leads the sentence', html.includes('1 movement is still pending'), 'pending wins');
  check('and the consistency line is not printed beside it', !html.includes('3 of the last 30 days'));
}

console.log('band 3 is one slot of switches, three questions:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsDetailBand, DayRow.band3));
  // The label sits inside the switch's own span, so the text is the button's, tags stripped.
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );

  check('three switches', tabs.length === 3, tabs.join(' | '));
  check('the windowed list lands first', tabs[0] === 'Where it goes', tabs[0]);
  check('the second is named, not scoped', tabs[1] === 'Who pays', tabs[1]);
  check('and the last asks when', tabs[2] === 'When', tabs[2]);
  check('the all-time scope is stated in the panel', html.includes('Since your first payment'));
  check('every row is a bar plus a name', merchantShare('2500', '5000') === 50);
  check('the largest row is the full width', merchantShare('5000', '5000') === 100);
  check('a tiny merchant is still visible', merchantShare('10', '5000') === 4);
}
{
  const html = renderToStaticMarkup(createElement(AnalyticsDetailBand, DayRow.onePayer));

  check('a payer who has paid once is one clause', html.includes('1 wallet has paid you'));
  check('with no line of zeroes beside it', !html.includes('0 came back') && !html.includes('not in 30 days'));
}

console.log('the days are drawn below the old floor:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsSeriesBand, DayRow.seriesQuiet));

  check('the band names itself without repeating the window', html.includes('Payments per day'));
  check('twelve payments in thirty days still draw bars', html.includes('title="2026-11-'));
  check('and the band does not apologise instead', !html.includes('Not enough movement'));
}

console.log('the demoted blocks are gone, not merely unused:');
{
  const gone = ['AnalyticsFigures', 'AnalyticsHalves', 'AnalyticsConsistency', 'AnalyticsSettlement'];

  for (const name of gone) {
    const file = new URL(`../components/activity/${name}.tsx`, import.meta.url);
    check(`${name}.tsx is deleted`, !existsSync(file));
  }

  const composer = read('../components/activity/ActivityAnalytics.tsx');
  check('and none of them is imported', gone.every((name) => !composer.includes(name)));
}

console.log(`\n${passed} assertions passed.`);
if (failed > 0) {
  console.log(`${failed} FAILED.`);
  process.exit(1);
}
