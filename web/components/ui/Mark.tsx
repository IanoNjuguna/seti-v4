import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { MARK_BASE_CLASS, MARK_SIZE_CLASS, MARK_TONES, MARK_TONE_CLASS } from './Mark.constants';
import type { MarkProps, MarkTone } from './Mark.types';

/**
 * The account's own mark: initials on a tone, derived, never uploaded.
 *
 * ## Why not a Gravatar
 *
 * A Gravatar URL is the md5 of an email address. We hold emails from sign-in, so serving
 * one would hand an email-derived identifier to a third party on every profile view, and
 * anyone holding a handle could test an email guess against it. That is an enumeration
 * oracle attached to a product with no KYC. It would also be blocked by our own policy
 * (`img-src 'self'`), and mostly render the generic default anyway.
 *
 * ## What it does instead
 *
 * The letters come from the handle. The tone comes from a hash of the ADDRESS, so two
 * accounts sharing initials still differ, and renaming a handle does not repaint the mark.
 * Everything is computed locally: no request, no cache, no CSP entry.
 *
 * ## What it is not
 *
 * Decorative. The handle sits beside it as text and is what a reader reads; this is
 * `aria-hidden` for the same reason every icon in this app is.
 */
export function Mark({ handle, address, size = 'md', className }: MarkProps) {
  const letters = markInitials(handle);

  return (
    <span
      aria-hidden
      className={cn(MARK_BASE_CLASS, MARK_SIZE_CLASS[size], MARK_TONE_CLASS[markToneFor(address, handle)], className)}
    >
      {letters ?? <Icon name="profile" className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} />}
    </span>
  );
}

/**
 * One or two letters for a name, or null when there is no name to take them from.
 *
 * A single name gives its first two letters ("javahouse" → "JA"), because one letter in a
 * 40px well reads as a bullet rather than as a monogram. A separated name gives one letter
 * from each of its first two parts ("ian-njuguna" → "IN").
 */
export function markInitials(handle?: string | null): string | null {
  const name = (handle ?? '').trim().replace(/^@+/, '');
  if (!name) return null;

  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * The tone index for an account: stable for the address, stable for the handle when there
 * is no address, and never random.
 *
 * FNV-1a, written out rather than pulled from a library: this has to give the same answer
 * on the client and on the server, in every browser, forever, because the alternative is a
 * mark that changes colour between renders and looks like a different person.
 */
export function markToneFor(address?: string | null, handle?: string | null): MarkTone {
  const seed = (address ?? handle ?? '').trim().toLowerCase();
  if (!seed) return MARK_TONES[0];

  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return MARK_TONES[hash % MARK_TONES.length];
}
