/**
 * `npm run check:tabs` — the keyboard arithmetic of a tablist.
 *
 * A screenshot cannot show what Left does at the first tab, and a browser harness
 * cannot always dispatch a trusted key event. The movement rules are therefore pure
 * functions with assertions on them, and the component keeps only the wiring.
 */
import { isTabKey, nextTabIndex } from '../components/ui/tabs.keys.ts';

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

console.log('a rail of four, with the first tab selected:');
check('ArrowRight moves to the next tab', nextTabIndex(2, 0, 'ArrowRight') === 1);
check('ArrowRight at the last tab wraps to the first', nextTabIndex(4, 3, 'ArrowRight') === 0);
check('ArrowLeft moves to the previous tab', nextTabIndex(2, 1, 'ArrowLeft') === 0);
check('ArrowLeft at the first tab wraps to the last', nextTabIndex(4, 0, 'ArrowLeft') === 3);
check('Home selects the first tab', nextTabIndex(4, 2, 'Home') === 0);
check('End selects the last tab', nextTabIndex(4, 0, 'End') === 3);

console.log('edges:');
check(
  'a single tab stays selected either way',
  nextTabIndex(1, 0, 'ArrowRight') === 0 && nextTabIndex(1, 0, 'ArrowLeft') === 0
);
check(
  'Home and End on a single tab agree',
  nextTabIndex(1, 0, 'Home') === 0 && nextTabIndex(1, 0, 'End') === 0
);
check('no selection moves to the first tab', nextTabIndex(2, -1, 'ArrowRight') === 0);
check('an empty list has nowhere to go', nextTabIndex(0, 0, 'ArrowRight') === null);
check('an out-of-range index is clamped, not thrown', nextTabIndex(2, 9, 'ArrowLeft') === 0);
check('an unknown key is not ours', isTabKey('Enter') === false);
check('a modifier key name is not ours', isTabKey('Shift') === false);

console.log('the keys we claim:');
check(
  'all four movement keys are recognised',
  ['ArrowRight', 'ArrowLeft', 'Home', 'End'].every(isTabKey)
);

console.log('-'.repeat(74));
console.log(`${passed} assertions passed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed === 0 ? 0 : 1);
