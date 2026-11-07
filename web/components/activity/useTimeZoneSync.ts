'use client';

import { useEffect, useRef } from 'react';
import { setAccountTimeZone } from '@/lib/api/analytics';

/**
 * Tell the server which zone this browser is in, when it is not the one already stored (#394).
 *
 * The account's zone decides which calendar day a payment belongs to, so it has to be a stored fact
 * rather than a per-request one. Nobody is asked a question: `Intl` already knows, and it is right
 * more often than a form would be.
 *
 * Three rules, all of them about not making things worse:
 *
 *  - it fires ONCE per session per value, so a failing endpoint cannot become a request loop;
 *  - it only fires when the two disagree, so the ordinary case is no request at all;
 *  - it is fired and forgotten. A failure leaves the account counting in its previous zone, which is
 *    a worse answer than the right one and a far better one than a blank tab.
 */
export function useTimeZoneSync(userId: string | null, storedTimeZone: string | undefined): void {
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !storedTimeZone) return;

    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browser || browser === storedTimeZone || sent.current === browser) return;

    sent.current = browser;
    void setAccountTimeZone(userId, browser).catch(() => {
      // Deliberately silent: the figures still render, counted in the zone the server already has.
    });
  }, [userId, storedTimeZone]);
}
