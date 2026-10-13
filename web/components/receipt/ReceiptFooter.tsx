'use client';

import { Icon } from '@/components/ui/Icon';
import { RECEIPT_COPY } from './Receipt.constants';
import type { ReceiptFooterProps } from './Receipt.types';

/**
 * The bottom of the card: one fee line, then the way to the chain.
 *
 * One line, not two: the platform fee and the gas fee are summed, because two
 * figures ask a customer to do arithmetic in a currency they never chose and to
 * wonder why they are paying twice. The label says whose fees they were — on an
 * inbound receipt they were the sender's.
 *
 * The explorer link is the escape hatch for the audit trail, and it is the only
 * thing on the card that leaves it — one tap, quiet, and printed on paper so the
 * pointer survives the screenshot.
 */
export function ReceiptFooter({ fee, explorerUrl }: ReceiptFooterProps) {
  return (
    <footer className="mt-6">
      {fee ? (
        <div className="flex items-baseline justify-between gap-4 border-t border-hairline-dark pt-4">
          <span className="text-body-sm text-on-dark-mute">{fee.label}</span>
          <span className="font-tabular text-body-sm text-on-dark">{fee.amount}</span>
        </div>
      ) : null}

      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-sm py-2 text-body-sm text-on-dark-mute transition-colors hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark/60"
      >
        {RECEIPT_COPY.explorer}
        <Icon name="arrowRight" className="h-4 w-4" />
      </a>
    </footer>
  );
}
