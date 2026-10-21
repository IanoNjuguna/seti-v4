'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { ApiError, refusalMessage } from '@/lib/api';
import {
  fetchSavings,
  quoteSavingsDeposit,
  recordSavingsDeposit,
  type SavingsDepositQuote,
  type SavingsSummary,
} from '@/lib/api/savings';
import { buildDepositCalls } from '@/lib/pay/build-savings';
import { buildTempoTransaction } from '@/lib/pay/build-transfer';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import type { SaveStatus, UseSaveReturn } from './useSave.types';

const QUOTE_DEBOUNCE_MS = 400;

function message(error: unknown): string {
  if (error instanceof ApiError) return refusalMessage(error, 'account');
  return 'Could not complete that deposit. Nothing was moved.';
}

/**
 * The Save screen's state: the figures, the amount being typed, and the one commit.
 *
 * Cash App's shape in a hook: the saved figure is the page, `Add money` opens an
 * amount, and the amount is committed with one press. The spendable balance is read
 * again after a deposit, because "what is left" is the number the customer checks
 * next.
 *
 * Every money figure comes from the server — `savedFiat`, `spendableFiat`, the
 * quote's `swapOut` and `minShares`. The only arithmetic here is choosing which
 * figure to show.
 */
export function useSave(): UseSaveReturn {
  const { network } = useAppNetwork();
  const { getSigningWallet } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();

  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [amountFiat, setAmountFiat] = useState('');
  const [quote, setQuote] = useState<SavingsDepositQuote | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deposited, setDeposited] = useState<{ fiatAmount: string; shares: string } | null>(null);

  const load = useCallback(() => {
    fetchSavings()
      .then((next) => {
        setSummary(next);
        setError(null);
      })
      .catch(() => setError('Could not read your savings right now.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;

    fetchSavings()
      .then((next) => {
        if (active) setSummary(next);
      })
      .catch(() => {
        if (active) setError('Could not read your savings right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /** Price the amount as it is typed. Nothing is signed from this quote. */
  useEffect(() => {
    const amount = Number(amountFiat);
    if (!Number.isFinite(amount) || amount <= 0) return;

    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      quoteSavingsDeposit(amountFiat)
        .then((next) => {
          if (!active) return;
          setQuote(next);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (!active) return;
          setQuote(null);
          setError(message(caught));
        });
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [amountFiat]);

  const submit = useCallback(() => {
    if (status === 'submitting') return;

    setStatus('submitting');
    setError(null);

    void (async () => {
      try {
        // Re-quote at the moment of signing: the floors the chain enforces must come
        // from a price that is still true, not one that has been on screen.
        const fresh = await quoteSavingsDeposit(amountFiat);

        if (!fresh.hasEnoughBalance) {
          setError('That is more than your available balance.');
          setStatus('idle');
          return;
        }

        const wallet = await getSigningWallet();

        const calls = buildDepositCalls({
          amountIn: fresh.amountIn,
          depositAmount: fresh.swapOut,
          minSwapOut: fresh.minSwapOut,
          minShares: fresh.minShares,
          recipient: wallet.address as Address,
          vault: fresh.vault as Address,
          network,
        });

        const txHash = await sendTempoTransaction(
          // Gas in OUSD: it is the asset being spent, so it is the balance the
          // quote checked.
          buildTempoTransaction({ asset: 'ousd', calls, network })
        );

        await recordSavingsDeposit({
          txHash,
          amountIn: fresh.amountIn,
          depositAmount: fresh.swapOut,
          minShares: fresh.minShares,
          walletAddress: wallet.address,
          quoteId: fresh.quoteId,
        });

        setDeposited({ fiatAmount: fresh.fiatAmount, shares: fresh.minShares });
        setAmountFiat('');
        setQuote(null);
        setStatus('idle');
        load();
      } catch (caught: unknown) {
        setError(message(caught));
        setStatus('idle');
      }
    })();
  }, [amountFiat, getSigningWallet, load, network, sendTempoTransaction, status]);

  return {
    summary,
    loading,
    amountFiat,
    quote,
    status,
    error,
    deposited,
    canSubmit: status !== 'submitting' && quote !== null && quote.hasEnoughBalance,
    setAmount: setAmountFiat,
    submit,
    dismiss: () => setDeposited(null),
  };
}
