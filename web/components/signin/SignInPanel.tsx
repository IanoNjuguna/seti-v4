import Image from 'next/image';
import { SIGN_IN_MARK } from './SignInScreen.constants';
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
 * 60px, exactly 1.5× the 2.5rem (40px) it was, so it reads as the page's masthead
 * rather than a corner logo. Only the RENDERED size is set in the class:
 * `width`/`height` stay the asset's own 424×298, which is the ratio `w-auto` derives
 * the width from, so the props and the class cannot disagree and no second copy of
 * the mark is needed.
 *
 * It is `preload`ed rather than lazily loaded — it is the first thing on the page, and
 * a brand mark that fades in is the one object here that must not. `entrance` is the
 * landing page's own entrance (`globals.css`, DIAL ONE), so the page arrives the way
 * the landing page does and freezes under reduced motion.
 */
export function SignInPanel({ children }: SignInPanelProps) {
  return (
    <div className="w-full max-w-sm">
      <Image
        src={SIGN_IN_MARK.src}
        alt=""
        width={SIGN_IN_MARK.width}
        height={SIGN_IN_MARK.height}
        preload
        className="entrance mx-auto block h-[3.75rem] w-auto"
      />
      <div className="entrance entrance-2 mt-8">{children}</div>
    </div>
  );
}
