'use client';

import { useState } from 'react';
import { Text } from '@/components/ui';
import { getExplorerTxUrlFor } from '@/lib/chain';
import { writeToClipboard } from '@/lib/clipboard';
import {
  SWAP_REFERENCE_COPY,
  SWAP_REFERENCE_COPY_CLASS,
  SWAP_REFERENCE_HASH_CLASS,
  SWAP_REFERENCE_WELL_CLASS,
} from './SwapForm.constants';
import type { SwapReferenceProps } from './SwapForm.types';

/** What the last copy press did. Nothing, until one is pressed. */
type CopyOutcome = 'idle' | 'copied' | 'failed';

/**
 * The hash, printed in full and linked to the explorer of the network it settled on.
 *
 * It exists for exactly one state: the swap was signed and mined and the ledger write was
 * refused. `SWAP_COPY.recordFailed` tells the customer to keep this reference, and before
 * this control there was no reference on the page to keep (#413) — the hook held the hash
 * and the surface dropped it. The same recipe as the send receipt's well
 * (`SendResult`), because one hash on one money screen should read like a hash on the other.
 *
 * The value is NEVER truncated. An abbreviated hash is a hash nobody can search, and the
 * copy control is an addition to that promise rather than the promise itself: where
 * `navigator.clipboard` is blocked (a webview, a non-HTTPS origin) the text is still
 * selectable, and `writeToClipboard` returns false so this can say the copy did not happen
 * instead of leaving a customer believing it did.
 */
export function SwapReference({ txHash, network }: SwapReferenceProps) {
  const [outcome, setOutcome] = useState<CopyOutcome>('idle');

  async function onCopy() {
    setOutcome((await writeToClipboard(txHash)) ? 'copied' : 'failed');
  }

  return (
    <div className={SWAP_REFERENCE_WELL_CLASS}>
      <Text variant="micro" as="p" color="secondary">
        {SWAP_REFERENCE_COPY.label}
      </Text>

      <a
        href={getExplorerTxUrlFor(txHash, network)}
        target="_blank"
        rel="noreferrer"
        className={SWAP_REFERENCE_HASH_CLASS}
      >
        {txHash}
      </a>

      <button type="button" onClick={onCopy} className={SWAP_REFERENCE_COPY_CLASS}>
        {SWAP_REFERENCE_COPY.copy}
      </button>

      {/* The outcome as its own line, and in `role="status"` so it is announced: a
          sentence that only changes colour is a sentence a screen reader never hears. */}
      {outcome !== 'idle' && (
        <Text variant="micro" as="p" color="secondary" role="status" className="mt-1">
          {outcome === 'copied' ? SWAP_REFERENCE_COPY.copied : SWAP_REFERENCE_COPY.copyFailed}
        </Text>
      )}
    </div>
  );
}
