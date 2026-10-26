'use client';

import type { FormEvent } from 'react';
import { Text } from '@/components/ui';
import { PracticeNote } from '@/components/app/PracticeNote';
import { SEND_COPY } from './SendPanel.constants';
import { SendAmountSection } from './SendAmountSection';
import { SendField } from './SendField';
import { SendResolvedRecipient } from './SendResolvedRecipient';
import { SendSubmit } from './SendSubmit';
import { sendFormFlags } from './send-panel-step';
import type { SendFormProps } from './SendPanel.types';

/**
 * The things a send needs: who, how much, from which balance, and what it costs.
 *
 * Both fields are validated before anything is built (`validate-transfer.ts`), so
 * a typo is answered here and never reaches a wallet prompt, and the quote comes
 * from the server rather than from this component.
 *
 * A username recipient is RESOLVED between the two fields: once the server has
 * answered, the name AND the address are shown together — the username is only
 * how the customer found the person, and the address is what gets signed.
 *
 * Which balance pays sits with the amount, in `SendAmountSection`, because it is
 * what the fee line is a function of — the same control, in the same place, as the
 * pay step (#232). It is ONE component for both flows; a second picker is how an
 * app grows two mental models of its own money.
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
  formErrorCode,
  resolved,
  tokenSelector,
  preview,
  previewLoading,
  step,
  busy,
  focusAmount,
  onRecipientChange,
  onAmountChange,
  onChooseAsset,
  onSubmit,
}: SendFormProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) onSubmit();
  };

  // `no-single-asset-covers` is drawn by the selector, beside the balance that can
  // pay it; the form draws only what the selector leaves unsaid (`send-panel-step`).
  const flags = sendFormFlags({ formError, formErrorCode, tokenSelector });

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
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

      <SendAmountSection
        amountLabel={amountLabel}
        amountFiat={amountFiat}
        amountError={amountError}
        preview={preview}
        previewLoading={previewLoading}
        tokenSelector={tokenSelector}
        busy={busy}
        focusAmount={focusAmount}
        onAmountChange={onAmountChange}
        onChooseAsset={onChooseAsset}
      />

      {/* What the money in the table above IS. On practice it is the one line on
          this screen that says the figures are not real, and it is directly under
          the figures — the chrome's strip is 32px at the top of the page and this
          is the screen people screenshot. The card that used to hold the panel is
          gone, so the sentence is drawn on the page's white canvas and takes the
          light surface for its contrast role; its prominence is untouched, because
          it is still the loud mark at the point of commitment. */}
      <PracticeNote surface="light" />

      {/* A wallet, chain or server failure is not the customer's entry, so it is
          not rendered on a field — and it names what failed, not just that it did.
          `role="alert"` makes it a live region; `color="alert"` is the token role,
          not a hand-copied class. */}
      {flags.formError ? (
        <Text variant="micro" color="alert" as="p" role="alert">
          {flags.formError}
        </Text>
      ) : null}

      <SendSubmit step={step} />

      <p className="text-caption text-mute">{SEND_COPY.feeNote}</p>
    </form>
  );
}
