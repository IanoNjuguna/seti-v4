'use client';

import { QrDownloadControl } from '@/components/qr/QrDownloadControl';
import { QrPlate } from '@/components/qr/QrPlate';
import { Text } from '@/components/ui';
import { RECEIVE_COPY } from './receive.constants';
import { AddressFailure } from './address/AddressFailure';
import { ADDRESS_COPY } from './address/address.constants';
import { useReceiveAddress } from './address/useReceiveAddress';
import { ReceiveField } from './ReceiveField';
import { ReceiveHalf } from './ReceiveHalf';

/**
 * The "your address" half: the code and the address for a transfer from OUTSIDE Seti.
 *
 * The SAME shape as the other two halves now: plate, then one field carrying the one
 * string, then the sentence that says which network to send on. Before, this half put
 * the address in a wrapping row BESIDE the plate, which pushed the plate off the line
 * at 360px and made the 42 characters ragged in a column next to a square.
 *
 * There is no Share control here, deliberately. A share sheet carries a link, and an
 * address is not a link: `navigator.share({ url: '0x…' })` is rejected by some
 * platforms and pasted as a broken link by others. The copy control in the field is
 * how an address travels, and the code is how it is scanned.
 *
 * The network sentence lives here rather than at the page because it names the
 * NETWORK, and the network is the SERVER's answer for this address, not the build's.
 * Code and address are the same string by construction: the code encodes
 * `eip681PaymentUri(address, chainId)` from that same answer.
 */
export function ReceiveAddressPanel() {
  const { state } = useReceiveAddress();

  if (state.status === 'loading') {
    return (
      <Text variant="body" as="p" color="secondary">
        {ADDRESS_COPY.loading}
      </Text>
    );
  }

  if (state.status !== 'ready') {
    return <AddressFailure state={state} />;
  }

  return (
    <ReceiveHalf
      plate={
        <QrPlate
          value={state.payload}
          title={ADDRESS_COPY.qrTitle(state.network)}
          align="start"
        />
      }
      field={
        <ReceiveField
          label={ADDRESS_COPY.fieldLabel}
          value={state.address}
          copyLabel={ADDRESS_COPY.copyAction}
          copyFailed={ADDRESS_COPY.copyFailed}
          copiedText={ADDRESS_COPY.copiedAction}
          note={ADDRESS_COPY.lead(state.network)}
        />
      }
      download={
        <QrDownloadControl
          download={{
            filename: ADDRESS_COPY.qrFilename(state.network),
            label: RECEIVE_COPY.download,
            working: RECEIVE_COPY.downloading,
            failed: RECEIVE_COPY.downloadFailed,
          }}
        />
      }
    />
  );
}
