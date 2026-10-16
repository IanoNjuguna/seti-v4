'use client';

import { Button, Text } from '@/components/ui';
import { SEND_COPY, SEND_PROGRESS } from './SendPanel.constants';
import type { SendSubmitProps } from './SendPanel.types';

/**
 * The primary action, and the only place the in-flight states are narrated.
 *
 * While something is pending the button is replaced by a progress line rather
 * than disabled in place, so the customer is told what is happening instead of
 * being shown a control that silently refuses — the same call `PayActions` makes
 * on the pay screen. The line occupies the button's own 48px (`min-h-12`), so
 * nothing below it moves at the moment the transfer starts.
 *
 * The button is `type="submit"`, so the one handler stays on the form and this
 * component holds no state.
 *
 * The variant is `primary` — the doc's `button-dark`, a black pill on a white band,
 * which is the brand's loudest action where the amount step now draws. It was
 * `on-dark` (a white CTA) while this panel was a black card, and on white that
 * button would have been invisible; before that it was `pill`, a 36px
 * `surface-soft` chip, which made the single most important control in the flow the
 * smallest and quietest thing on it, and left the 48px "Cancel" link under it
 * looking like the primary action. One send, one primary.
 */
export function SendSubmit({ step }: SendSubmitProps) {
  const copy = SEND_PROGRESS[step];

  if (!copy) {
    return (
      <Button type="submit" variant="primary" fullWidth>
        {SEND_COPY.submit}
      </Button>
    );
  }

  return (
    <div className="flex min-h-12 items-center gap-3" role="status" aria-live="polite">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent"
      />
      <Text variant="body" as="p" color="secondary">
        {copy}
      </Text>
    </div>
  );
}
