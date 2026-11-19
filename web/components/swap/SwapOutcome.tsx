'use client';

import { SwapNotRecorded } from './SwapNotRecorded';
import { SwapResult } from './SwapResult';
import type { SwapResultProps } from './SwapForm.types';

/**
 * Which terminal view a finished swap gets (#593).
 *
 * One decision, in one place, so the page has a single branch to read: a recorded swap
 * is a success, and a swap whose write-up was refused is an alert. The two components
 * differ in more than tone — the success reports figures, the failure reports the hash —
 * so this is a choice between views rather than a prop on one.
 */
export function SwapOutcome({ result, onDone }: SwapResultProps) {
  return result.kind === 'done' ? (
    <SwapResult result={result} onDone={onDone} />
  ) : (
    <SwapNotRecorded result={result} onDone={onDone} />
  );
}
