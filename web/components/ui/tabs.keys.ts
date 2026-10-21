/**
 * The arithmetic of moving between tabs, with no React in it.
 *
 * It lives here rather than inside the hook so it can be checked without a browser:
 * a tablist's keyboard behaviour is the part of the component that a screenshot
 * cannot show, and a reviewer should not have to press keys to know that Left at the
 * first tab wraps to the last.
 */

export type TabKey = 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End';

const TAB_KEYS: readonly string[] = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

export function isTabKey(key: string): key is TabKey {
  return TAB_KEYS.includes(key);
}

/**
 * The index a key moves to, or `null` when the key is not ours.
 *
 * `null` is the important return: it is what tells the caller NOT to
 * `preventDefault`, so Home and End keep scrolling the page for someone whose focus
 * is somewhere else, and an unhandled arrow keeps doing whatever it did before.
 *
 * `current` of -1 means nothing is selected, which can happen for one render before
 * a value is chosen; both arrows then land on the first tab rather than throwing.
 */
export function nextTabIndex(count: number, current: number, key: TabKey): number | null {
  if (count <= 0) return null;

  const last = count - 1;
  const from = current < 0 ? 0 : Math.min(current, last);

  switch (key) {
    case 'ArrowRight':
      return current < 0 ? 0 : from >= last ? 0 : from + 1;
    case 'ArrowLeft':
      return current < 0 ? 0 : from <= 0 ? last : from - 1;
    case 'Home':
      return 0;
    case 'End':
      return last;
  }
}
