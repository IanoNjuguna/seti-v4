'use client';

import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { ReceiptWhenProps } from './Receipt.types';

/**
 * When it happened, and whether it went through.
 *
 * The status is a word plus an icon plus a colour, never a colour alone: the card
 * is read off a phone screen, in a photograph, and on paper. The colour is a role
 * (success / danger), not decoration.
 */
export function ReceiptWhen({ dateTime, status }: ReceiptWhenProps) {
  return (
    <section className="mt-5">
      <p className="text-body-sm text-on-dark-mute">{dateTime}</p>

      <p
        className={cn(
          'mt-1 flex items-center gap-1.5 text-body-sm font-semibold',
          status.tone === 'positive' ? 'text-accent-light-green' : 'text-accent-danger'
        )}
      >
        <Icon name={status.tone === 'positive' ? 'check' : 'alert'} className="h-4 w-4" />
        {status.label}
      </p>
    </section>
  );
}
