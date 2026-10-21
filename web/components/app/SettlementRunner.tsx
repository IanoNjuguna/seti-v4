'use client';

import { useSettlementRunner } from '@/hooks/useSettlementRunner';

/**
 * Runs the settlement pass and renders nothing.
 *
 * A component rather than a hook call inside the layout because the layout is a
 * server component: the pass needs the session, the wallet and the network, all of
 * which are client state. Mounting it inside `AppGate` means it exists only where
 * there is an account, and it unmounts with the app shell.
 *
 * Nothing about it is visible. If the whole thing silently did nothing, the only
 * way to notice would be a balance that stayed in the token it arrived in — which
 * is exactly the fallback working.
 */
export function SettlementRunner() {
  useSettlementRunner();
  return null;
}
