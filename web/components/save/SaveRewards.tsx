'use client';

import { useEffect, useState } from 'react';
import { Button, Text } from '@/components/ui';
import { ApiError, fetchSavingsRewards, refusalMessage, type SavingsRewards } from '@/lib/api';
import { buildClaimCalls } from '@/lib/pay/build-savings';
import { buildTempoTransaction } from '@/lib/pay/build-transfer';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import type { Address } from 'viem';
import { SAVE_COPY } from './Save.constants';

/**
 * The campaign's rewards, and the one call that pays them.
 *
 * A separate component from the deposit flow on purpose: claiming is not saving, it moves
 * nothing out of the vault, and it exists only while Merkl funds the campaign (#322). When
 * there is nothing to claim this renders nothing at all — no empty card, no "0.00".
 *
 * The customer signs `claim`, so Seti needs no operator and never touches the reward.
 */
export function SaveRewards() {
  const { network } = useAppNetwork();
  const { getSigningWallet } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();

  const [rewards, setRewards] = useState<SavingsRewards | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSavingsRewards()
      .then((next) => {
        if (active) setRewards(next);
      })
      .catch(() => {
        // No rewards is a normal state and a failed read is not worth a warning on a
        // savings screen: the block simply does not appear.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!rewards?.claimable || !rewards.distributor) return null;

  const amount = (Number(rewards.claimableAmount) / 1_000_000).toFixed(2);
  const ends = rewards.campaignEnds;

  const claim = () => {
    if (busy) return;
    setBusy(true);
    setNote(null);

    void (async () => {
      try {
        const wallet = await getSigningWallet();
        // Re-read at signing time: proofs and the cumulative amount both move.
        const fresh = await fetchSavingsRewards();
        if (!fresh.claimable || !fresh.distributor) {
          setNote(fresh.reason ?? SAVE_COPY.rewardsClaimed);
          setRewards(fresh);
          setBusy(false);
          return;
        }

        const calls = buildClaimCalls({
          distributor: fresh.distributor as Address,
          user: wallet.address as Address,
          wrapper: fresh.wrapper as Address,
          amount: fresh.claimableAmount,
          proofs: fresh.proofs,
        });

        await sendTempoTransaction(buildTempoTransaction({ asset: 'ousd', calls, network }));
        setNote(SAVE_COPY.rewardsClaimed);
        setRewards({ ...fresh, claimable: false, claimableAmount: '0', proofs: [], reason: null });
      } catch (caught: unknown) {
        setNote(
          caught instanceof ApiError
            ? refusalMessage(caught, 'account')
            : 'We could not reach the rewards contract just now. Nothing was claimed.'
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="rounded-md border border-hairline-light bg-surface-soft px-5 py-4">
      <Text variant="micro" color="secondary" as="p">
        {SAVE_COPY.rewardsLabel}
      </Text>
      <Text variant="card-title" tabular as="p" className="mt-1">
        {amount} OUSD
      </Text>
      <Text variant="micro" color="secondary" as="p" className="mt-1">
        {SAVE_COPY.rewardsEnds} {ends}. Paid by the campaign, not by the vault.
      </Text>

      <Button type="button" fullWidth className="mt-3" onClick={claim} disabled={busy}>
        {SAVE_COPY.claimAction}
      </Button>

      {note ? (
        <Text variant="micro" color="secondary" as="p" className="mt-2">
          {note}
        </Text>
      ) : null}
    </div>
  );
}
