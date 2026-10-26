import type { ReactNode } from 'react';
import { PrivyAppProvider } from '@/components/providers/PrivyAppProvider';

/**
 * The one Privy instance for the whole product.
 *
 * Sign-in and the app it signs into used to mount their own providers, one per
 * route, and that is the bug this layout exists to prevent (#249). Privy keeps its
 * session inside the SDK instance. Signing in happened in the sign-in page's
 * instance; the move to `/app/onboarding` unmounted it, and its teardown posted its
 * own refresh token to `POST /api/v1/sessions/logout`, revoking the session 200 ms
 * after creating it. The app layout's instance then booted with nothing: no `users/me`
 * call, an embedded-wallet iframe that says `iframe:ready` and never hears back,
 * `authenticated` false, no wallets. Our own token kept the app open, so the failure
 * surfaced as "no wallet on this device" and a name that could not be claimed.
 *
 * Both routes live under this group so the instance survives the navigation. Next
 * preserves a group layout across route changes inside it, which is exactly the
 * lifetime a session needs.
 *
 * ONLY the provider belongs here. `SessionProvider`, `AccountIdentityProvider`,
 * `AppGate` and the invite-cookie read each belong to the route that uses them: the
 * sign-in page reads that cookie because it is its only reader, and `AppGate` owns a
 * shell the onboarding wizard must not get. Hoisting them would widen the blast
 * radius of every future change to those trees for no gain.
 *
 * The group does not change URLs. `/signin` and `/app` are where they were, and the
 * marketing page stays outside the group so it still ships no SDK.
 */
export default function ProductLayout({ children }: { children: ReactNode }) {
  return <PrivyAppProvider>{children}</PrivyAppProvider>;
}
