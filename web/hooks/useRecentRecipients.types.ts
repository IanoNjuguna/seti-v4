import type { RecentRecipient } from '@/lib/api';

/** What the send screen knows about this account's recent payees. */
export interface RecentRecipientsState {
  /** Most recent first, at most five, as the server derived them. */
  recipients: RecentRecipient[];
  /** The sentence for a failed read, already mapped to our own copy. */
  error: string | null;
  /** True while the read is still in flight, so the block can hold its shape. */
  loading: boolean;
}
