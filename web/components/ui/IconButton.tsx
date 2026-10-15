'use client';

import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import type { IconButtonProps } from './IconButton.types';

/** Fill and glyph colour per surface. The glyph is the control; the circle is its well. */
const SURFACE_CLASSES: Record<NonNullable<IconButtonProps['surface']>, string> = {
  light: 'bg-surface-soft hover:bg-faint',
  dark: 'bg-transparent hover:bg-surface-deep',
};

const TONE_CLASSES: Record<NonNullable<IconButtonProps['tone']>, Record<string, string>> = {
  default: { light: 'text-ink', dark: 'text-on-dark-mute' },
  confirmed: { light: 'text-accent-light-green', dark: 'text-accent-light-green' },
};

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
 * Two surfaces, because the app draws chrome on black (the rail) and content on
 * white (a card). A `surface-soft` circle on the rail would be a bright chip
 * competing with the brand, so `dark` is an unfilled control that lifts to
 * `surface-deep` — the rail's own hover step.
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
  className,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-(--duration-quick) ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        SURFACE_CLASSES[surface],
        TONE_CLASSES[tone][surface],
        surface === 'dark' && 'focus-visible:ring-offset-canvas-dark',
        className
      )}
    >
      <Icon name={name} className="h-5 w-5" />
    </button>
  );
}
