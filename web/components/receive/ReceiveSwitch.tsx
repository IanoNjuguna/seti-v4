'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { RECEIVE_PAGE_COPY } from './ReceivePage.constants';
import type { ReceiveSwitchProps } from './ReceivePage.types';

/**
 * Which of a BUSINESS account's two strings is on screen: the username another Seti
 * account pays, or the merchant name a customer pays at the counter.
 *
 * It is drawn only when there are two things to switch between, and the page enforces
 * that. A person's account has one view, and a one-option strip is not a choice — it is
 * decoration that reads as a control somebody else already used.
 *
 * The two halves are a SWITCH rather than two codes stacked on one page because they look
 * alike and mean different things: a person holding a phone up must never show the
 * counter code when they meant to be paid by a friend. One code per frame.
 *
 * It is LINKS, not buttons, and the state lives in the URL (`?view=`). That keeps a
 * reload, a bookmark and a shared link landing on the half they name instead of resetting
 * to the first — and the page only ever renders a half this account actually has, so there
 * is no state the switch can display without a body behind it.
 *
 * The marks follow the Profile network switch: the chosen half is the dark block, the
 * other is `surface-soft`. Colour is never the only signal — `aria-current` says which is
 * current, and both options are labelled in words (the string each one shows, never the
 * channel that would carry it).
 */
export function ReceiveSwitch({ view, views }: ReceiveSwitchProps) {
  return (
    <div
      role="group"
      aria-label={RECEIVE_PAGE_COPY.title}
      className="flex flex-wrap justify-center gap-2"
    >
      {views.map((option) => {
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
