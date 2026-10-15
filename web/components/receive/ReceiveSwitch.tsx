'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { RECEIVE_PAGE_COPY } from './ReceivePage.constants';
import type { ReceiveSwitchProps, ReceiveView } from './ReceivePage.types';

/** The two halves, in the order they are offered. */
const VIEWS: ReceiveView[] = ['name', 'address'];

/**
 * Which half of Receive is on screen: the name a Seti account can send to, or the
 * address that works from any wallet.
 *
 * Two choices in one control rather than two cards on one page, because the two
 * codes look alike and mean different things: a person holding the phone up must
 * never be able to scan the address when they meant the name. One code per frame.
 *
 * It is LINKS, not buttons, and the state lives in the URL (`?view=`). That is what
 * keeps a reload, a bookmark and an old `/app/deposit` link landing on the half
 * they refer to instead of resetting to the first one — and the control can only
 * ever show one of the two, so there is no third state to get wrong.
 *
 * The marks follow the Profile network switch: the chosen half is the dark block,
 * the other is `surface-soft`. Colour is never the only signal — `aria-current`
 * says which one is current, and both are labelled in words.
 */
export function ReceiveSwitch({ view }: ReceiveSwitchProps) {
  return (
    <div role="group" aria-label={RECEIVE_PAGE_COPY.title} className="flex flex-wrap gap-2">
      {VIEWS.map((option) => {
        const active = view === option;

        return (
          <Link
            key={option}
            href={`/app/receive?view=${option}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-touch h-10 items-center rounded-md px-5 text-body-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-light',
              active ? 'bg-canvas-dark text-on-dark' : 'bg-surface-soft text-ink hover:bg-faint'
            )}
          >
            {RECEIVE_PAGE_COPY[option]}
          </Link>
        );
      })}
    </div>
  );
}
