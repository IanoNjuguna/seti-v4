'use client';

import type { FormEvent } from 'react';
import { SEND_COPY } from './SendPanel.constants';
import { SendFeeSummary } from './SendFeeSummary';
import { SendField } from './SendField';
import { SendFormHeader } from './SendFormHeader';
import { SendResolvedRecipient } from './SendResolvedRecipient';
import { SendSubmit } from './SendSubmit';
import type { SendFormProps } from './SendPanel.types';

/**
 * The three things a send needs: who, how much, and what it costs.
 *
 * Both fields are validated before anything is built (`validate-transfer.ts`), so
 * a typo is answered here and never reaches a wallet prompt, and the quote comes
 * from the server rather than from this component.
 *
 * A username recipient is RESOLVED between the two fields: once the server has
 * answered, the name AND the address are shown together — the username is only
 * how the customer found the person, and the address is what gets signed.
 *
 * The fee line is not decoration: the customer funds the 2%, so showing it after
 * they sign would be charging them for something they never saw.
 */
export function SendForm({
  recipient,
  amountFiat,
  amountLabel,
  recipientError,
  amountError,
  formError,
  resolved,
  preview,
  previewLoading,
  step,
  busy,
  onRecipientChange,
  onAmountChange,
  onSubmit,
}: SendFormProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <SendFormHeader />

      <SendField
        label={SEND_COPY.recipientLabel}
        hint={SEND_COPY.recipientHint}
        error={recipientError}
        value={recipient}
        onChange={onRecipientChange}
        mono
        disabled={busy}
      />

      {resolved ? <SendResolvedRecipient recipient={resolved} /> : null}

      <SendField
        label={amountLabel}
        hint={SEND_COPY.amountHint}
        error={amountError}
        value={amountFiat}
        onChange={onAmountChange}
        inputMode="decimal"
        disabled={busy}
      />

      <SendFeeSummary preview={preview} loading={previewLoading} />

      {/* A wallet, chain or server failure is not the customer's entry, so it is
          not rendered on a field — and it names what failed, not just that it did. */}
      {formError ? (
        <p role="alert" className="text-body-sm text-accent-danger">
          {formError}
        </p>
      ) : null}

      <SendSubmit step={step} />

      <p className="text-caption text-on-dark-mute">{SEND_COPY.feeNote}</p>
    </form>
  );
}
