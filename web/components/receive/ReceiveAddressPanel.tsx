'use client';

import { QrPlate } from '@/components/qr/QrPlate';
import { CopyRow } from '@/components/copy/CopyRow';
import { Text } from '@/components/ui';
import { RECEIVE_COPY } from './receive.constants';
import { AddressFailure } from './address/AddressFailure';
import { ADDRESS_COPY } from './address/address.constants';
import { useReceiveAddress } from './address/useReceiveAddress';

/**
 * The "your address" half: the code and the address for a transfer from OUTSIDE Seti.
 *
 * Laid out the way the username and merchant halves are, deliberately — the half's own
 * LEAD line first, then the same centred row they draw: the code plate beside a panel
 * of copy rows, in the same container, at the same gaps. This half alone kept the old
 * left-aligned stack, which is why it read as a different product in the same tab. The
 * lead lives here rather than at the page because it names the NETWORK, and the network
 * is the server's answer for this address, not the build's.
 *
 * The address is printed in `font-mono` beside the code because a QR fails — a cracked
 * screen, a camera that will not focus, a wallet that only accepts a paste — and the
 * person then has to read or retype the exact 42 characters. It WRAPS rather than
 * truncating for the same reason: a clipped address is the one value here that cannot
 * be guessed at. Code and address are the same string by construction — the code
 * encodes `eip681PaymentUri(address, chainId)` from the server's own answer. There is
 * no card around any of it, exactly as in the other two halves.
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
    <div className="flex flex-col gap-4">
      <Text variant="body" as="p" color="secondary">
        {ADDRESS_COPY.lead(state.network)}
      </Text>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
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

        {/* The panel `ReceiveLinkPanel` draws the name half's rows in, so the plate
            sits beside it identically and the control stays on the value's line.
            `min-w-0`/`max-w-full` are what it needs with one 42-character row: the
            value must wrap rather than push the plate off a narrow screen. */}
        <div className="flex min-w-0 max-w-full flex-col">
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
    </div>
  );
}
