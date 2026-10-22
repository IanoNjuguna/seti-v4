import { cn } from '@/lib/cn';
import { BrandMark } from './BrandMark';
import { MARK_BASE_CLASS, MARK_FALLBACK_CLASS, MARK_SIZE_CLASS, MARK_TONES, MARK_TONE_CLASS } from './Mark.constants';
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
 * The mark is generated from the USERNAME: two letters from it, and a tone from a hash of
 * it. Same name, same mark, everywhere, forever, which is the property that made Gravatar
 * useful in the first place. Because a name is the seed, a person who renames gets a new
 * mark, and that is the honest reading of "generated from the name" rather than a bug.
 *
 * Everything is computed locally: no request, no cache, no CSP entry.
 *
 * ## What it is not
 *
 * Decorative. The handle sits beside it as text and is what a reader reads; this is
 * `aria-hidden` for the same reason every icon in this app is.
 */
export function Mark({ handle, address, size = 'md', className }: MarkProps) {
  const letters = markInitials(handle);

  /*
   * An unnamed account is the one case the product's own face belongs in: there is no
   * person to draw yet, and a generic person glyph says less than the mark does. It is
   * drawn in the neutral well rather than on a tone, because the cream mark on a coloured
   * circle is the pair `BrandMark`'s own rule forbids.
   */
  if (!letters) {
    return (
      <span aria-hidden className={cn(MARK_BASE_CLASS, MARK_SIZE_CLASS[size], MARK_FALLBACK_CLASS, className)}>
        <BrandMark expression="friendly" canvas="light" className={size === 'lg' ? 'h-9' : size === 'md' ? 'h-6' : 'h-5'} />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(MARK_BASE_CLASS, MARK_SIZE_CLASS[size], MARK_TONE_CLASS[markTone(handle ?? address)], className)}
    >
      {letters}
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
 * The tone a seed generates: the username in practice, the address when an account has no
 * name, and never random.
 *
 * FNV-1a, written out rather than pulled from a library: this has to give the same answer
 * on the client and on the server, in every browser, forever, because the alternative is a
 * mark that changes colour between renders and looks like a different person.
 */
export function markTone(seed: string | null | undefined): MarkTone {
  const normalised = (seed ?? '').trim().toLowerCase().replace(/^@+/, '');
  const key = normalised;
  if (!key) return MARK_TONES[0];

  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return MARK_TONES[hash % MARK_TONES.length];
}
