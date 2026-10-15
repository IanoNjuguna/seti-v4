'use client';

import { Card } from '@/components/ui';
import { QrPlate } from '@/components/qr/QrPlate';
import { useRailIdentity } from '@/components/app/useRailIdentity';
import { RECEIVE_COPY } from './receive.constants';
import { ReceiveLinkPanel } from './ReceiveLinkPanel';

/**
 * The "by name" half of Receive: the code a sender scans, and the two strings they
 * can be handed instead.
 *
 * Get paid BY NAME — the other half of receiving, and not the address. Money
 * reaches a Seti account two ways and they are different enough to need different
 * affordances. The deposit address is for a transfer from OUTSIDE Seti: an address
 * on one network that another wallet sends to. This card is for another Seti
 * ACCOUNT: they send to the name, and the person never sees or shares an address
 * at all.
 *
 * The link and the code are the same string, and both come from `useRailIdentity`
 * — the same hook, and the same `merchant-link.ts`, that the rail's copy control
 * already uses. A second URL built here would be a second host and a second route
 * shape to keep in step.
 *
 * It renders NOTHING without a handle: the account's active mode may hold no name
 * yet, and the rail's identity card already offers the claim route for exactly
 * that state. Shown here, it would either duplicate that offer or — worse — show a
 * code for a link that resolves to nobody.
 *
 * The card holds the OBJECTS only: the code and the two values. Every word that
 * frames them (the page's title, which half is which, what to send when) belongs
 * to the page (`ReceivePage`), because a card that carries its own explanation and
 * then sits under a heading that says the same thing is how the first version ended
 * up with four lines of prose around one code.
 */
export function ReceiveNameCard() {
  const { signedIn, handle } = useRailIdentity();

  if (!signedIn || !handle) return null;

  return (
    <Card padding="sm" className="flex flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
        <QrPlate
          value={handle.link}
          title={RECEIVE_COPY.qrTitle(handle.handle)}
          size="compact"
        />

        <ReceiveLinkPanel
          handle={handle.handle}
          link={handle.link}
          caption={handle.caption}
        />
      </div>
    </Card>
  );
}
