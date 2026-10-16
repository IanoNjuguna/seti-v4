'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { APP_HOME_PATH } from '@/components/app/AppGate.constants';

/**
 * Send a signed-in visitor into the app.
 *
 * This is what makes `/signin` safe as the landing page's entry point: a returning
 * customer who follows a `Log in` link does not have to be told they are already
 * signed in — the page hands them to the app.
 *
 * The reason it lives in a hook rather than in the page's render is that a
 * navigation is a side effect, and because `APP_HOME_PATH` is the app shell's own
 * constant: the front door reads where the app lives rather than typing `/app`
 * a second time.
 */
export function useSignedInRedirect(signedIn: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (signedIn) router.replace(APP_HOME_PATH);
  }, [signedIn, router]);
}
