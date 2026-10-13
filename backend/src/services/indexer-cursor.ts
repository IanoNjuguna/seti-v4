/**
 * Indexer cursor arithmetic.
 *
 * Kept pure and separate from the indexer so the block-window maths can be
 * asserted without an RPC or a database. Every function here is total: given
 * any bigint input it returns a usable window rather than throwing.
 */

/** Blocks to look back when no cursor has been stored yet. */
export const DEFAULT_LOOKBACK = 100n;

/** Upper bound on a single scan range, to keep provider log queries bounded. */
export const MAX_RANGE = 2_000n;

export interface BlockWindow {
  fromBlock: bigint;
  toBlock: bigint;
  /** True when the window is the bootstrap lookback rather than a resume. */
  isBootstrap: boolean;
}

/**
 * Computes the block range to scan.
 *
 * Three hazards this guards against:
 *
 * 1. Underflow. `currentBlock - lookback` goes NEGATIVE when the chain is
 *    younger than the lookback window. A negative `fromBlock` reaches the RPC
 *    as an invalid block number and the scan throws. Clamped to 0n.
 * 2. Re-scanning nothing. When the cursor is already at or past the head
 *    (a fresh chain, or a second replica catching up), the window is empty.
 * 3. Unbounded ranges. A cursor left far behind would otherwise ask the
 *    provider for an enormous log range in one call. Split by MAX_RANGE at
 *    the call site; `clampRange` provides the upper bound.
 */
export function resolveBlockWindow(
  currentBlock: bigint,
  storedLastBlock: bigint | null,
  lookback: bigint = DEFAULT_LOOKBACK
): BlockWindow {
  if (currentBlock < 0n) {
    throw new Error(`currentBlock must be non-negative, got ${currentBlock}`);
  }

  // No cursor, or a cursor from a chain that has since been reset/reorged
  // past our head: fall back to a bounded lookback from the current head.
  if (storedLastBlock === null || storedLastBlock < 0n || storedLastBlock > currentBlock) {
    // A lookback of 0 means "start now": the window is empty and the caller
    // does no work until new blocks arrive. This is the production default,
    // so a fresh cursor never ingests pre-existing chain history.
    if (lookback <= 0n) {
      return { fromBlock: currentBlock + 1n, toBlock: currentBlock, isBootstrap: true };
    }
    const from = clampToZero(currentBlock - lookback);
    return { fromBlock: from, toBlock: currentBlock, isBootstrap: true };
  }

  const fromBlock = storedLastBlock + 1n;

  // Already caught up.
  if (fromBlock > currentBlock) {
    return { fromBlock: currentBlock + 1n, toBlock: currentBlock, isBootstrap: false };
  }

  return { fromBlock, toBlock: currentBlock, isBootstrap: false };
}

/** bigint subtraction that saturates at zero instead of going negative. */
export function clampToZero(value: bigint): bigint {
  return value < 0n ? 0n : value;
}

/**
 * Caps a window's width at maxRange by moving fromBlock forward.
 *
 * Callers loop until `resolveBlockWindow` reports an empty range, so a stale
 * cursor is walked forward in bounded steps rather than one huge query.
 */
export function clampRange(window: BlockWindow, maxRange: bigint = MAX_RANGE): BlockWindow {
  if (window.fromBlock > window.toBlock) return window;
  if (window.toBlock - window.fromBlock + 1n <= maxRange) return window;

  return {
    fromBlock: window.toBlock - maxRange + 1n,
    toBlock: window.toBlock,
    isBootstrap: window.isBootstrap,
  };
}

/** True when the window contains no blocks to scan. */
export function isEmptyWindow(window: BlockWindow): boolean {
  return window.fromBlock > window.toBlock;
}
