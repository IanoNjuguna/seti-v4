/**
 * Indexer cursor arithmetic checks.
 *
 * Run with:  npm run check:indexer
 *
 * The original bug: `currentBlock - 100n` went NEGATIVE on a chain younger
 * than the lookback window, and a negative fromBlock reaches the RPC as an
 * invalid block number. These assertions pin that shut, plus the resume and
 * bounded-range behaviour that replaced the in-memory cursor.
 */
import assert from 'node:assert/strict';
import {
  clampRange,
  clampToZero,
  DEFAULT_LOOKBACK,
  isEmptyWindow,
  MAX_RANGE,
  resolveBlockWindow,
} from './indexer-cursor.js';

let assertions = 0;
function ok(label: string, fn: () => void): void {
  fn();
  assertions += 1;
  console.log(`ok    ${label}`);
}

// --- Underflow: the original defect ---------------------------------------

ok('chain younger than lookback clamps to 0, never negative', () => {
  const w = resolveBlockWindow(5n, null);
  assert.equal(w.fromBlock, 0n);
  assert.ok(w.fromBlock >= 0n, 'fromBlock must never be negative');
  assert.equal(w.toBlock, 5n);
  assert.equal(w.isBootstrap, true);
});

ok('block 0 exactly', () => {
  const w = resolveBlockWindow(0n, null);
  assert.equal(w.fromBlock, 0n);
  assert.equal(w.toBlock, 0n);
});

ok('currentBlock 99 with default lookback stays non-negative', () => {
  const w = resolveBlockWindow(99n, null);
  assert.equal(w.fromBlock, 0n);
  assert.ok(w.fromBlock >= 0n);
});

ok('currentBlock 100 is the first case where lookback does not clamp', () => {
  const w = resolveBlockWindow(100n, null);
  assert.equal(w.fromBlock, 0n); // 100 - 100 = 0
});

ok('currentBlock 150', () => {
  const w = resolveBlockWindow(150n, null);
  assert.equal(w.fromBlock, 50n);
});

ok('clampToZero saturates rather than underflowing', () => {
  assert.equal(clampToZero(-1n), 0n);
  assert.equal(clampToZero(-99999n), 0n);
  assert.equal(clampToZero(0n), 0n);
  assert.equal(clampToZero(7n), 7n);
});

ok('negative currentBlock is rejected outright', () => {
  assert.throws(() => resolveBlockWindow(-1n, null), /non-negative/);
});

// --- Resume from a durable cursor -----------------------------------------

ok('resume scans from cursor + 1', () => {
  const w = resolveBlockWindow(1000n, 900n);
  assert.equal(w.fromBlock, 901n);
  assert.equal(w.toBlock, 1000n);
  assert.equal(w.isBootstrap, false);
});

ok('cursor at head yields an empty window', () => {
  const w = resolveBlockWindow(1000n, 1000n);
  assert.ok(isEmptyWindow(w));
  assert.equal(w.isBootstrap, false);
});

ok('cursor ahead of head (reorg/reset) falls back to lookback', () => {
  const w = resolveBlockWindow(500n, 10_000n);
  assert.equal(w.fromBlock, 500n - DEFAULT_LOOKBACK);
  assert.equal(w.isBootstrap, true, 'must not treat a future cursor as real');
});

ok('null cursor bootstraps', () => {
  const w = resolveBlockWindow(10_000n, null);
  assert.equal(w.fromBlock, 10_000n - DEFAULT_LOOKBACK);
  assert.equal(w.isBootstrap, true);
});

ok('negative stored cursor is treated as absent', () => {
  const w = resolveBlockWindow(10_000n, -5n);
  assert.equal(w.isBootstrap, true);
  assert.equal(w.fromBlock, 10_000n - DEFAULT_LOOKBACK);
});

ok('lookback 0 means start-now: empty window, no history ingested', () => {
  const w = resolveBlockWindow(1_000_000n, null, 0n);
  assert.ok(isEmptyWindow(w), 'must not scan anything on a fresh cursor');
  assert.equal(w.fromBlock, 1_000_001n);
  assert.equal(w.toBlock, 1_000_000n);
  assert.equal(w.isBootstrap, true);
});

ok('lookback 0 with a cursor ahead of head also yields empty', () => {
  const w = resolveBlockWindow(500n, 10_000n, 0n);
  assert.ok(isEmptyWindow(w));
});

ok('negative lookback is treated as start-now', () => {
  const w = resolveBlockWindow(500n, null, -5n);
  assert.ok(isEmptyWindow(w));
});

// --- Bounded ranges --------------------------------------------------------

ok('clampRange leaves a small window untouched', () => {
  const w = resolveBlockWindow(500n, 400n);
  assert.deepEqual(clampRange(w), w);
});

ok('clampRange trims a huge backlog to MAX_RANGE', () => {
  const w = resolveBlockWindow(1_000_000n, 1n);
  const bounded = clampRange(w);
  assert.equal(bounded.toBlock, 1_000_000n);
  assert.equal(bounded.fromBlock, 1_000_000n - MAX_RANGE + 1n);
  assert.equal(bounded.toBlock - bounded.fromBlock + 1n, MAX_RANGE);
});

ok('clampRange respects a custom bound', () => {
  const w = resolveBlockWindow(1_000_000n, 1n);
  const bounded = clampRange(w, 50n);
  assert.equal(bounded.toBlock - bounded.fromBlock + 1n, 50n);
});

ok('clampRange leaves an empty window empty', () => {
  const w = resolveBlockWindow(100n, 100n);
  assert.ok(isEmptyWindow(clampRange(w)));
});

ok('iterating clamped windows makes forward progress and terminates', () => {
  // Simulates the indexOnce loop over a 10,000-block backlog.
  const currentBlock = 10_000n;
  let window = resolveBlockWindow(currentBlock, null);
  let iterations = 0;
  let previousTo = -1n;

  while (!isEmptyWindow(window) && iterations < 100) {
    const bounded = clampRange(window);
    assert.ok(bounded.toBlock > previousTo, 'each pass must advance');
    assert.ok(bounded.toBlock >= bounded.fromBlock, 'window must stay valid');
    previousTo = bounded.toBlock;
    window = resolveBlockWindow(currentBlock, bounded.toBlock);
    iterations += 1;
  }

  assert.ok(iterations < 100, 'must terminate, not loop forever');
  assert.ok(isEmptyWindow(window), 'must finish caught up');
  assert.equal(previousTo, currentBlock, 'must reach the head');
});

console.log(`\n${assertions} assertions passed.`);
