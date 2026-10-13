'use client';

import { Text } from '@/components/ui';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { SendForm } from './SendForm';
import { SendResult } from './SendResult';
import { SEND_COPY } from './SendPanel.constants';
import { useSendPanel } from './useSendPanel';

/**
 * Send to a person — the body of `/app/send`.
 *
 * The other half of Deposit's question: money arriving, money leaving. Unlike
 * Deposit, this one signs: a wallet address and an amount quoted by the server,
 * signed as ONE Tempo transaction with two calls (the principal to the person,
 * the 2% to Seti's treasury), and then verified against the receipt before it
 * appears in Activity.
 *
 * This is a whole surface now, not a panel inside the balance card, so the page's
 * Back control is the way out — in every state, including the ones that show a
 * single sentence. The amount field's currency is read from the customer's own
 * dashboard by `useUserCurrency`, because a page has no card above it to pass the
 * figure down as a prop.
 */
export function SendPanel() {
  const panel = useSendPanel();
  const currency = useUserCurrency(true);

  return (
    <div className="rounded-md bg-surface-elevated p-4">
      {panel.walletStatus !== 'ready' ? (
        <Text variant="micro" as="p" color="inverse-muted">
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
          preview={panel.preview}
          previewLoading={panel.previewLoading}
          step={panel.step}
          busy={panel.isBusy}
          onRecipientChange={panel.setRecipient}
          onAmountChange={panel.setAmountKes}
          onSubmit={panel.submit}
          amountLabel={currency ? `Amount (${currency})` : SEND_COPY.amountLabelFallback}
        />
      )}
    </div>
  );
}
