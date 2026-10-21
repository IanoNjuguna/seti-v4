'use client';

import { Button } from '@/components/ui';
import { CONVERT_COPY } from './Convert.constants';
import type { ConvertActionProps } from './Convert.types';

/**
 * The commit. One press quotes, signs and records — there is no second screen.
 *
 * `loading` is true for the whole three-step submit, not just the signature: the
 * figure is not final until the server has the receipt, and a button that stops
 * spinning when the wallet closes invites a second tap on a quote that is already
 * spent.
 *
 * The label never changes to a figure ("Convert 1,000") the way a pay button does.
 * The amount is one row above, in the customer's own currency, and a button that
 * repeats it is the third place the same number appears on a small screen.
 */
export function ConvertAction({ status, canSubmit, onConvert }: ConvertActionProps) {
  const submitting = status === 'submitting';

  return (
    <Button
      type="button"
      fullWidth
      loading={submitting}
      disabled={!canSubmit}
      onClick={onConvert}
    >
      {submitting ? CONVERT_COPY.submitting : CONVERT_COPY.action}
    </Button>
  );
}
