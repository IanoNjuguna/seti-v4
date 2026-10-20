/**
 * `npm run check:asset-split` — splitting the headline across the assets in it.
 *
 * The rule this protects is one sentence: the rows must add up to the figure above
 * them. A per-row conversion at the rate drifts by a cent or two and produces a
 * breakdown that visibly does not sum, so the split is allocated from the total and the
 * rounding remainder is absorbed by the largest row.
 *
 * Run through `tsx`: this imports a TypeScript module and CI is Node 20.
 */
import { allocateFiat } from '../components/home/allocate.ts';

let failures = 0;
let passed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

const row = (asset, symbol, amount) => ({ asset, symbol, amount });
const sum = (shares) => shares.reduce((total, share) => total + Number(share.fiat), 0).toFixed(2);

// --- the ordinary case -------------------------------------------------------
{
  const rows = [row('ousd', 'OUSD', '100.00'), row('pathusd', 'pathUSD', '50.00'), row('usdt0', 'USDT0', '50.00')];
  const shares = allocateFiat(rows, '25900.00');

  check('three rows stay three rows', shares.length === 3);
  check('the shares add to the headline exactly', sum(shares) === '25900.00', sum(shares));
  check('the biggest holding carries the biggest share', shares[0].fiat === '12950.00', shares[0].fiat);
}

// --- a remainder that cannot divide evenly ----------------------------------
{
  const rows = [row('ousd', 'OUSD', '1.00'), row('pathusd', 'pathUSD', '1.00'), row('usdt0', 'USDT0', '1.00')];
  const shares = allocateFiat(rows, '100.00');

  check('a third of 100 still sums to 100', sum(shares) === '100.00', sum(shares));
  check('the drift lands on the largest row, not on a random one', shares[0].fiat === '33.34', shares[0].fiat);
  check('the other rows are not touched by the drift', shares[1].fiat === '33.33' && shares[2].fiat === '33.33');
}

// --- zeros are real rows -----------------------------------------------------
{
  const rows = [row('usdt0', 'USDT0', '20.00'), row('ousd', 'OUSD', '0.00'), row('usdc.e', 'USDC.e', '0.00')];
  const shares = allocateFiat(rows, '2590.00');

  check('every asset keeps its row', shares.length === 3);
  check('a zero holds a zero, not a share', shares[1].fiat === '0.00' && shares[2].fiat === '0.00');
  check('the funded row holds the whole figure', shares[0].fiat === '2590.00', shares[0].fiat);
}

// --- nothing to split --------------------------------------------------------
{
  const shares = allocateFiat([row('ousd', 'OUSD', '0.00')], '0.00');
  check('an empty balance splits into zeros, not NaN', shares[0].fiat === '0.00', shares[0].fiat);
  check('no rows in, no rows out', allocateFiat([], '0.00').length === 0);
}

// --- a malformed amount cannot poison the whole split ------------------------
{
  const rows = [row('ousd', 'OUSD', 'nonsense'), row('pathusd', 'pathUSD', '10.00')];
  const shares = allocateFiat(rows, '1295.00');

  check('a malformed amount does not produce NaN', shares.every((share) => !share.fiat.includes('NaN')));
  check('and the rows still add to the headline', sum(shares) === '1295.00', sum(shares));
}

// --- many tiny rows ----------------------------------------------------------
{
  const rows = Array.from({ length: 4 }, (_, index) => row(`a${index}`, `A${index}`, '0.01'));
  const shares = allocateFiat(rows, '0.03');

  check('four rows against three cents still sums', sum(shares) === '0.03', sum(shares));
}

console.log(failures === 0 ? `\n${passed} assertions passed.` : `\n${failures} failed, ${passed} passed.`);
process.exit(failures === 0 ? 0 : 1);
