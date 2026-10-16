import type { Transaction } from '@/lib/types';
import type { NoIdentityView } from '@/components/app/no-account.types';

/** A day's rows, in the order the server returned them (newest first). */
export interface ActivityDayGroup {
  /** Stable key for the list: the day, not the index. */
  key: string;
  /** `Today`, `Yesterday`, or a written date. */
  label: string;
  transactions: Transaction[];
}

export interface ActivityDayGroupProps {
  group: ActivityDayGroup;
  /**
   * Opens the row's receipt. Threaded from the page, which owns the sheet — the
   * list stays a renderer and never holds the open row itself.
   */
  onSelect?: (transaction: Transaction) => void;
}

/** The list itself. */
export interface ActivityListProps {
  onSelect?: (transaction: Transaction) => void;
}

/**
 * The screen with no account behind it.
 *
 * `view` is the session's own state, narrowed to the two that have no account
 * (`NoIdentityView`), so this component cannot be asked to render the state that
 * HAS data.
 */
export interface ActivitySignedOutProps {
  view: NoIdentityView;
}

/** The history itself, before the screen decides what to show. */
export interface ActivityPagesValue {
  groups: ActivityDayGroup[] | null;
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  retry: () => void;
}

export interface UseActivityReturn {
  /** `null` until the first page lands — the difference between "loading" and "empty". */
  groups: ActivityDayGroup[] | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  empty: boolean;
  loadMore: () => void;
  retry: () => void;
}
