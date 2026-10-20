import { BrandMark } from '@/components/ui';
import { cn } from '@/lib/cn';
import { SIGN_IN_COLUMN_CLASSES, SIGN_IN_MARK_CLASSES } from './SignInPanel.constants';
import type { SignInPanelProps } from './SignInScreen.types';

/**
 * The page's ONE column: the mark, then everything else, centred in the viewport with
 * the band's own padding above and below it.
 *
 * `max-w-sm` (384px) is deliberate and is the whole layout argument: a front door with
 * one field in it has no second column to fill, and a wider column would be a page
 * pretending to have more on it than it does.
 *
 * ## The mark is on the TYPE axis, not on the column's centre
 *
 * It used to be centred (`mx-auto`) over a stack that is flush left, which put the one
 * branded object 192px off the edge every other element follows: a centred emblem above
 * left-aligned type reads as two compositions stacked, not one. Flush left, the mark
 * starts the page and the headline continues it, so the whole front door shares one
 * vertical edge at every width — measured in the browser at 390, 768 and 1280 rather
 * than eyeballed.
 *
 * ## 48px, not 60
 *
 * 60px existed to match a 60px-tall phoenix in a landscape lockup, i.e. it was a
 * SIZE-PARITY decision for a centred emblem. On the type axis the mark is a masthead
 * above a 40px headline, and 60 made it the loudest object on a page whose instruction
 * should be; 48 keeps it sibling to the display line instead of louder than it. Only the
 * RENDERED height is set in the class: the asset is square and `w-auto` derives the
 * width from it, so the class cannot disagree with the file.
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
    <div className={SIGN_IN_COLUMN_CLASSES}>
      <BrandMark
        expression="friendly"
        canvas="dark"
        preload
        className={cn('entrance block', SIGN_IN_MARK_CLASSES)}
      />
      <div className="entrance entrance-2 mt-6">{children}</div>
    </div>
  );
}
