'use client';

import { QrPlate } from '@/components/qr/QrPlate';
import { CopyRow } from '@/components/copy/CopyRow';
import { ADDRESS_COPY } from './address.constants';
import type { AddressQrCardProps } from './address.types';

/**
 * The address, as a code and as text — the whole of the "by address" half.
 *
 * The code and the text beneath it describe the SAME string, and that is by
 * construction: the address is the server's wallet row for this account, the
 * network line names the network that row belongs to, and the code encodes
 * `eip681PaymentUri(address, chainId)` from that same answer. Nothing here derives
 * a second value that could disagree with the first.
 *
 * The address is printed in `font-mono` under the code because a QR fails — a
 * cracked screen, a camera that will not focus, a wallet that only accepts a paste
 * — and the person then needs to read or retype the exact string. It WRAPS rather
 * than truncating for the same reason: 42 characters are the whole of the thing
 * being handed over, and a clipped address is the one value on this screen that
 * cannot be guessed at.
 *
 * The copy control is the shared `CopyRow` — an icon that becomes a check — not the
 * 48px labelled button it used to be. One value, one control, on the value's own
 * line: the button was the largest thing in the card and said what the row already
 * said.
 *
 * The network line that used to sit here — "Send on Live. This is your Live deposit
 * address." — is GONE (the owner called it redundant, and it said the network twice
 * before saying it a third time in the QR's own title). The one sentence that
 * remains stands under the card (`ReceiveAddressPanel`), outside it, where it is
 * context for the half rather than a caption on this object.
 */
export function AddressQrCard({ state }: AddressQrCardProps) {
  return (
    <div className="flex flex-col items-start gap-4">
      <QrPlate value={state.payload} title={ADDRESS_COPY.qrTitle(state.network)} />

      {/* `w-fit max-w-full` keeps the control with the value instead of stranding
          it at the far edge of a 728px card: the address is 353px wide and its
          copy button 44, so a full-width row left 300px of nothing between them. */}
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
  );
}
