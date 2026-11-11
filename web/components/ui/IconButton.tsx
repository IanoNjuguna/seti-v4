'use client';

import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import type { IconButtonProps } from './IconButton.types';

/** The well, per surface. The glyph is the control; the circle is what it sits in. */
const SURFACE_CLASSES: Record<
  NonNullable<IconButtonProps['well']>,
  Record<NonNullable<IconButtonProps['surface']>, string>
> = {
  soft: { light: 'bg-surface-soft hover:bg-faint', dark: 'bg-transparent hover:bg-surface-deep' },
  /*
   * `none` is the same 44px control with no paint at all, in any state. Hover moved to
   * the GLYPH colour instead: the first draft reused `PageBack`'s hover disc, and that is
   * a grey circle appearing under the pointer on a row that was asked to have no circle.
   * A glyph that darkens says the same thing in this place, because it is already a
   * control on a line of type rather than a shape on a page.
   */
  none: { light: 'bg-transparent', dark: 'bg-transparent' },
};

/**
 * The resting glyph, per well and surface.
 *
 * A BARE glyph sits INSIDE a line of type, so it takes the secondary ink. `ink` beside
 * `@ian` in `body-medium` was the darkest mark in the row — a quiet convenience reading as
 * the row's subject. It steps up to full ink on hover, where it is what is about to be
 * pressed.
 */
const GLYPH_CLASSES: Record<
  NonNullable<IconButtonProps['well']>,
  Record<NonNullable<IconButtonProps['surface']>, string>
> = {
  soft: { light: 'text-ink', dark: 'text-on-dark-mute' },
  none: { light: 'text-mute hover:text-ink', dark: 'text-on-dark-mute hover:text-on-dark' },
};

/** The success accent on the GLYPH, never the fill — see `tone` below. */
const CONFIRMED_CLASS = 'text-accent-light-green';

/**
 * A round, icon-only button — a circle is the doc's shape for exactly this
 * ("circles stay circles: avatars, status dots and round icon buttons"), and 44px
 * is the tap minimum rather than a taste call.
 *
 * It exists as a primitive because an icon-only control is where accessibility is
 * cheapest to get wrong: it needs a label that is not on screen, a hover title for
 * the people who use a pointer, and a hover/focus step that keeps it visible
 * without turning into a coloured button. Writing that by hand inside a feature is
 * how the second, slightly different one appears.
 *
 * TWO SURFACES, because the app draws chrome on black (the rail) and content on
 * white (a card). A `surface-soft` circle on the rail would be a bright chip
 * competing with the brand, so `dark` is an unfilled control that lifts to
 * `surface-deep` — the rail's own hover step.
 *
 * TWO WELLS, and the second is the newer one. `soft` (default) is the disc: a control
 * that stands on its own, beside a heading or between two fields. `none` keeps the 44px
 * hit area and drops the paint in every state, for a glyph that belongs to a LINE OF TYPE
 * instead of to the page — the copy action at the end of a value. Hover darkens the glyph
 * there rather than lifting a disc under it.
 *
 * `none` exists because the disc was the wrong shape for that job. On `/app/receive` it
 * was the second-heaviest object on a screen whose subject is a code, and the same grey
 * circle closed three unrelated rows across the app. The references print the glyph bare
 * at the end of a labelled row (Binance's `My Pay ID ⧉`, Revolut's `Account number ⧉`,
 * Coinbase's pay-in rows): the value is the object and the glyph is the way to take it,
 * so a well makes the affordance outrank the string it copies.
 *
 * `tone="confirmed"` is the success accent ON THE GLYPH, never the fill: the
 * system has no coloured-fill badge token, and a filled green circle would read as
 * a status chip rather than as the control that was just pressed.
 */
export function IconButton({
  name,
  label,
  onClick,
  tone = 'default',
  surface = 'light',
  well = 'soft',
  disabled = false,
  className,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-(--duration-quick) ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        SURFACE_CLASSES[well][surface],
        tone === 'confirmed' ? CONFIRMED_CLASS : GLYPH_CLASSES[well][surface],
        surface === 'dark' && 'focus-visible:ring-offset-canvas-dark',
        className
      )}
    >
      <Icon name={name} className="h-5 w-5" />
    </button>
  );
}
