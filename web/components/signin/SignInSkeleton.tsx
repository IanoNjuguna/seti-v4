import { CometSpinner } from '@/components/ui';

/**
 * The sign-in page while the session works out whether anyone is signed in (#567).
 *
 * ## No words, and that is the reference set's answer
 *
 * The loading screens checked in Mobbin draw no text at all: Granola and Life Reset put their brand
 * mark on the field and nothing else, Opal draws a spinner alone, WHOOP wraps a ring around its mark.
 * Not one writes "Loading…", and this one does not either — the sentence that used to sit under the
 * indicator was the second thing saying the same word.
 *
 * What is left is the comet and nothing else, which is Opal's arrangement and the closest of the four
 * to this page: a page whose whole content is one field does not need a caption explaining that it is
 * arriving.
 *
 * ## What a screen reader hears
 *
 * `CometSpinner` is a `role="status"` named "Loading", so the wait is announced once, by the thing
 * doing it. There is deliberately no second invisible sentence: two announcements of one fact is how
 * a screen reader user learns to ignore both. `aria-busy` on the container is the other half of the
 * same information.
 *
 * The product mark is not drawn here (`SignInPanel`'s `showMark`), though Granola, Life Reset and
 * WHOOP all draw theirs: this page does not yet know who is here, so the greeting waits with the
 * rest of it.
 */
export function SignInSkeleton() {
  return (
    <div className="flex flex-col items-center" aria-busy="true">
      <CometSpinner className="h-16 w-16 text-on-dark" />
    </div>
  );
}
