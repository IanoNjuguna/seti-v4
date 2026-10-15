'use client';

import { Card, Text } from '@/components/ui';
import { AddressFailure } from './address/AddressFailure';
import { AddressQrCard } from './address/AddressQrCard';
import { ADDRESS_COPY } from './address/address.constants';
import { useReceiveAddress } from './address/useReceiveAddress';

/**
 * The "by address" half of Receive: where money from OUTSIDE Seti arrives.
 *
 * In a non-custodial app there is no "add money" — nothing is added, it arrives. So
 * this is a receive address, not a form: one address, the code a wallet scans, the
 * network said in words, and a copy control.
 *
 * THE ADDRESS IS THE SERVER'S, and that is the change this surface exists to make.
 * It used to render the browser's own embedded wallet, which cannot know which
 * network the deployment serves: a stale build, or a client whose chain was
 * switched, would state the wrong CHAIN to send on — and the wrong network view the
 * deposit would land in — which is the whole of what the network label and the
 * EIP-681 chain id are for. It renders what `GET /account/deposit` answers for the
 * network THIS DEPLOYMENT SERVES, and refuses to render anything when the browser
 * and the server disagree (`useReceiveAddress`, which states each refusal as its own
 * type).
 *
 * A WHITE card, like the name half beside it in the switch: the two halves are one
 * surface now, and a dark well on one half and a white card on the other read as
 * two different products in the same tab. The loading and failure states render
 * inside the same card — an address that is still being found is not a reason to
 * change the shape of the page.
 */
export function ReceiveAddressPanel() {
  const { state } = useReceiveAddress();

  return (
    <div className="flex flex-col gap-3">
      <Card padding="sm">
        {state.status === 'loading' ? (
          <Text variant="body" as="p" color="secondary">
            {ADDRESS_COPY.loading}
          </Text>
        ) : state.status === 'ready' ? (
          <AddressQrCard state={state} />
        ) : (
          <AddressFailure state={state} />
        )}
      </Card>

      {/* The chain, named once, at the foot of the half — outside the card, because
          it is context for the section rather than part of the address object. It
          only stands when there IS an address: naming the network under a refusal
          would read as "send anyway". */}
      {state.status === 'ready' ? (
        <Text variant="micro" as="p" color="secondary">
          {ADDRESS_COPY.tempoNote(state.network)}
        </Text>
      ) : null}
    </div>
  );
}
