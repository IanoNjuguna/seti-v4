/**
 * `npm run check:home-summary` — which window Home summarises, and whose order it keeps.
 *
 * Two decisions that are easy to get wrong and invisible in a screenshot: picking the
 * window by SIZE rather than by index (so a new window cannot silently relabel the
 * row), and slicing the server's merchant ranking without re-sorting it (a second
 * opinion about the same data). Everything else on the row is the server's own
 * figures, formatted by the same function the analytics panel uses.
 */
import { PAID_RECENTLY_LIMIT, longestWindow, paidRecently } from '../components/home/home.summary.ts';

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

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
