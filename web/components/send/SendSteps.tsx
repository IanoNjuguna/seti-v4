'use client';

import { MerchantPayStep } from '@/components/pay/MerchantPayStep';
import { SendPanel } from '@/components/home/SendPanel';
import { MfaGate } from '@/components/mfa/MfaGate';
import { Button, Skeleton, StateMessage } from '@/components/ui';
import { RecipientStep } from './RecipientStep';
import { SEND_FLOW_COPY } from './Send.constants';
import type { SendStepsProps } from './SendSteps.types';

/**
 * The flow's body: one of exactly five states, in the order they are reached —
 * the recipient question, a name the server could not resolve, the moment it is
 * being resolved, a business's amount step, or a person's. The screen above owns
 * the state and this renders it, so nothing here is decided twice. The waiting
 * state is the shape of what is coming, never a spinner on an empty page.
 */
export function SendSteps({
  kind,
  typed,
  error,
  recipient,
  isAddress,
  resolved,
  payment,
  focusAmount,
  onChangeKind,
  onChangeTyped,
  onSubmitRecipient,
  onBackToWho,
  onPickRecent,
}: SendStepsProps) {
  if (recipient === null) {
    return (
      <RecipientStep
        kind={kind}
        value={typed}
        error={error}
        busy={false}
        onKindChange={onChangeKind}
        onChange={onChangeTyped}
        onSubmit={onSubmitRecipient}
        onPickRecent={onPickRecent}
      />
    );
  }

  if (resolved.status === 'failed') {
    return (
      <StateMessage
        variant="failure"
        title={SEND_FLOW_COPY.resolveFailedTitle}
        body={resolved.message}
        action={<Button onClick={onBackToWho}>{SEND_FLOW_COPY.changeRecipient}</Button>}
      />
    );
  }

  if (!isAddress && resolved.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label={SEND_FLOW_COPY.resolving}>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (resolved.status === 'business') {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={onBackToWho} className="self-start">
          {SEND_FLOW_COPY.changeRecipient}
        </Button>
        {/* The merchant step carries its own session guard, and so does the panel
            below: the money steps refuse to price or sign without an account
            wherever they are mounted, not only on this screen. */}
        <MfaGate>
          <MerchantPayStep payment={payment} onCancel={onBackToWho} />
        </MfaGate>
      </div>
    );
  }

  return (
    <MfaGate>
      <SendPanel
        initialRecipient={recipient ?? undefined}
        focusAmount={focusAmount}
      />
    </MfaGate>
  );
}
