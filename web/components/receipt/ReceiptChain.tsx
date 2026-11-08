'use client';

import { RECEIPT_COPY } from './Receipt.constants';
import type { ReceiptChainDetail } from './Receipt.types';

const LABEL = 'text-body-sm text-on-dark-mute';
const VALUE = 'min-w-0 break-all font-mono text-body-sm text-on-dark';

/**
 * The chain detail of a payment, on the document (#406).
 *
 * The hash had no home after #407 took the indexer strip off every Activity row: the list stopped
 * reading like a block explorer (right) and the transaction hash then appeared NOWHERE in the app
 * (not right). A customer who wants to check a transfer against the chain, or hand the hash to
 * somebody who will, had no way to find it.
 *
 * Everything is printed IN FULL and the addresses and hash are selectable, because the reason this
 * block exists is comparison: a shortened value proves nothing to whoever pastes it into an
 * explorer. Mono, so a 42-character address keeps its shape.
 *
 * It sits under a hairline as its own inset group: these are facts about the transfer rather than
 * rows a reader scans for a figure, so they are deliberately quieter than the amount above them.
 */
export function ReceiptChain({ chain }: { chain: ReceiptChainDetail }) {
  return (
    <section aria-label={RECEIPT_COPY.chainTitle} className="mt-6">
      <div className="border-t border-hairline-dark pt-4">
        <p className="text-body-sm text-on-dark-mute">{RECEIPT_COPY.chainTitle}</p>

        <dl className="mt-2 flex flex-col gap-1.5">
          <Row label={RECEIPT_COPY.chainHash} value={chain.hash} />
          <Row label={RECEIPT_COPY.chainFrom} value={chain.from} />
          <Row label={RECEIPT_COPY.chainTo} value={chain.to} />
          {chain.asset ? <Row label={RECEIPT_COPY.chainAsset} value={chain.asset} /> : null}
        </dl>
      </div>
    </section>
  );
}

/** One label/value pair, wrapping rather than truncating: the value is the whole point. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={LABEL}>{label}</dt>
      <dd className={VALUE} style={{ userSelect: 'all' }}>
        {value}
      </dd>
    </div>
  );
}
