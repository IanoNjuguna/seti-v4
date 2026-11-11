import { CometSpinner } from '@/components/ui';
import { SIGN_IN_COPY } from './SignInScreen.constants';

/**
 * The sign-in page while the session works out whether anyone is signed in (#567).
 *
 * ## What it was, and why it is one spinner now
 *
 * It was a block skeleton — two heading bars, a lede, a field, the consent, the button — under an
 * infinity track, left-aligned inside a column that was left-aligned because the page was a split.
 * With the page centred, that shape was the only thing on the screen still hanging from an edge, and
 * it was a skeleton of a form that no longer has a heading to stand in for.
 *
 * A wait this short does not need the shape of the page that is coming; it needs something that is
 * obviously working. So it is the comet: centred, on its own, with no copy above it — the mark is
 * hidden for this stage too (`SignInPanel`'s `showMark`), because a product's face over a wait that
 * has not yet found out who is here greets nobody.
 *
 * `aria-busy` on the container and the panel's own words for assistive tech: the spinner announces
 * "Loading" through its own `status`, and the sentence the app uses everywhere is kept here rather
 * than dropped, so the wait is described twice on purpose — once by the shape, once by the words.
 */
export function SignInSkeleton() {
  return (
    <div className="flex flex-col items-center gap-8" aria-busy="true">
      <CometSpinner className="h-16 w-16 text-on-dark" />
      <span className="sr-only">{SIGN_IN_COPY.restoring}</span>
    </div>
  );
}
