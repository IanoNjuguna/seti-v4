'use client';

import { useSearchParams } from 'next/navigation';
import { HomeSignedOut } from './HomeSignedOut';
import type { HomeSignedOutProps } from './HomeSignedOut.types';

/** The one value `?invite=` can carry that the page acts on. */
export const INVITE_QUERY_KEY = 'invite';
export const INVITE_NOT_LIVE = 'not-live';

/**
 * The visitor's home, with the one thing a query string can add: why they are here.
 *
 * `seti.live/i/<handle>` forwards to `/app`, and forwards to `/app?invite=not-live`
 * when the handle names nobody (an unknown name, a name parked for brand review, or
 * a name with no account behind it). The app then SAYS so, in one line, instead of
 * silently behaving as if the invitation worked — the failure mode that criterion
 * in #145 exists to prevent.
 *
 * The query is read in its own component rather than in the page because
 * `useSearchParams` needs a `Suspense` boundary above it; the page supplies one, and
 * this component is the only thing behind it. Nothing else on the page reads the
 * query, so nothing else re-renders on it.
 */
export function HomeSignedOutGate(props: HomeSignedOutProps) {
  const requested = useSearchParams().get(INVITE_QUERY_KEY);

  return <HomeSignedOut {...props} inviteNotLive={requested === INVITE_NOT_LIVE} />;
}
