import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SignInScreen } from '@/components/signin/SignInScreen';
import { SessionProvider } from '@/lib/auth';
import { INVITE_COOKIE } from '@/lib/invite/invite.constants';

/**
 * Sign in — `/signin`, the product's front door.
 *
 * A TOP-LEVEL route, not a screen of the app: no rail, no bottom bar, nothing of
 * the app chrome around it. A bank does not put its front door inside a room — and
 * the app's sign-in wall, which lived inside the app's own chrome on `/app/profile`,
 * was exactly that.
 *
 * ## The ambient field lives in a PANEL now, not behind the page
 *
 * This route used to wear `LandingBackdrop`, the landing page's whole-page field, so
 * the door read as the same product as the page that sent the visitor here. It still
 * does, but the field moved: the page is a split, and the field is inside the right
 * panel where it has an edge, a drift and a single object floating in it. A fixed
 * full-viewport layer under a two-column composition would light the form column too,
 * and the form is the one place on this page that must stay plain.
 *
 * The session provider is mounted here, not hoisted: this page reads the invite
 * cookie and is the only reader of it. Privy is NOT mounted here any more — it is
 * mounted once above this route group, in `(product)/layout.tsx`, because a
 * per-route instance unmounted on navigation and took the session with it (#249).
 * Nothing else of the shell is here — no `AccountIdentityProvider` (this page has
 * no handles) and no `AppGate` (there is nothing to gate; a visitor is the
 * expected arrival).
 */
export const metadata: Metadata = {
  title: 'Sign in · Seti',
  description: 'Sign in to Seti with your email. No password. We email you a code.',
};

export default async function SignInPage() {
  /*
   * The invite cookie, read HERE and nowhere else.
   *
   * A person who followed `seti.live/i/<handle>` carries a signed, httpOnly code
   * naming the account that invited them, and the one call it is for is the one that
   * establishes an account (#145). This page is that call's front door, so its SERVER
   * render is the only place the value is read: no script can see it, and the client
   * component receives it already in hand.
   *
   * `null` when there is none, which is the ordinary case and costs nothing: the
   * provider then sends no code at all.
   */
  const inviteCode = (await cookies()).get(INVITE_COOKIE)?.value ?? null;

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      {/* No padding and no centring here: the split owns its own gutters, and the
          ambient panel has to reach the viewport edge to have an edge at all. */}
      <main className="relative z-10 flex flex-1">
        {/* Privy is mounted once, above this route group, in `(product)/layout.tsx`,
            so the instance that signs a person in is the instance their claim
            signs with (#249). */}
        <SessionProvider inviteCode={inviteCode}>
          <SignInScreen />
        </SessionProvider>
      </main>
    </div>
  );
}
