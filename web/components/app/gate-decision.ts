import type { GateInput, GatePlacement } from './AppGate.types';

/** Whether a path is the onboarding route (or something under it). */
export function isOnboardingRoute(pathname: string | null, onboardingPath: string): boolean {
  if (!pathname) return false;
  return pathname === onboardingPath || pathname.startsWith(`${onboardingPath}/`);
}

/**
 * The onboarding gate, as a pure decision.
 *
 * The rule the whole feature rests on: **the app surfaces are reachable only by an
 * account that holds a handle.** `onboarded` is the server's derived answer ("this
 * account has at least one handle"), never a flag the client maintains, so there is
 * no value here a modified client could set to let itself in.
 *
 * Four deliberate orderings:
 *
 *  1. **Loading comes first, both kinds.** While either the session or the handles
 *     are unknown the answer is `loading` — not `shell`. Rendering the shell
 *     optimistically would paint the app for one frame to an account that has no
 *     handle, which is exactly the half-onboarded state this forbids.
 *  2. **The onboarding route renders bare, always** — no nav rail, no tab bar, signed
 *     in or not. There is nothing in the app to navigate to until a handle exists,
 *     and advertising destinations the account cannot reach is worse than no chrome.
 *  3. **A signed-out visitor to any other route keeps the app shell.** They are not
 *     "half onboarded" — they are nobody yet, and each screen already answers for
 *     itself with its sign-in card. Sending them to onboarding would change what
 *     `/app` means for a first-time visitor.
 *  4. **A finished account at the onboarding route is NOT redirected away.** The last
 *     step of the wizard is where the claimed link and the printable QR are shown;
 *     bouncing out of it the instant the claim lands is how the person never sees the
 *     sticker they were promised. The wizard decides what to show — including an
 *     "already set up" state for an account that arrives there finished.
 */
export function decideGatePlacement(input: GateInput): GatePlacement {
  // A session RESTORE is not a reason to hold the paint. `restoring` and
  // `anonymous` are both unknowns the surfaces can state truthfully for
  // themselves in place ("One moment…" / "Sign in to see your balance"), and a
  // wallet or network fault that stalls the restore must never become a blank
  // app — that is the failure this gate produced in the wild (`Failed to
  // connect to MetaMask` on a page that had nothing to do with wallets).
  //
  // The ACCOUNT row is different, and stays a loader: by then the session is
  // known to be signed in, so a moment of empty balance would be read as no
  // money rather than as a page still arriving.
  if (input.identityLoading) return 'loading';

  if (input.onOnboardingRoute) return 'onboarding';

  if (input.authenticated && !input.onboarded) return 'redirect-to-onboarding';

  return 'shell';
}
