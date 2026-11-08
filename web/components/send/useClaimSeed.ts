'use client';

import { useEffect, useState } from 'react';
import { readAsk, type ClaimSeed } from '@/lib/api/requests';

/**
 * A claim link's payee and figure, read once (#465).
 *
 * The URL carries an opaque id and nothing else. This turns it into the two things the send flow
 * needs — who is paid and how much — by asking the server, which is what makes seeding an amount safe
 * (#99): the figure comes from a record the person being paid wrote down, never from the link.
 *
 * A link that does not resolve is treated as a link that carried nothing. That is deliberate: the
 * send screen still works, the customer still picks a payee, and a dead claim id does not become an
 * error page in front of somebody who just wanted to pay.
 */
export interface UseClaimSeedReturn {
  /** True while the id is being resolved; false for no id at all. */
  loading: boolean;
  seed: ClaimSeed | null;
}

export function useClaimSeed(claimId: string | null): UseClaimSeedReturn {
  const [seed, setSeed] = useState<ClaimSeed | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (claimId === null) return;

    let live = true;

    readAsk(claimId)
      .then(({ request }) => {
        if (!live) return;
        setSeed({
          publicId: request.publicId,
          amount: request.amount,
          destinationHandle: request.destinationHandle,
        });
        setAnswered(true);
      })
      .catch(() => {
        if (live) setAnswered(true);
      });

    return () => {
      live = false;
    };
  }, [claimId]);

  return { loading: claimId !== null && !answered, seed };
}
