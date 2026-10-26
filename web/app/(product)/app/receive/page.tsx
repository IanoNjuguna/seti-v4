import { Suspense } from 'react';
import { ReceiveLoading } from '@/components/receive/ReceiveLoading';
import { ReceiveScreen } from '@/components/receive/ReceiveScreen';

/**
 * Receive — `/app/receive`.
 *
 * The one place money arrives, and the one string a person hands out to make that
 * happen: their USERNAME. Another Seti account pays it by typing it or by scanning the
 * code, and the code is the same name in a form a camera can read. The page presents the
 * name, and the name is the page.
 *
 * WHAT USED TO BE HERE, and why it is not. Three halves sat under a switch: by name, by
 * address, and — for a business — by merchant name. The link row went first: it was the
 * username with a host in front of it, a second copy control for the same string, and a
 * note explaining that a sender could also type the name, so the string a sender
 * actually uses arrived last, smallest, and explained rather than shown. Then the
 * address half went, by the owner's instruction, and with it `?view=address`: it named a
 * mechanism rather than a choice, it was the only half that needed a network sentence
 * and a server read, and a person paying a person never needs an address — that is the
 * point of a username.
 *
 * So a person's account has ONE view and draws no switch. A business has two, because a
 * customer at a counter pays the shop's name and a business also holds a username, and
 * two strings are a real choice — so the switch survives for exactly that account, and
 * is a single-option strip for nobody.
 *
 * An account with no name of its own is a state now, not a blank column: it says what is
 * missing, why it matters, and offers the claim route the rail's identity card also
 * offers. That state is reachable for an account whose mode holds no name yet, and it
 * used to render `null` under the title.
 *
 * The PAGE carries the framing — title, lead sentence, switch — and the halves carry the
 * objects, as before. There are still no cards around the code on purpose: a surface
 * that explains itself and then says the same sentence again is how this page ended up
 * with four lines of prose around one object.
 *
 * The `Suspense` boundary is required, not decorative: `useSearchParams` inside a route
 * that is prerendered as static content fails the build without one (the pay page
 * carries the same boundary for the same reason).
 */
export default function ReceivePage() {
  return (
    <Suspense fallback={<ReceiveLoading />}>
      <ReceiveScreen />
    </Suspense>
  );
}
