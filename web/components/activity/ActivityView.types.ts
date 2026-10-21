import type { ActivityView } from './ActivityView.constants';

/**
 * The selected view and the only way to change it.
 *
 * `setView` takes the view rather than an up/down index: a tablist that moved by
 * offset would have to know the order to answer "next", and the URL already knows
 * which view is meant.
 */
export interface UseActivityViewReturn {
  view: ActivityView;
  setView: (view: ActivityView) => void;
}
