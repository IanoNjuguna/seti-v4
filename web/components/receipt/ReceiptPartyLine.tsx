'use client';

import { cn } from '@/lib/cn';
import type { ReceiptPartyLineProps } from './Receipt.types';

/**
 * Who this was with — a name when one was recorded, then the address itself.
 *
 * The two are deliberately separate lines with different treatments: a name is
 * something a counterparty chooses, and an address is the only thing that cannot
 * be chosen. A name that does not belong to the address below it is therefore
 * visible AS a mismatch rather than disguised as a label, and the address is in
 * monospace so two receipts can be compared column-wise. When the document
 * recorded no name, the first line says what the other side is ("the sender")
 * in the quiet tier — a description, never an identity.
 *
 * The full address rides in `title`: the abbreviation is for reading, never the
 * only copy of the value.
 */
export function ReceiptPartyLine({ party }: ReceiptPartyLineProps) {
  return (
    <section className="mt-5 min-w-0">
      <p
        className={cn(
          'truncate',
          party.named ? 'text-body-md-bold text-on-dark' : 'text-body-sm text-on-dark-mute'
        )}
      >
        {party.label}
      </p>

      {party.address ? (
        <p className="truncate font-mono text-body-sm text-on-dark" title={party.address}>
          {party.shortAddress}
        </p>
      ) : null}
    </section>
  );
}
