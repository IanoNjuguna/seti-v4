'use client';

import { Text } from '@/components/ui';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { SendForm } from './SendForm';
import { SendResult } from './SendResult';
import { SEND_COPY } from './SendPanel.constants';
import { useSendPanel } from './useSendPanel';
import type { SendPanelProps } from './SendPanel.types';

/**
 * The send form for a confirmed account: the wallet's state, the fields, the
 * server's quote, and the receipt.
 *
 * This is a whole surface now, not a panel inside the balance card, so the page's
 * Back control is the way out — in every state. The amount field's currency is
 * read from the customer's own dashboard by `useUserCurrency`, which is one of
 * the account-scoped reads this component owns and the reason it is mounted only
 * behind `SendPanel`'s session check.
 *
 * The PANEL is the amount step's body, and the HEADING belongs to the flow above
 * it (`/app/send`'s own `h1` and its progress bar). It used to render a heading of
 * its own — "Send to a wallet / To a person, not a merchant code." — which was a
 * second title under the flow's, and was simply WRONG once paying a merchant became
 * this flow's business case.
 *
 * There is no card around it either. The panel used to be a `surface-elevated`
 * block on the white page — the amount step priced on that dark well — and both are
 * gone the way the receive halves' cards went. Every word the panel carries (the
 * wallet states, the field errors, the fee note) is page text on `canvas-light`
 * now, and the only surfaces left are the field wells and the quote table's own
 * inset, which is what the customer came here to read.
 */
export function SendPanelForm({ initialRecipient, focusAmount }: SendPanelProps) {
  const panel = useSendPanel(initialRecipient);
  const currency = useUserCurrency(true);

  return (
    <div className="space-y-4">
      {panel.walletStatus !== 'ready' ? (
        <Text variant="body" as="p" color="secondary">
          {panel.walletStatus === 'loading' ? SEND_COPY.findingWallet : SEND_COPY.noWallet}
        </Text>
      ) : panel.sent ? (
        <SendResult sent={panel.sent} onReset={panel.reset} />
      ) : (
        <SendForm
          recipient={panel.recipient}
          amountFiat={panel.amountFiat}
          recipientError={panel.recipientError}
          amountError={panel.amountError}
          formError={panel.formError}
          formErrorCode={panel.formErrorCode}
          resolved={panel.resolved}
          tokenSelector={panel.tokenSelector}
          preview={panel.preview}
          previewLoading={panel.previewLoading}
          step={panel.step}
          busy={panel.isBusy}
          focusAmount={focusAmount === true}
          onRecipientChange={panel.setRecipient}
          onAmountChange={panel.setAmountKes}
          onChooseAsset={panel.setAsset}
          onSubmit={panel.submit}
          amountLabel={currency ? `Amount (${currency})` : SEND_COPY.amountLabelFallback}
        />
      )}
    </div>
  );
}
