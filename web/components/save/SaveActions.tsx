'use client';

import { Button, Text } from '@/components/ui';
import { SAVE_COPY } from './Save.constants';
import type { SaveActionsProps } from '@/hooks/useSave.types';

/**
 * The two actions, Cash App's pair: a primary `Add money` and a secondary
 * `Withdraw`.
 *
 * `Withdraw` is disabled only when there is genuinely nothing to take out — no
 * position, or a vault that cannot redeem immediately — and the line underneath says
 * which of the two it is. A dead control that explains its condition is honest; a
 * dead control that just looks broken is a bug.
 *
 * When it is enabled it opens the same amount sheet as `Add money`, mirrored: the
 * withdrawal it signs is approve-the-shares → redeem → swap home, in one transaction.
 */
export function SaveActions({ canWithdraw, withdrawReason, onAdd, onWithdraw }: SaveActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" fullWidth onClick={onAdd}>
        {SAVE_COPY.addAction}
      </Button>

      <Button type="button" variant="secondary" fullWidth disabled={!canWithdraw} onClick={onWithdraw}>
        {SAVE_COPY.withdrawAction}
      </Button>

      {!canWithdraw && withdrawReason ? (
        <Text variant="micro" color="secondary" as="p" className="text-center">
          {withdrawReason}
        </Text>
      ) : null}

      <Text variant="micro" color="secondary" as="p" className="text-center">
        {SAVE_COPY.custodyNote}
      </Text>
    </div>
  );
}
