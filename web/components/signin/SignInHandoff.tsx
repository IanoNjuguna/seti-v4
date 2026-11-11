'use client';

import { BrandLockup, InfinityTrack, Text } from '@/components/ui';
import { SIGN_IN_HANDOFF_COPY, SIGN_IN_HANDOFF_DELAY_MS } from './SignInHandoff.constants';
import { useHandoffVisible } from './useHandoffVisible';

/**
 * The moment between a signed-in session and the app, and what each decision in it
 * answers. It replaced a full-bleed gradient, a mark floating with no wordmark, and
 * "Signed in. Opening Seti…".
 *
 *  1. **The app's own canvas, painted on the first frame.** No gradient and no
 *     ambient field: brand colour belongs on the landing hero, where it is saying
 *     something, not on a screen the customer is carried through. The layer is
 *     `canvas-dark`, the token the rail and the bottom bar are drawn in, and it goes
 *     up immediately, so the landing field cannot show through a gap while the words
 *     wait.
 *  2. **The mark, with its wordmark, in the rail's own brand box.** The paddings,
 *     height, gap and sizes below are the rail's (`AppRail.tsx`): its nav's `px-3`,
 *     its row's `px-4`, `--app-nav-bar`, `gap-3`, the `h-8` mark and the `heading-md`
 *     wordmark. Restated rather than imported, because the rail is chrome with a
 *     destination in it and this is a holding screen with none. The eye is left where
 *     the app's brand appears, so nothing moves when the app takes over. The mark is
 *     the rail's too — neutral, on the dark canvas — because the whole point of this
 *     screen is that nothing changes when the app arrives: a friendly face here would
 *     be one object visibly swapping for another.
 *  3. **One indicator**: the mark, plus one thin indeterminate line, and nothing else.
 *  4. **No splash if the wait is short.** `useHandoffVisible` holds the CONTENT back
 *     for `SIGN_IN_HANDOFF_DELAY_MS`, so the common case — a client navigation that
 *     finishes in a few frames — leaves the app's canvas with nothing written on it
 *     rather than a mark and a sentence that flash.
 *
 * Contrast on `canvas-dark`: `on-dark` 21:1 and `on-dark-mute` 10.6:1. The line is
 * `aria-hidden` decoration, and the wait is announced by the `role="status"`
 * sentence beside it, so nothing here is signalled by colour alone.
 */
export function SignInHandoff() {
  const visible = useHandoffVisible(SIGN_IN_HANDOFF_DELAY_MS);

  return (
    <div className="fixed inset-0 z-50 bg-canvas-dark text-on-dark">
      {visible ? (
        <>
          {/* The product's own lockup, in the dock's box (#542). It used to draw the rail's
              brand block — a neutral mark with the word typeset beside it — which was the
              reconstruction the supplied lockup retired, and a chrome that no longer exists. */}
          <div className="px-3">
            <div className="flex h-[var(--app-nav-bar)] items-center gap-3 px-4">
              <BrandLockup className="h-8" preload />
            </div>
          </div>

          <div className="px-3">
            <div className="px-4">
              <Text variant="body" as="p" color="inverse-muted">
                {SIGN_IN_HANDOFF_COPY.line}
              </Text>
              {/* One indicator, and it is the product's own: the infinity track that
                  `SignInSkeleton` uses, announcing the line above as its status label.
                  The wrapper's `role="status"` moved into the track, so the wait is
                  announced once rather than twice, and reduced motion leaves the static
                  path instead of a different animation. */}
              <InfinityTrack
                canvas="dark"
                size="sm"
                label={SIGN_IN_HANDOFF_COPY.line}
                className="mt-4 text-on-dark-mute"
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
