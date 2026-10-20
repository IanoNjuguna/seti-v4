import { SIGN_IN_COPY } from './SignInScreen.constants';

/**
 * The sign-in page while the session works out whether anyone is signed in.
 *
 * It used to be one grey sentence inside the panel, which meant the front door's
 * only above-the-fold content for a second or two was the word "One moment…" on an
 * empty black field. That reads as a page that failed to load, not a page loading:
 * the shape of what is coming was missing, which is the whole job of a skeleton.
 *
 * So this holds the shape of `SignInEntryForm`: a two-line heading at its display
 * size, the lede, one field, one button. Arriving at `/signin` therefore looks like
 * the form arriving rather than the site breaking, and nothing moves when it does —
 * the geometry is the entry form's, measured from it, not invented.
 *
 * The words are kept for assistive tech and hidden visually: a screen reader is told
 * "One moment…" while a sighted visitor sees the page assembling itself.
 */
export function SignInSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true">
      <p className="sr-only">{SIGN_IN_COPY.restoring}</p>

      {/* The heading: two lines, at the display step the entry form uses. */}
      <div aria-hidden className="flex flex-col gap-3">
        <span className="block h-8 w-11/12 rounded-sm bg-surface-elevated sm:h-10" />
        <span className="block h-8 w-1/2 rounded-sm bg-surface-elevated sm:h-10" />
      </div>

      {/* The lede, one step down. */}
      <span aria-hidden className="mt-6 block h-4 w-3/5 rounded-sm bg-surface-elevated" />

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
