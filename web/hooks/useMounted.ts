'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the component has mounted on the client.
 *
 * `false` on the server and on the first client render, `true` afterwards, with
 * no state and therefore no extra render pass. This is the guard for a value that
 * can only exist in the browser (an origin, a `window` read): computing it during
 * render would run it against the server's clock or crash it, and computing it in
 * an effect would flash an empty first paint. `useSyncExternalStore` gives one
 * value for hydration (the server's) and the real one immediately after.
 */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
