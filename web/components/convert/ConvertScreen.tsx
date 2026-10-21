'use client';

import { useSession } from '@/lib/auth';
import { ConvertFlow } from './ConvertFlow';
import { ConvertSignedOut } from './ConvertSignedOut';

export interface ConvertScreenProps {
  /** Where Back lands. Home by default. */
  backHref?: string;
}

/**
 * `/app/convert`'s one decision: is there an account to convert with?
 *
 * Confirmed, `ConvertFlow` mounts and everything it needs — the balance, the
 * book's quote, the signing wallet — comes up with it. Otherwise the visitor gets
 * the page's shape and a sign-in prompt, and not one account-scoped request:
 * `ConvertFlow` is never rendered, so its hook never runs.
 *
 * The branch is `status !== 'signed-in'` so TypeScript narrows the view to the two
 * states `ConvertSignedOut` can render — a `signed-in` session cannot reach a
 * sign-in prompt by accident.
 */
export function ConvertScreen({ backHref }: ConvertScreenProps) {
  const session = useSession();

  if (session.status !== 'signed-in') {
    return (
      <ConvertSignedOut view={session.status === 'restoring' ? 'restoring' : 'signed-out'} />
    );
  }

  return <ConvertFlow backHref={backHref} />;
}
