import { BrandMark } from '@/components/ui';
import { SIGN_IN_COPY } from './SignInScreen.constants';
import type { SignInPanelProps } from './SignInScreen.types';

/**
 * The front door: ONE centred column on a grainy dark field (#567).
 *
 * ## What the split was, and why it is gone
 *
 * The page was two halves — the form, and a decorative panel holding a mock payment receipt in a
 * gradient field. The argument for it was that a visitor should see what they were signing in for.
 * The argument against it won: the receipt is a picture of a payment that has not happened, it spent
 * half a desktop viewport saying nothing the landing page had not already said, and on a phone it did
 * not exist at all — so the page had two shapes and the phone's (the real one) was the poorer.
 *
 * ## Centred, and the measure is unchanged
 *
 * One block on the optical centre of the viewport — mark, form, and nothing under them. `max-w-sm`
 * (384px) is still the form's measure: centring a column does not widen it, and a form stretched to a
 * 1440px viewport is a form nobody can read.
 *
 * ## The grain is the page's, not a panel's
 *
 * `.grain-layer` is the landing page's own page-level texture (fixed, `inset: 0`, `z-100`,
 * `pointer-events: none`). It was deliberately NOT used before, because the ambient panel wanted the
 * field inside an edge and the form column had to stay plain. With one column there is no division to
 * respect, so the whole page wears the product's field: the front door and the landing page are one
 * surface, which is what the split was arguing about in the first place.
 *
 * ## The footnote is gone, and the mark waits
 *
 * `footnote` said "Seti is not a bank. Your money is held in stablecoins you control." — the fact the
 * consent sentence already states, on a page that had just been asked to say less. It lives in
 * `TermsAcceptance` now, once, in the sentence the customer actually agrees to. The mark is hidden
 * for the loading stage (`showMark`): a greeting has nothing to greet while the page does not yet
 * know who is here.
 */
export function SignInPanel({ children, showMark = true }: SignInPanelProps) {
  return (
    <div className="relative flex w-full flex-1 items-center justify-center px-6 py-14">
      <div aria-hidden className="grain-layer" />

      <div className="relative w-full max-w-sm">
        {/* The page's only heading, and it is for the document rather than the eye: the visible
            "Sign in with your email." was the route's own name above a field labelled Email. */}
        <h1 className="sr-only">{SIGN_IN_COPY.pageTitle}</h1>

        {showMark ? (
          <BrandMark
            expression="friendly"
            canvas="dark"
            preload
            className="entrance mx-auto block h-10 w-auto"
          />
        ) : null}

        <div className={showMark ? 'entrance entrance-2 mt-10' : 'entrance'}>{children}</div>
      </div>
    </div>
  );
}
