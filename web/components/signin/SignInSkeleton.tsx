import { InfinityTrack } from '@/components/ui';
import { SIGN_IN_COPY } from './SignInScreen.constants';

/**
 * The sign-in page while the session works out whether anyone is signed in.
 *
 * It used to be one grey sentence inside the panel, which meant the front door's only
 * above-the-fold content for a second or two was the word "One moment…" on an empty
 * black field. That reads as a page that failed to load, not a page loading: the shape of
 * what is coming was missing, which is the whole job of a skeleton.
 *
 * ## Two indicators, two different claims
 *
 * The blocks below are the SHAPE of the entry form — a two-line heading at `heading-lg`,
 * the lede, a label, a field, the consent and the button — measured from the real form,
 * so nothing moves when it arrives. The track above them is the other claim: that work is
 * running and its length is unknown. A skeleton alone can be a still image of a page that
 * never comes, which is why the one wait on this page now has both.
 *
 * The words stay for assistive tech and are hidden visually: the track is a `status`, so
 * a screen reader is told "One moment…" while a sighted visitor sees the page assembling.
 */
export function SignInSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true">
      <InfinityTrack canvas="dark" size="md" label={SIGN_IN_COPY.restoring} className="text-on-dark-mute" />

      {/* The heading: two lines, at the size the entry form's one heading uses. */}
      <div aria-hidden className="mt-8 flex flex-col gap-3">
        <span className="block h-8 w-11/12 rounded-sm bg-surface-elevated" />
        <span className="block h-8 w-1/2 rounded-sm bg-surface-elevated" />
      </div>

      {/* The lede, one step down. */}
      <span aria-hidden className="mt-4 block h-4 w-3/5 rounded-sm bg-surface-elevated" />

      {/* The field's label, then the field, at the height the real one occupies. */}
      <span aria-hidden className="mt-8 block h-3 w-14 rounded-sm bg-surface-elevated" />
      <span
        aria-hidden
        className="mt-2 block h-14 w-full rounded-md border border-hairline-dark bg-surface-deep"
      />

      {/* The consent: two lines, then the hint under it. */}
      <span aria-hidden className="mt-5 block h-4 w-full rounded-sm bg-surface-elevated" />
      <span aria-hidden className="mt-2 block h-4 w-2/3 rounded-sm bg-surface-elevated" />
      <span aria-hidden className="mt-3 block h-3 w-1/2 rounded-sm bg-surface-elevated" />

      {/* The button. */}
      <span aria-hidden className="mt-6 block h-12 w-full rounded-md bg-surface-elevated" />
    </div>
  );
}
