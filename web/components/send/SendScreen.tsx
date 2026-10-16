'use client';

import { useSession } from '@/lib/auth';
import { SendFlow } from './SendFlow';
import { SendSignedOut } from './SendSignedOut';

export interface SendScreenProps {
  /** The recipient named by the URL, if the link that landed here carried one. */
  linked: string | null;
}

/**
 * `/app/send`'s one decision: is there an account to send with?
 *
 * Confirmed, the flow mounts (`SendFlow`) and everything it needs — the name
 * resolver, the fee preview, the signing wallet — comes up with it. Otherwise the
 * visitor gets `SendSignedOut`: the page's shape and a sign-in prompt, and not one
 * account-scoped request, because the components that would make them are never
 * rendered rather than rendered-and-guarded.
 *
 * The branch is `status !== 'signed-in'` so TypeScript narrows the view to the
 * two states `SendSignedOut` can render — `signed-in` cannot reach a sign-in
 * prompt by accident.
 */
export function SendScreen({ linked }: SendScreenProps) {
  const session = useSession();

  if (session.status !== 'signed-in') {
    return <SendSignedOut view={session.status} />;
  }

  return <SendFlow linked={linked} />;
}
