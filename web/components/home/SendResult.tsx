'use client';

import { Button, Text } from '@/components/ui';
import { getExplorerTxUrl } from '@/lib/chain';
import { formatFiat } from '@/lib/formatCurrency';
import { formatAddress } from './home.format';
import { SEND_COPY } from './SendPanel.constants';
import type { SendResultProps } from './SendPanel.types';

/**
 * The receipt for the transfer that was just signed and recorded.
 *
 * The principal and the fee are shown separately because they left the wallet as
 * two separate transfers, in one transaction: what the person received, and what
 * Seti took. A single figure here would hide the 2% the customer just funded.
 *
 * The hash is shown in full and linked to the explorer: on a non-custodial
 * transfer it is the only independent proof, and it is how the row in Activity
 * can be checked against the chain.
 */
export function SendResult({ sent, onReset }: SendResultProps) {
  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite">
        <Text variant="card-title" as="p" color="inverse">
          {SEND_COPY.receiptTitle}
        </Text>
        <p className="mt-1 text-body-sm text-on-dark-mute">
          <span className="font-tabular">{formatFiat(Number(sent.amountFiat), sent.fiatCurrency)}</span> to{' '}
          {formatAddress(sent.recipient)}
        </p>
        <p className="mt-1 text-caption text-on-dark-mute">
          <span className="font-tabular">{formatFiat(Number(sent.feeFiat), sent.fiatCurrency)}</span> platform
          fee, charged in the same
          transaction.
        </p>
      </div>

      <a
        href={getExplorerTxUrl(sent.txHash)}
        target="_blank"
        rel="noreferrer"
        className="block break-all font-mono text-caption text-primary underline-offset-4 hover:underline"
      >
        {sent.txHash}
      </a>

      <Button variant="pill" onClick={onReset}>
        {SEND_COPY.another}
      </Button>
    </div>
  );
}
