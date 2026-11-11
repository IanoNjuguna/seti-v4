import { BrandLockup } from '@/components/ui';
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
export function SignInPanel({ children, title, showMark = true }: SignInPanelProps) {
  return (
    <div className="relative flex w-full flex-1 items-center justify-center px-6 py-14">
      <div aria-hidden className="grain-layer" />

      <div className="relative w-full max-w-sm">
        {showMark ? (
          /* The LOCKUP, not the bare mark (#567). Three of the four sign-in screens in the
             reference set (TradingView, Disney+, Mindtrip) open with the wordmark above the form,
             sized around 110-150px wide; the fourth (Linear) draws its circular mark in the same
             position at the same weight, and Coinbase puts its mark top-left. A lone 40px head on
             an otherwise empty field identifies nothing: it reads as an avatar. `h-10` is 40px
             tall, which is 110px of lockup — the same width as the references — and it is one
             image, so the face and the name cannot drift apart. */
          <BrandLockup className="entrance mx-auto block h-10 w-auto" preload />
        ) : null}

        {/* The page's ONE heading, and it is visible (#567).
            Every sign-in and sign-up screen in the reference set carries a title above the field
            — TradingView's nav row, Mindtrip's "Welcome to Mindtrip", Linear's "What's your email
            address?", Disney+'s "Enter your email address to continue", Crypto.com's "What is your
            Email Address?", Medium's "Sign up with email.", Coinbase's "Create your account" — and
            a page with a logo, a checkbox and a field whose label is the only other word on it has
            nothing saying what it is for.

            The TITLE IS A PROP, because the two stages ask different questions: the entry stage is
            "What's your email address?" (Linear's own words, and the question the field answers) and
            the code stage is "Enter the code." One panel, one heading, and the stage supplies the
            sentence — a heading that has to cover both would be the route's name again, which is
            what was deleted. The loading stage passes none: it has nothing to announce but the wait.
            `text-balance` keeps a two-line title from ending on one short word. */}
        {title ? (
          <h1
            className={`text-balance font-brand text-heading-lg font-medium text-on-dark ${showMark ? 'mt-10' : ''}`}
          >
            {title}
          </h1>
        ) : null}

        <div className={showMark ? 'entrance entrance-2 mt-8' : 'entrance mt-8'}>{children}</div>
      </div>
    </div>
  );
}
