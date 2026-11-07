'use client';

import { CopyRow } from '@/components/copy/CopyRow';
import { Text } from '@/components/ui';
import { CHAIN_NAME } from '@/lib/chain';
import { RECEIVE_COPY } from './receive.constants';
import type { ReceiveAddressBlockProps } from './ReceiveAddress.types';

/**
 * The address block, drawn from a string (the hook that supplies one is `ReceiveAddress`).
 *
 * Split so the shape is renderable without a live session: the geometry and the copy of this
 * block are what #419 is about, and a component that can only be photographed with a signed-in
 * Privy wallet is one nobody checks.
 *
 * The shape is Base's, the only reference in the set that shows a name and an address on one
 * screen: the name stays the large string above it, and the hex sits under it, smaller, mono
 * and quiet, with its own copy control. The label scopes it the way Revolut's account-details
 * band scopes its rows ("For SGD transfers only"), and the note takes Coinbase's bluntness,
 * because a send on another network is lost money rather than an inconvenience.
 *
 * The address is printed IN FULL and wraps. `CopyRow` already carries that argument: the
 * failure path tells a customer to select the string by hand, so clipping it to `0x7cad…1da5`
 * would hide the one thing they were sent to fetch.
 */
export function ReceiveAddressBlock({ address }: ReceiveAddressBlockProps) {
  return (
    <section className="flex w-full flex-col items-center gap-1">
      <Text variant="micro" as="p" color="secondary">
        {RECEIVE_COPY.addressLabel(CHAIN_NAME)}
      </Text>

      <CopyRow
        display={address}
        value={address}
        label={RECEIVE_COPY.addressCopyLabel}
        failureText={RECEIVE_COPY.addressCopyFailed}
        copiedText={RECEIVE_COPY.addressCopied}
        wrap
        align="center"
        size="caption"
      />

      <Text variant="micro" as="p" color="secondary" className="mt-1 max-w-xs">
        {RECEIVE_COPY.addressNote(CHAIN_NAME)}
      </Text>
    </section>
  );
}
