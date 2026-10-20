import { Text } from '@/components/ui';
import { NO_ACCOUNT_COPY } from '@/components/app/no-account.constants';
import { BALANCE_NOTE_COPY } from './BalanceNote.constants';
import type { BalanceNoteProps } from './BalanceNote.types';

/**
 * The balance card with no account behind it.
 *
 * It is the REAL card — same `canvas-dark` surface, same label, same place on
 * the screen — with one sentence where the figure goes. Three things it must
 * never do, each a lesson this app paid for once already:
 *
 *  1. **Never a number.** Not `0`, not `0.00`, not a dash that could be read as
 *     one, and no currency at all. A balance read as zero could not be told
 *     apart from a balance that IS zero, which is exactly the ambiguity the
 *     owner hit.
 *  2. **Never a skeleton.** A skeleton implies data is on its way — and while
 *     the session is still resolving there may be nobody for data to arrive
 *     for. So the "one moment" line is text, not a placeholder.
 *  3. **Never a hide control.** There is no value here to hide.
 */
export function BalanceNote({ view }: BalanceNoteProps) {
  return (
    <>
      <Text variant="micro" as="p" color="inverse-muted">
        <span id="balance-heading">{BALANCE_NOTE_COPY.label}</span>
      </Text>
      {/* `role="status"` on the one surface that still says this in words: with the
          rail and the activity section now holding shape instead, this line is the
          single announcement the page makes, so it has to reach assistive tech. */}
      <Text variant="body" as="p" color="inverse" className="mt-2" role="status">
        {view === 'anonymous'
          ? NO_ACCOUNT_COPY.anonymous(BALANCE_NOTE_COPY.what)
          : NO_ACCOUNT_COPY.restoring}
      </Text>
    </>
  );
}
