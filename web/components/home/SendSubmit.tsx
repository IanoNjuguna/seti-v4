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
 * on the pay screen.
 *
 * The button is `type="submit"`, so the one handler stays on the form and this
 * component holds no state. `pill` is the filled treatment on the dark canvas: a
 * `primary` button there would be a black pill on a black card.
 */
export function SendSubmit({ step }: SendSubmitProps) {
  const copy = SEND_PROGRESS[step];

  if (!copy) {
    return (
      <Button type="submit" variant="pill">
        {SEND_COPY.submit}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-on-dark border-t-transparent"
      />
      <Text variant="micro" as="p" color="inverse-muted">
        {copy}
      </Text>
    </div>
  );
}
