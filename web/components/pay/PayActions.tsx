'use client';

import { Button, Text } from '@/components/ui';
import type { PayStep } from '@/hooks/usePayMerchant.types';

export interface PayActionsProps {
  step: PayStep;
  canPay: boolean;
  onPay: () => void;
  onCancel: () => void;
}

/** Step → what the customer is waiting on. Calm, specific, no exclamation marks. */
const PROGRESS_COPY: Partial<Record<PayStep, string>> = {
  resolving: 'Finding merchant…',
  previewing: 'Pricing payment…',
  signing: 'Confirm in your wallet…',
  recording: 'Recording payment…',
};

/**
 * The primary action, and the only place the in-flight states are narrated.
 *
 * While a step is in flight the button is replaced by the progress line rather
 * than disabled in place, so the customer is told what is happening instead of
 * being shown a control that silently refuses. `canPay` is computed by the hook,
 * where terminal states (`error`, `insufficient-gas`, `done`) are excluded from
 * busy — a disabled Pay button is exactly wrong when the user has just been told
 * how to fix the payment.
 */
export function PayActions({ step, canPay, onPay, onCancel }: PayActionsProps) {
  const busy = step === 'resolving' || step === 'previewing' || step === 'signing' || step === 'recording';
  const copy = PROGRESS_COPY[step];

  return (
    <div className="space-y-3">
      {busy && copy ? (
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent"
          />
          <Text variant="micro" as="p">
            {copy}
          </Text>
        </div>
      ) : (
        <Button onClick={onPay} disabled={!canPay} fullWidth loading={busy}>
          Pay
        </Button>
      )}

      <Button variant="ghost" onClick={onCancel} disabled={busy} fullWidth>
        Cancel
      </Button>
    </div>
  );
}
