/**
 * `npm run check:analytics-page` — the analytics tab is three bands, not eight blocks (#441).
 *
 * The defect this suite exists for is arrangement, so the assertions are about ORDER and MEMBERSHIP
 * rather than paint: a screenshot proves a band rendered, it cannot prove that `in` and `out` are the
 * two segments of one bar, that the qualifier has no heading of its own, or that the four demoted
 * panels are gone rather than merely unused.
 *
 * Seven claims:
 *
 *  1. **Three bands, in order.** Summary, then series, then detail, in the component that composes
 *     them.
 *  2. **The period control is in band 1, above the hero.** It governs the page, so it cannot sit
 *     above nothing.
 *  3. **The hero is `net`**, printed to the minor unit, with a caption naming the arithmetic and the
 *     window: a net with no operands is a number nobody can check.
 *  4. **`in` and `out` are one bar, not a row of figures.** Two segments, each labelled with its own
 *     amount, and a fee caption that is not a third segment.
 *  5. **The qualifier is one sentence with no heading**, so consistency and settlement cannot grow
 *     back into panels.
 *  6. **Band 3 offers three lists, the windowed one first**, and the all-time list says so in its own
 *     label.
 *  7. **The demoted files are gone and imported nowhere**, which is what stops two layouts living in
 *     one tab.
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

console.log('three bands, in order:');
{
  const source = read('../components/activity/ActivityAnalytics.tsx');

  check('the summary band comes first', source.indexOf('<AnalyticsSummaryBand') < source.indexOf('<AnalyticsSeriesBand'));
  check('the series band is second', source.indexOf('<AnalyticsSeriesBand') < source.indexOf('<AnalyticsDetailBand'));
  check('there are exactly three bands', (source.match(/<Analytics(Summary|Series|Detail)Band/g) ?? []).length === 3);
}

console.log('the period control is band 1, and the hero is net:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.band1));

  check('the picker renders', /role="group"/.test(html));
  check('it comes before the figure', html.indexOf('role="group"') < html.indexOf('KES 1,250.00'));
  check('the hero is the net', html.includes('KES 1,250.00'));
  check('and it is the largest figure on the page', html.includes('whitespace-nowrap'));
  check('the caption names the arithmetic', html.includes('Money in minus money out, last 30 days'));
  check('the caption names the window', html.includes('last 30 days'));
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

console.log('the qualifier is a sentence, not a panel:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsSummaryBand, DayRow.band1));

  check('it says how many days were active', html.includes('18 of the last 30 days had a payment'));
  check('it names the dry spell', html.includes('last one 2 days ago'));
  check('it says nothing is pending', html.includes('Nothing pending'));
  check('and it has no heading of its own', !html.includes('<h3') && !html.includes('Consistency'));
}

console.log('band 3 is one slot, three questions:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsDetailBand, DayRow.band3));
  // The label sits inside the tab's own span, so the text is the button's, tags stripped.
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );

  check('three tabs', tabs.length === 3, tabs.join(' | '));
  check('the windowed list lands first', tabs[0] === 'Where it goes', tabs[0]);
  check('the all-time list says so', tabs[1] === 'Who pays · all time', tabs[1]);
  check('and the last asks when', tabs[2] === 'When', tabs[2]);
  check('every row is a bar plus a name', merchantShare('2500', '5000') === 50);
  check('the largest row is the full width', merchantShare('5000', '5000') === 100);
  check('a tiny merchant is still visible', merchantShare('10', '5000') === 4);
}

console.log('below the floor, no shape is drawn:');
{
  const html = renderToStaticMarkup(createElement(AnalyticsSeriesBand, DayRow.seriesBelowFloor));

  check('the band says why', html.includes('Not enough movement in this period'));
  check('and draws no bars', !html.includes('title="2026-11-'));
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
