'use client';

import { Button, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
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
 * The hierarchy is the point. The amount is the app's own money treatment
 * (`variant="balance"`, tabular) with the destination under it, because "how much,
 * to whom" is the whole question a receipt answers — it used to be 14px, the same
 * size and colour as the address and the words around it, so nothing on the
 * receipt was the focal point and the eye landed on the two-line hash instead.
 *
 * The hash is shown in full and linked to the explorer: on a non-custodial
 * transfer it is the only independent proof, and it is how the row in Activity can
 * be checked against the chain. It sits in a `surface-soft` well under a label, in
 * the mono face at which hashes align, and it wears the link role for this canvas
 * (`text-link`) — `accent-light-blue` was only correct while that well was black.
 *
 * The receipt draws on the same white canvas the amount step draws on, because the
 * panel's card is gone: every figure and the hash well take the ink/secondary roles,
 * and the check sits in the same `surface-soft` medallion `StateMessage` uses for
 * its own states — the black disc belonged to the black panel and would have been a
 * dark surface left stranded on white.
 *
 * The only motion is the check, once, on mount — the single deliberate moment
 * `design/motion.md` reserves for the product.
 */
export function SendResult({ sent, onReset }: SendResultProps) {
  return (
    <div className="space-y-4" role="status">
      <div className="text-center">
        <span
          aria-hidden="true"
          className="check-in mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-accent-light-green"
        >
          <Icon name="check" className="h-6 w-6" />
        </span>

        <Text variant="card-title" as="p" className="mt-2">
          {SEND_COPY.receiptTitle}
        </Text>

        <Text variant="balance" tabular as="p" className="mt-2">
          {formatFiat(Number(sent.amountFiat), sent.fiatCurrency)}
        </Text>

        <Text variant="body" as="p" color="secondary" className="mt-1">
          to {formatAddress(sent.recipient)}
        </Text>

        <Text variant="micro" as="p" color="secondary" className="mt-2">
          <span className="font-tabular">
            {formatFiat(Number(sent.feeFiat), sent.fiatCurrency)}
          </span>{' '}
          platform fee, charged in the same transaction.
        </Text>
      </div>

      <div className="rounded-md bg-surface-soft p-3">
        <Text variant="micro" as="p" color="secondary">
          Transaction
        </Text>
        <a
          href={getExplorerTxUrl(sent.txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all font-mono text-caption text-link underline-offset-4 hover:underline"
        >
          {sent.txHash}
        </a>
      </div>

      {/* The same closing line the pay receipt carries, for the same reason: the
          first question after moving money is where it went, and the answer is the
          list the customer already knows. `sent` is only set once the transfer was
          reconciled and recorded, so this is true when it renders. */}
      <Text variant="micro" as="p" color="secondary" className="text-center">
        It is in your activity now.
      </Text>

      <Button variant="secondary" onClick={onReset} fullWidth>
        {SEND_COPY.another}
      </Button>
    </div>
  );
}
