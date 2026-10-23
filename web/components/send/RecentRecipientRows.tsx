'use client';

import { ChoiceRow } from '@/components/ui';
import { shortenValue } from '@/components/receipt/receipt.format';
import type { RecentRecipient } from '@/lib/api';
import { repeatDetail, repeatTarget } from './repeat';

export interface RecentRecipientRowsProps {
  recipients: RecentRecipient[];
  disabled: boolean;
  onPick: (target: string) => void;
}

/**
 * One row per person, most recent first.
 *
 * The row is `ChoiceRow`, the system's own option: a label, a second line, and the
 * whole 44px row as the target, so choosing a name is one gesture rather than a hit
 * on a small word inside it.
 *
 * The second line is the address SHORTENED, because it is being read here, not
 * checked. The full address sits beside the name on the amount step before anything
 * is signed, which is where a customer checking who gets the money already looks.
 */
export function RecentRecipientRows({ recipients, disabled, onPick }: RecentRecipientRowsProps) {
  return (
    <>
      {recipients.map((recipient) => {
        const target = repeatTarget(recipient);
        if (!target) return null;

        const detail = repeatDetail(recipient);

        return (
          <ChoiceRow
            key={target}
            label={recipient.name}
            detail={detail ? shortenValue(detail) : undefined}
            disabled={disabled}
            onSelect={() => onPick(target)}
          />
        );
      })}
    </>
  );
}
