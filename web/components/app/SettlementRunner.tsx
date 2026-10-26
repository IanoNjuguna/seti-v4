'use client';

import { useSettlementRunner } from '@/hooks/useSettlementRunner';

/**
 * The settlement pass, kept for a swap the customer ASKS for — not mounted.
 *
 * It used to be mounted inside `AppGate`, which meant converting a bridged token into
 * OUSD became a thing that happened a few seconds after the app opened. That is money
 * moving because a screen appeared: a wallet may not move a balance the customer did
 * not ask it to move (#222), and the home card now shows each token as itself, so the
 * conversion was not even buying invisibility any more. It is no longer mounted
 * anywhere, and `check:balances` fails if a surface mounts it again.
 *
 * It stays in the tree because the mechanism is right and the trigger was wrong: a
 * future swap control needs exactly this — plan, sign with the customer's wallet,
 * record the receipt — and rebuilding it would be rebuilding the hard part.
 *
 * A component rather than a hook call inside the layout because the layout is a
 * server component: the pass needs the session, the wallet and the network, all of
 * which are client state.
 */
export function SettlementRunner() {
  useSettlementRunner();
  return null;
}
