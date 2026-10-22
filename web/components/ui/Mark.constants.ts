import type { MarkSize, MarkTone } from './Mark.types';

/**
 * The tones a mark may take, and why these five.
 *
 * A mark has no photograph and no upload, so its ONLY distinguishing feature besides the
 * letters is colour. That makes the palette a legibility decision, not a decorative one:
 * every tone here is measured against the text that sits on it, and every one clears
 * 4.5:1 for white initials. The five are existing system colours, so nothing new enters
 * `design/revolut.md` and no raw hex appears in a component.
 *
 * Measured (white on tone): primary 6.06:1, primary-deep 7.75:1, charcoal 10.93:1,
 * accent-blue-link 4.92:1, accent-brown 4.56:1.
 *
 * Three colours from the same accent family were deliberately left out: accent-teal
 * (3.04:1), accent-danger (4.24:1) and accent-yellow (well under 4:1). They are fine as
 * an accent on white, which is how the system uses them, and too weak as a surface with
 * white text on top.
 */
export const MARK_TONES: readonly MarkTone[] = [
  'primary',
  'primary-deep',
  'charcoal',
  'accent-blue-link',
  'accent-brown',
];

export const MARK_TONE_CLASS: Record<MarkTone, string> = {
  primary: 'bg-primary text-on-primary',
  'primary-deep': 'bg-primary-deep text-on-primary',
  charcoal: 'bg-charcoal text-on-dark',
  'accent-blue-link': 'bg-accent-blue-link text-on-dark',
  'accent-brown': 'bg-accent-brown text-on-dark',
};

/**
 * The two sizes that exist.
 *
 * `md` is the 40px well the profile and activity rows already reserve; `sm` is the same
 * object at the size a list row can afford. Nothing smaller: two letters at 24px stop
 * being letters.
 */
export const MARK_SIZE_CLASS: Record<MarkSize, string> = {
  lg: 'h-16 w-16 text-heading-md',
  md: 'h-10 w-10 text-button',
  sm: 'h-8 w-8 text-body-sm',
};

export const MARK_BASE_CLASS =
  'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase';
