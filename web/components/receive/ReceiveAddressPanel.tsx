'use client';

import { QrPlate } from '@/components/qr/QrPlate';
import { CopyRow } from '@/components/copy/CopyRow';
import { Text } from '@/components/ui';
import { RECEIVE_COPY } from './receive.constants';
import { AddressFailure } from './address/AddressFailure';
import { ADDRESS_COPY } from './address/address.constants';
import { useReceiveAddress } from './address/useReceiveAddress';

/**
 * The "your address" half: the code and the text for a transfer from outside Seti.
 *
 * In a non-custodial app there is no "add money" — nothing is added, it arrives. So
 * this half hands over an address and the network to send on, and stops.
 *
 * The code and the text describe the SAME string, and that is by construction: the
 * address is the server's wallet row for this account, and the code encodes
 * `eip681PaymentUri(address, chainId)` from that same answer. Nothing here derives a
 * second value that could disagree with the first.
 *
 * The address is printed in `font-mono` under the code because a QR fails — a
 * cracked screen, a camera that will not focus, a wallet that only accepts a paste —
 * and the person then needs to read or retype the exact string. It WRAPS rather than
 * truncating for the same reason: 42 characters are the whole of the thing being
 * handed over, and a clipped address is the one value on this screen that cannot be
 * guessed at.
 *
 * There is no card around any of it. The objects stand on the page, the way the
 * username and merchant halves do, and the one sentence of context — which network
 * to send on, and the chain behind it — stands under them as page text
 * (`ADDRESS_COPY.tempoNote`). The old arrangement put a heading, a paragraph, a
 * code, an address and a button inside one dark well, which is how the surface ended
 * up as a wall to read with nothing said around it.
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-start gap-4">
        <QrPlate
          value={state.payload}
          title={ADDRESS_COPY.qrTitle(state.network)}
          download={{
            filename: ADDRESS_COPY.qrFilename(state.network),
            label: RECEIVE_COPY.download,
            working: RECEIVE_COPY.downloading,
            failed: RECEIVE_COPY.downloadFailed,
          }}
        />

        {/* `w-fit max-w-full` keeps the control with the value instead of stranding
            it at the far edge of the page: the address is 353px wide and its copy
            button 44, so a full-width row left 300px of nothing between them. */}
        <div className="w-fit max-w-full">
          <CopyRow
            display={state.address}
            value={state.address}
            label={ADDRESS_COPY.copyAction}
            failureText={ADDRESS_COPY.copyFailed}
            copiedText={ADDRESS_COPY.copiedAction}
            wrap
          />
        </div>
      </div>

      <Text variant="micro" as="p" color="secondary">
        {ADDRESS_COPY.tempoNote(state.network)}
      </Text>
    </div>
  );
}
