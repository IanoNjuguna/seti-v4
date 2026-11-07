/**
 * `npm run check:analytics-bars` — the daily bar chart's two decisions (#404).
 *
 * A bar chart is easy to get subtly wrong in ways no screenshot reveals: a quiet day rendered shorter
 * than a closed one erases the difference between them, and a scale that is not the window's own peak
 * flattens a week of trading into a row of identical rectangles. Both are arithmetic, so both are
 * checked here rather than judged by eye.
 */
import { barHeight } from '../components/activity/AnalyticsDailyBars.tsx';

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

console.log('a bar is a share of the busiest day:');
{
  check('the busiest day is full height', barHeight(13, 13) === 100, String(barHeight(13, 13)));
  check('half the busiest is half the height', barHeight(5, 10) === 50, String(barHeight(5, 10)));
  check('a day with nothing is a stub, not a full bar', barHeight(0, 10) === 2, String(barHeight(0, 10)));

  /*
   * The floor is the point of the function: one payment against a busy month rounds to a sliver that
   * is indistinguishable from the stub for a day with nothing, which would draw a quiet day and a
   * closed day the same.
   */
  check('one payment is never shorter than the floor', barHeight(1, 100) === 8, String(barHeight(1, 100)));
  check('and a quiet day stays visibly taller than a closed one', barHeight(1, 100) > barHeight(0, 100));
  check('a busy day is not capped by the floor', barHeight(100, 100) === 100);
}

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
