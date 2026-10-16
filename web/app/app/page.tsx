'use client';

import { HomeScreen } from '@/components/home/HomeScreen';
import { HomeSignedOut } from '@/components/home/HomeSignedOut';
import { useSession } from '@/lib/auth';

/**
 * Home — `/app`, and the app's front door.
 *
 * The page's whole job is the ONE decision this demo rests on: is there an
 * account behind this screen? It is answered by the session hook's own `status`
 * — pinned to `restoring` / `anonymous` / `signed-in` — and the two answers are
 * two components: `HomeScreen` when the server confirmed an account, and
 * `HomeSignedOut` for everybody else, which renders the product's shape with one
 * sentence where each figure would be.
 *
 * The signed-in side owns the account-scoped read (`useHomeData`) and is not
 * rendered until the session confirms an account, so a visitor fires no request
 * for a dashboard they do not have. The branch is written as
 * `status !== 'signed-in'` so TypeScript narrows the view to the two states
 * `HomeSignedOut` can actually render — a `signed-in` screen can never render
 * "sign in to see your balance".
 */
export default function HomePage() {
  const session = useSession();

  if (session.status !== 'signed-in') {
    return <HomeSignedOut view={session.status} />;
  }

  return <HomeScreen />;
}
