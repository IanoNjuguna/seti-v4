import { BrandMark } from '@/components/ui';
import type { SignInPanelProps } from './SignInScreen.types';

/**
 * The page's ONE column: the mark, then everything else, centred in the viewport with
 * the band's own padding above and below it.
 *
 * `max-w-sm` (384px) is deliberate and is the whole layout argument: a front door with
 * one field in it has no second column to fill, and a wider column would be a page
 * pretending to have more on it than it does.
 *
 * The mark is CENTRED on that column (`mx-auto block`) and drawn at `h-[3.75rem]` —
 * 60px, the same height the landscape mark it replaced was drawn at. The alien's
 * head fills 93% of its square canvas, so 60px renders a 56px head: the same
 * visual weight as the 60px-tall, 85px-wide phoenix, and not the shrunken object
 * a padded canvas would have produced. Only the RENDERED size is set in the
 * class: the asset is square and `w-auto` derives the width from it, so the class
 * cannot disagree with the file and no second copy of the mark is needed.
 *
 * It is the FRIENDLY face, not the neutral one. This is the front door: the only
 * screen whose entire job is to make a first impression, and the one place the
 * identity is addressing a person rather than naming the product.
 *
 * It is `preload`ed rather than lazily loaded — it is the first thing on the page, and
 * a brand mark that fades in is the one object here that must not. `entrance` is the
 * landing page's own entrance (`globals.css`, DIAL ONE), so the page arrives the way
 * the landing page does and freezes under reduced motion.
 */
export function SignInPanel({ children }: SignInPanelProps) {
  return (
    <div className="w-full max-w-sm">
      <BrandMark
        expression="friendly"
        canvas="dark"
        preload
        className="entrance mx-auto block h-[3.75rem]"
      />
      <div className="entrance entrance-2 mt-8">{children}</div>
    </div>
  );
}
