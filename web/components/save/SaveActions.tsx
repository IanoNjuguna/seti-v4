'use client';

import { Button, Text } from '@/components/ui';
import { SAVE_COPY } from './Save.constants';
import type { SaveActionsProps } from '@/hooks/useSave.types';

/**
 * The two actions, Cash App's pair: a primary `Add money` and a secondary
 * `Withdraw`.
 *
 * `Withdraw` is DISABLED while nothing is saved, and its label says why — "Nothing
 * saved yet" — rather than the button looking broken. A dead control that explains
 * its condition is honest; a dead control that says "Withdraw" is a bug.
 *
 * The withdrawal PATH (redeem, swap home, record) is the next PR. Until it exists,
 * withdraw can only ever be disabled here: nobody holds a position before their
 * first deposit, because depositing is the only way to get one. So this is a fact
 * about the account, not a placeholder.
 */
export function SaveActions({ canWithdraw, onAdd }: SaveActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" fullWidth onClick={onAdd}>
        {SAVE_COPY.addAction}
      </Button>

      <Button type="button" variant="secondary" fullWidth disabled={!canWithdraw}>
        {SAVE_COPY.withdrawAction}
      </Button>

      <Text variant="micro" color="secondary" as="p" className="text-center">
        {SAVE_COPY.custodyNote}
      </Text>
    </div>
  );
}
