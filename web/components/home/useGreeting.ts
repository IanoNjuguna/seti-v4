'use client';

import { useSyncExternalStore } from 'react';
import { AFTERNOON_END_HOUR, GREETING_ANON, MORNING_END_HOUR } from './greeting.constants';

export interface Greeting {
  /** `Good morning` / `Good afternoon` / `Good evening`. */
  timeOfDay: string;
  /** `@handle`, or `anon` while the account has no username. */
  name: string;
}

function subscribe(): () => void {
  // The value never changes after hydration, so there is nothing to subscribe to.
  return () => undefined;
}

function timeOfDayFor(hour: number): string {
  if (hour < MORNING_END_HOUR) return 'Good morning';
  if (hour < AFTERNOON_END_HOUR) return 'Good afternoon';
  return 'Good evening';
}

function getClientTimeOfDay(): string {
  return timeOfDayFor(new Date().getHours());
}

// Server snapshot: null, so the server HTML and the first client paint match.
function getServerTimeOfDay(): null {
  return null;
}

/**
 * The name the greeting calls you: `@handle` when a username exists, `anon` when
 * it does not. This function is the ONLY place that decision is made — feed a
 * username in here and the greeting names the account, everywhere.
 *
 * TODO(username): nothing can supply one yet, and that is a finding rather than
 * an oversight. Checked: `AuthUser` (`web/lib/auth/auth.types.ts`) carries
 * id/email/firstName/lastName/phone and no handle; `HomeDashboard`
 * (`web/lib/api/home.types.ts`) carries the balance, its currency, the month
 * delta and the transaction rows; the backend's `User` model
 * (`backend/prisma/schema.prisma`) has no username column; and no route reports
 * the signed-in account's own Seti handle (`backend/src/routes/merchants.ts`
 * resolves BY name, it does not tell a caller their own). So today every account
 * is greeted `anon` — the honest branch, not a fallback.
 *
 * The cheapest true source when it lands is the account's own claimed merchant
 * handle (`Merchant.handle` where `claimedByUserId = user.id`): put it on the
 * session or the dashboard payload, pass `session.user.username` from
 * `web/app/app/page.tsx` into `<HomeGreeting />`, and delete this note.
 */
export function greetingName(username?: string | null): string {
  const handle = username?.trim().replace(/^@/, '');
  return handle ? `@${handle}` : GREETING_ANON;
}

/**
 * "Good morning" / "Good afternoon" / "Good evening" with the name to call you,
 * resolved on the client.
 *
 * The mobile app computes this during render; a web app cannot. The server
 * would render with its own clock and the browser would hydrate with a
 * different one, producing a hydration mismatch for anyone in a different
 * timezone from the server — every user in Nairobi, against a UTC server.
 *
 * `useSyncExternalStore` is the purpose-built answer to "client-only value":
 * the server snapshot is null, the client snapshot is read after hydration, and
 * no state is set inside an effect (which this app's lint rules reject).
 */
export function useGreeting(username?: string | null): Greeting | null {
  const timeOfDay = useSyncExternalStore(subscribe, getClientTimeOfDay, getServerTimeOfDay);

  if (!timeOfDay) return null;

  return { timeOfDay, name: greetingName(username) };
}
