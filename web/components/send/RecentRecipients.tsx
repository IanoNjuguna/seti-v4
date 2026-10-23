'use client';

import { Skeleton, Text } from '@/components/ui';
import { useRecentRecipients } from '@/hooks/useRecentRecipients';
import { RECENT_RECIPIENT_COPY } from './Send.constants';
import { RecentRecipientRows } from './RecentRecipientRows';
import { showsRecents } from './repeat';
import type { RecentRecipientsProps } from './RecentRecipients.types';

/**
 * People this account has paid before, under the recipient field (#99).
 *
 * A SHORTCUT past the field and nothing more, which is why it appears only while the
 * field is empty and disappears the moment somebody types: what they are typing is a
 * better answer than anything offered here, and two answers side by side make the
 * question look like it has two.
 *
 * The read happens only while the block is asked for (`useRecentRecipients(visible)`),
 * so the amount step and a typed handle cost no request. Nothing renders for an
 * account with no history (acceptance 3), and a failed read says so in one line where
 * the list would have been rather than taking the step over.
 *
 * The tap fills the payee. It carries no amount and it sends nothing: the amount the
 * customer types is the amount that gets priced, quoted and signed.
 */
export function RecentRecipients({ visible, disabled, onPick }: RecentRecipientsProps) {
  const { recipients, error, loading } = useRecentRecipients(visible);

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label={RECENT_RECIPIENT_COPY.loading}>
        {[1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Text variant="micro" as="p" color="secondary">
        {RECENT_RECIPIENT_COPY.unavailable}
      </Text>
    );
  }

  /**
   * `showsRecents`, not a length check: an account whose only rows carry no usable
   * target has no entry point either, and that is the same answer as no history.
   */
  if (!showsRecents(recipients)) return null;

  return (
    <div className="flex flex-col gap-2">
      <Text variant="micro" as="p" color="secondary">
        {RECENT_RECIPIENT_COPY.label}
      </Text>
      <RecentRecipientRows recipients={recipients} disabled={disabled} onPick={onPick} />
    </div>
  );
}
