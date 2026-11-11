import { cn } from '@/lib/cn';
import { BrandMark } from './BrandMark';
import {
  MARK_BASE_CLASS,
  MARK_CANVAS,
  MARK_GLYPH_CLASS,
  MARK_SIZE_CLASS,
  MARK_WELL_CLASS,
} from './Mark.constants';
import type { MarkProps } from './Mark.types';

/**
 * The account's own face: our alien, drawn locally, never fetched.
 *
 * ## Why not a Gravatar
 *
 * A Gravatar URL is the md5 of an email address. We hold emails from sign-in, so serving one
 * would hand an email-derived identifier to a third party on every profile view, and anyone
 * holding a handle could test an email guess against it: an enumeration oracle attached to a
 * product with no KYC. Our own policy blocks it anyway (`img-src 'self' data: blob:`), and it
 * would mostly render the generic default. So nothing here is an `<img>` from a host we do not
 * run. If a real photo ever ships it is an upload to our own storage, and this mark is the
 * fallback for everyone who has not uploaded one.
 *
 * ## Why not initials — removed on the owner's instruction
 *
 * Until this change the mark was two letters from the username, on a tone hashed from it, so
 * two accounts with the same letters still looked different. The owner replaced it with the
 * product's own face: an account in Seti looks like Seti, and the handle printed beside it is
 * what identifies the person. That trades away "every account looks different" knowingly, and
 * the initials machinery (`markInitials`, `markTone`, the five measured tones) went with it
 * rather than being left behind as a second, unused face.
 *
 * ## What it is not
 *
 * Decorative. The name and the handle sit beside it as text and are what a reader reads, which
 * is why the whole mark is `aria-hidden`.
 *
 * ## The pairing, and why it is a constant
 *
 * The face sits on the DARK canvas in a medallion, and the colourway that goes in it is
 * `MARK_CANVAS`. They are exported together because choosing them independently is how this
 * shipped at **1.3:1** once: the cream mark on `surface-soft`. `Mark.constants` carries the
 * measurement for both pairs, and `check:profile-mark` holds the pairing.
 */
export function Mark({ size = 'md', className }: MarkProps) {
  return (
    <span
      aria-hidden
      className={cn(MARK_BASE_CLASS, MARK_SIZE_CLASS[size], MARK_WELL_CLASS, className)}
    >
      <BrandMark expression="friendly" canvas={MARK_CANVAS} className={MARK_GLYPH_CLASS[size]} />
    </span>
  );
}
