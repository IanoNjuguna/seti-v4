import { BrandMark, Text } from '@/components/ui';
import { SIGN_IN_COPY } from './SignInScreen.constants';
import { SignInAmbientPanel } from './SignInAmbientPanel';
import type { SignInPanelProps } from './SignInScreen.types';

/**
 * The front door as a SPLIT: the column you work in, and the panel that shows you what
 * you are signing in for.
 *
 * ## Two columns, one of which disappears
 *
 * At `lg` and up the page is half form, half ambient panel. Below it, the panel is gone
 * and what is left is exactly the page that was here before: one column, the mark, the
 * heading, the doors. That is not a compromise, it is the phone design — on a narrow
 * screen the column IS the page, and a decorative half above it would push the one
 * instruction below the fold.
 *
 * ## The column is centred, the block is not stretched
 *
 * `justify-center` on the column puts the block on the optical centre of the viewport
 * rather than hanging it from the top with a dead field beneath. The mark, the form and
 * the footnote move as one block, which is the nudge the first draft needed: the legal
 * line used to be pinned to the bottom of the page with 200px of nothing between it and
 * the button.
 *
 * ## The mark is back on the column's LEFT edge
 *
 * It was centred over this column while the column was the whole page. In a split it
 * starts the column the way the heading continues it, so the whole left half shares one
 * vertical edge — the same argument that put the landing page's hero on its own edge,
 * and the reason a centred emblem over flush-left type reads as two compositions.
 *
 * `max-w-sm` (384px) still sets the form's measure: the column is now half the viewport,
 * the form inside it is not. The mark is `h-10`: a masthead over a 44px headline, not
 * the loudest object on the page, and `w-auto` derives the width from the square asset
 * so the class cannot disagree with the file.
 */
export function SignInPanel({ children }: SignInPanelProps) {
  return (
    <div className="grid w-full grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-14 sm:px-10 lg:px-14 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:mx-0">
          <BrandMark
            expression="friendly"
            canvas="dark"
            preload
            className="entrance block h-10 w-auto"
          />
          <div className="entrance entrance-2 mt-10">{children}</div>
          <Text as="p" variant="micro" color="inverse-muted" className="entrance mt-14 opacity-60">
            {SIGN_IN_COPY.footnote}
          </Text>
        </div>
      </div>

      <SignInAmbientPanel />
    </div>
  );
}
