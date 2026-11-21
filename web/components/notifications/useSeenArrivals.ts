'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { SEEN_KEY } from './Notifications.constants';

/**
 * The instant this browser last looked at the list (#592).
 *
 * READ THROUGH `useSyncExternalStore`, because localStorage has no subscribers and React
 * refuses a synchronous setState in an effect. The server snapshot is `null`, which is also
 * the truth: a browser that has never opened the list has no seen instant.
 *
 * `markSeen` writes WITHOUT notifying. That is the one subtle decision here: notifying would
 * clear this visit's "New" marks the moment the page opened, and a mark that vanishes as it
 * is read is a mark nobody sees. The write lands now; the next load reads it.
 */
const listeners = new Set<() => void>();

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    // A browser that refuses storage is a browser where every row is new. Not worth a dialog.
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSeenArrivals() {
  const seenAt = useSyncExternalStore(subscribe, readSeen, () => null);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      // Same refusal, same silence: the mark is a convenience, not a record.
    }
  }, []);

  return { seenAt, markSeen };
}
