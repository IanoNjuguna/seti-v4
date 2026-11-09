'use client';

import { useState } from 'react';
import { CopyRow } from '@/components/copy/CopyRow';
import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { CHAIN_NAME } from '@/lib/chain';
import { RECEIVE_COPY } from './receive.constants';
import type { ReceiveAddressBlockProps } from './ReceiveAddress.types';

/**
 * The account's address, one tap below the code (#419, compacted by #498).
 *
 * It used to be three lines of prose printed under the code: a label, the full hex, and a warning
 * about which network to send on. Every receive screen in the reference set is ONE object — a code,
 * a name and a row of actions — and Wise, Revolut and N26 put nothing under theirs, so three lines
 * of a different subject sat under the page's subject and pushed it up the screen.
 *
 * It is a row now. The address is still printed IN FULL and wraps when it opens: `CopyRow`'s own
 * failure path tells a customer to select the string by hand, so clipping it would hide the one
 * thing they were sent to fetch. What closed is only the resting state.
 *
 * The label stays the visible text, because "Your address on Tempo" says what the tap is for better
 * than "Show address" does, and the chain is the part that matters: a deposit from a bridge has to
 * go to the right one.
 */
export function ReceiveAddressBlock({ address }: ReceiveAddressBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex w-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-11 items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light"
      >
        <Text variant="micro" as="span" color="secondary">
          {RECEIVE_COPY.addressLabel(CHAIN_NAME)}
        </Text>
        <Icon
          name="chevronRight"
          className={cn('h-3.5 w-3.5 text-stone', open && 'rotate-90')}
        />
      </button>

      {open ? (
        <>
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

          <Text variant="micro" as="p" color="secondary" className="max-w-xs text-center">
            {RECEIVE_COPY.addressNote(CHAIN_NAME)}
          </Text>
        </>
      ) : null}
    </section>
  );
}
