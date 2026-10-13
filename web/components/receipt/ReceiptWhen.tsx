'use client';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui';
import type { ReceiptWhenProps } from './Receipt.types';

/**
 * When it happened, and whether it went through.
 *
 * The status is a word plus an icon plus a colour, never a colour alone: the card
 * is read off a phone screen, in a photograph, and on paper. The colour is a role
 * (success / danger), not decoration — so it is named through `color=`, and the
 * keyword is never a bare token class.
 */
export function ReceiptWhen({ dateTime, status }: ReceiptWhenProps) {
  return (
    <section className="mt-5">
      <p className="text-body-sm text-on-dark-mute">{dateTime}</p>

      <Text
        as="p"
        variant="micro"
        color={status.tone === 'positive' ? 'success' : 'alert'}
        className="mt-1 flex items-center gap-1.5 font-semibold"
      >
        <Icon name={status.tone === 'positive' ? 'check' : 'alert'} className="h-4 w-4" />
        {status.label}
      </Text>
    </section>
  );
}
