'use client';

import { SendFrame } from './SendFrame';
import { SendSteps } from './SendSteps';
import { useSendFlow } from './useSendFlow';
import type { SendFlowProps } from './SendFlow.types';

/**
 * The flow itself: the recipient question, the amount step, and the account's
 * machinery behind them.
 *
 * It owns the flow's state and nothing about the session — `SendScreen` mounts it
 * only once the session is confirmed, so every hook behind it exists only for a
 * customer who has an account. That is what makes "a visitor fires no
 * account-scoped request" structural rather than a set of guards: the hooks are
 * never rendered at all.
 *
 * The state lives in `useSendFlow`, so this file is only the shape of the flow: two
 * steps, and the progress bar that says which one is lit.
 */
export function SendFlow({ linked }: SendFlowProps) {
  const flow = useSendFlow({ linked });

  return (
    <SendFrame current={flow.recipient !== null ? 1 : 0}>
      <SendSteps
        kind={flow.kind}
        typed={flow.typed}
        error={flow.error}
        recipient={flow.recipient}
        isAddress={flow.isAddress}
        resolved={flow.resolved}
        payment={flow.payment}
        focusAmount={flow.focusAmount}
        onChangeKind={flow.onChangeKind}
        onChangeTyped={flow.onChangeTyped}
        onSubmitRecipient={flow.onSubmitRecipient}
        onBackToWho={flow.onBackToWho}
        onPickRecent={flow.onPickRecent}
      />
    </SendFrame>
  );
}
