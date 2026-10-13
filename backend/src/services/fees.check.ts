/**
 * Fee schedule sanity checks.
 *
 * Run with:  npx tsx src/services/fees.check.ts
 *
 * This repo has no test runner yet. Until one exists, this file is the
 * executable spec for the merchant fee rule: it asserts the behaviour that the
 * pricing fix depends on, and prints a table a human can eyeball.
 */
import assert from 'node:assert/strict';
import {
  calculateMerchantFee,
  minimumTicketForFloor,
  splitFeeInclusiveTotal,
} from './fees.js';

const schedule = { percent: 2, minKes: 50, maxPercent: 10 };

const cases: Array<[string, number, number, boolean]> = [
  // label, fiatAmount, expectedFee, expectedCapped
  ['KES 100 — floor would be 50% of payment', 100, 10, true],
  ['KES 100.50 — just over 10%', 100.5, 10.05, true],
  ['KES 200 — floor capped to 10%', 200, 20, true],
  ['KES 500 — floor exactly 10%', 500, 50, false],
  ['KES 501 — floor still binds, under cap', 501, 50, false],
  ['KES 1,000 — 2% below floor', 1000, 50, false],
  ['KES 2,500 — percentage equals floor', 2500, 50, false],
  ['KES 2,501 — 2% takes over', 2501, 50.02, false],
  ['KES 5,000 — 2%', 5000, 100, false],
  ['KES 100,000 — 2%', 100000, 2000, false],
];

console.log('label                                 amount      fee   capped');
console.log('-'.repeat(72));

for (const [label, amount, expectedFee, expectedCapped] of cases) {
  const result = calculateMerchantFee(amount, schedule);
  console.log(
    label.padEnd(38),
    String(amount).padStart(9),
    String(result.feeFiat).padStart(8),
    String(result.cappedByMaxPercent).padStart(8)
  );

  assert.equal(result.feeFiat, expectedFee, `${label}: fee mismatch`);
  assert.equal(
    result.cappedByMaxPercent,
    expectedCapped,
    `${label}: capped flag mismatch`
  );
}

// Degenerate inputs must not produce a fee.
for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  const result = calculateMerchantFee(bad, schedule);
  assert.equal(result.feeFiat, 0, `fee for ${bad} should be 0, got ${result.feeFiat}`);
}

// Float dust must not leak into the figure. Above the KES 2,500 threshold the
// percentage binds, so 2% of 3,333.33 = 66.6666 must land on 66.67.
const dusty = calculateMerchantFee(3333.33, schedule);
assert.equal(dusty.feeFiat, 66.67);

// Below the threshold the floor wins even though 2% is a smaller number.
const underFloor = calculateMerchantFee(1234.56, schedule);
assert.equal(underFloor.feeFiat, 50);

// The floor threshold is exactly minKes / maxPercent * 100 = KES 500.
assert.equal(minimumTicketForFloor(schedule), 500);

// A disabled cap (0) restores the original uncapped behaviour.
const uncapped = calculateMerchantFee(100, { ...schedule, maxPercent: 0 });
assert.equal(uncapped.feeFiat, 50, 'maxPercent:0 should charge the raw floor');
assert.equal(uncapped.cappedByMaxPercent, false);

// A disabled floor (0) means pure percentage, even on tiny payments.
const noFloor = calculateMerchantFee(100, { ...schedule, minKes: 0 });
assert.equal(noFloor.feeFiat, 2);

// --- The v1 default schedule ---------------------------------------------
//
// v1 settles non-custodially (no fiat off-ramp, no per-payout cost), so the
// shipped defaults are a flat 2% with no floor and no cap. This is the
// schedule the marketing copy quotes, so it must hold at EVERY ticket size —
// a floor that quietly charges 50% on a small payment is the bug this whole
// exercise exists to prevent.
const v1 = { percent: 2, minKes: 0, maxPercent: 0 };

console.log('\nv1 default schedule (2% flat, no floor, no cap):');
console.log('amount      fee  effective');
console.log('-'.repeat(72));

for (const amount of [1, 50, 100, 300, 500, 800, 2500, 5000, 100000]) {
  const result = calculateMerchantFee(amount, v1);
  const expected = (amount * v1.percent) / 100;
  console.log(
    String(amount).padStart(8),
    result.feeFiat.toFixed(2).padStart(8),
    `${((result.feeFiat / amount) * 100).toFixed(2)}%`.padStart(10)
  );

  assert.equal(result.feeFiat, Math.round(expected * 100) / 100, `${amount}: must be flat 2%`);
  assert.equal(result.cappedByMaxPercent, false, `${amount}: cap is disabled`);
  assert.equal(result.floorApplied, false, `${amount}: floor is disabled`);
}

// No ticket size may be charged a flat KES figure under a percentage schedule.
const small = calculateMerchantFee(50, v1);
assert.equal(small.feeFiat, 1);
assert.ok(small.feeFiat < 50, 'a KES 50 ticket must never carry a KES 50 fee');

console.log('-'.repeat(72));
console.log(`minimum ticket for the KES ${schedule.minKes} floor: KES ${minimumTicketForFloor(schedule)}`);
console.log(`\nAll ${cases.length + 7} assertions passed.`);

// --- Inversion: gross -> principal + fee ---------------------------------
//
// v1 collects the fee inside the customer's transfer, so the backend receives
// a gross figure and must recover the principal. The round-trip
// split(principal + fee(principal)) must land back on the original principal,
// or a merchant is silently short-changed.
console.log('\ninversion round-trip (v1 schedule):');
console.log('principal   fee   gross    recovered   exact');
console.log('-'.repeat(72));

let maxDrift = 0;
for (const principal of [10, 50, 100, 250, 500, 833.33, 1000, 2500, 12345.67]) {
  const fee = calculateMerchantFee(principal, v1).feeFiat;
  const gross = principal + fee;
  const back = splitFeeInclusiveTotal(gross, v1);
  const recovered = back.principalFiat;
  const drift = Math.abs(recovered - principal);
  maxDrift = Math.max(maxDrift, drift);

  console.log(
    String(principal).padStart(9),
    fee.toFixed(2).padStart(7),
    gross.toFixed(2).padStart(8),
    recovered.toFixed(2).padStart(12),
    String(drift < 0.011).padStart(9)
  );
  assert.ok(drift < 0.011, `principal ${principal}: drift ${drift} too large`);
}

// The recovered fee must reproduce the fee exactly for a clean principal.
const clean = splitFeeInclusiveTotal(102, v1); // 100 principal + 2 fee
assert.equal(clean.principalFiat, 100);
assert.equal(clean.feeFiat, 2);

// Degenerate gross values must not produce NaN or a negative principal.
for (const bad of [0, -5, Number.NaN]) {
  const r = splitFeeInclusiveTotal(bad, v1);
  assert.equal(r.principalFiat, 0, `gross ${bad} -> principal 0`);
  assert.ok(!Number.isNaN(r.feeFiat));
}

// A 100% fee must not divide by zero.
const allFee = splitFeeInclusiveTotal(100, { percent: 100, minKes: 0, maxPercent: 0 });
assert.ok(Number.isFinite(allFee.principalFiat));

console.log('-'.repeat(72));
console.log(`max round-trip drift: KES ${maxDrift.toFixed(4)}`);
