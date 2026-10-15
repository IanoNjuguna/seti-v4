'use client';

import { Card, StateMessage, Text } from '@/components/ui';
import { ProfileDepositCard } from './ProfileDepositCard';
import { ProfileNetworkSwitch } from './ProfileNetworkSwitch';
import { PROFILE_NETWORK_COPY } from './ProfileNetwork.constants';
import { useProfileNetwork } from './useProfileNetwork';

/**
 * Practice ⇄ Live, as a first-class account control.
 *
 * The account is either practising on testnet or live on mainnet, and this card
 * is where that is chosen and where the consequences are stated:
 *
 *  - the server decides the network, and a switch is a REQUEST the server may
 *    refuse with a reason (Live until a mainnet batch proof exists);
 *  - the Live side shows the account's deposit address with the plain "fund this
 *    from another wallet" note, because v1 has no on-ramp and a live account
 *    therefore starts empty;
 *  - the reason a disabled Live cannot be chosen is rendered as text, never only
 *    as a greyed-out control.
 *
 * The card says what the money IS exactly once, and the switch says it: its note
 * is `NETWORK_NOTE`, the app's single sentence for the network (the frame's strip
 * renders the same string). The card used to add a second sentence of its own
 * underneath, so one 40px card told the customer twice in two slightly different
 * ways — and a fact stated twice is a fact read zero times.
 */
export function ProfileNetworkCard() {
  const { network, live, depositAddress, switching, error, switchTo } = useProfileNetwork();

  return (
    <Card className="space-y-4">
      <div>
        <Text variant="card-title" as="p">
          {PROFILE_NETWORK_COPY.title}
        </Text>
        <Text variant="micro" as="p" className="mt-1 text-mute">
          {PROFILE_NETWORK_COPY.intro}
        </Text>
      </div>

      <ProfileNetworkSwitch
        network={network}
        switching={switching}
        live={live}
        onSwitch={(target) => void switchTo(target)}
      />

      {error ? (
        <StateMessage variant="failure" title={PROFILE_NETWORK_COPY.errorTitle} body={error} />
      ) : null}

      {network === 'mainnet' ? <ProfileDepositCard depositAddress={depositAddress} /> : null}
    </Card>
  );
}
