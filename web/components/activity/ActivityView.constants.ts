/**
 * The two views of one account: what happened, and what it adds up to.
 *
 * The default is `transactions` and it is the one that writes NO query string, so
 * the plain `/app/activity` link stays the history. `analytics` is the only value
 * the URL carries.
 */
export type ActivityView = 'transactions' | 'analytics';

export const DEFAULT_ACTIVITY_VIEW: ActivityView = 'transactions';

/** The query parameter the selected view lives in. */
export const ACTIVITY_VIEW_PARAM = 'view';

export const ACTIVITY_VIEWS = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'analytics', label: 'Analytics' },
] as const satisfies readonly { id: ActivityView; label: string }[];

export const ACTIVITY_VIEW_ID_PREFIX = 'activity-view';

export const ACTIVITY_VIEW_COPY = {
  /** Names the group for a screen reader. */
  label: 'Activity views',
} as const;
