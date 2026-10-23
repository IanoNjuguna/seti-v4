'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import {
  AUDIENCE_GROUP_LABEL,
  AUDIENCE_OPTIONS,
  audienceHref,
} from './Audience.constants';
import type { AudienceSelectorProps } from './Audience.types';

/**
 * Personal | Business, as a segmented control in the navbar.
 *
 * TWO LINKS, NOT TWO BUTTONS. Each segment is a real `<a href>` — `/` and
 * `/?for=business` — so the choice is in the URL rather than in component state:
 * it survives a reload, it can be copied out of the address bar and sent to
 * somebody, and a browser with no JavaScript still switches (it does a full page
 * load). `scroll={false}` keeps the reader where they are: tapping "Business"
 * while reading the fees band should change the words, not throw the page back to
 * the top.
 *
 * The active segment carries `aria-current="page"`, which is the honest
 * attribute here: the two URLs ARE two renderings of one page and the current
 * one is the one you are on. `role="group"` with a label names what the control
 * chooses, because the two words alone do not say what they do.
 *
 * GEOMETRY, AND WHERE IT COMES FROM. This is a segmented control, which the
 * reference site solves with a pill track and a pill thumb (`border-radius:
 * 6.25rem`). This system does not have a pill: `rounded-full` is reserved for
 * circles and everything else is `rounded-md` (12px, controls and surfaces) or
 * `rounded-sm` (8px, chips). So the track is `rounded-md` with a 3px inset and
 * the thumb is `rounded-sm` inside it — the same concentric look, drawn from the
 * radius scale that exists. It is the one place on the page where an inset
 * control needs a second, smaller radius, and 12/8 is what the scale offers.
 *
 * The thumb is the same white-on-black inversion as `Sign in`: on this bar white
 * is the surface that carries text, and a cobalt thumb would make the selector
 * the loudest thing in the nav.
 */
export function AudienceSelector({ audience, large = false }: AudienceSelectorProps) {
  return (
    <div
      role="group"
      aria-label={AUDIENCE_GROUP_LABEL}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-hairline-dark bg-surface-elevated p-[3px]"
    >
      {AUDIENCE_OPTIONS.map((option) => {
        const active = option.value === audience;

        return (
          <Link
            key={option.value}
            href={audienceHref(option.value)}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center justify-center rounded-sm px-3 font-semibold transition-colors duration-(--duration-quick) ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark',
              large ? 'h-11 text-body-md' : 'h-9 text-body-sm',
              active
                ? 'bg-canvas-light text-canvas-dark'
                : 'text-on-dark-mute hover:text-on-dark'
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
