'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { ApiError, refusalMessage } from '@/lib/api';
import {
  fetchSavings,
  quoteSavingsDeposit,
  quoteSavingsWithdraw,
  recordSavingsDeposit,
  recordSavingsWithdrawal,
  type SavingsDepositQuote,
  type SavingsSummary,
  type SavingsWithdrawQuote,
} from '@/lib/api/savings';
import { buildDepositCalls, buildWithdrawCalls } from '@/lib/pay/build-savings';
import { buildTempoTransaction } from '@/lib/pay/build-transfer';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import type { SaveMode, SaveStatus, UseSaveReturn } from './useSave.types';

const QUOTE_DEBOUNCE_MS = 400;

function message(error: unknown): string {
  if (error instanceof ApiError) return refusalMessage(error, 'account');
  return 'Could not complete that. Nothing was moved.';
}

/**
 * The Save screen's state, in both directions.
 *
 * `add` and `withdraw` are the same shape — an amount, a quote, one press — so they
 * share the amount field and differ only in which calls get signed. Keeping them in
 * one hook is what stops the two flows drifting: a deposit that re-quotes at signing
 * time and a withdrawal that does not would be a bug waiting to be found in
 * production, and it could not happen here.
 *
 * Every money figure comes from the server. The only arithmetic is choosing a figure.
 */
export function useSave(): UseSaveReturn {
  const { network } = useAppNetwork();
  const { getSigningWallet } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();

  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<SaveMode>(null);
  const [amountFiat, setAmountFiat] = useState('');
  const [depositQuote, setDepositQuote] = useState<SavingsDepositQuote | null>(null);
  const [withdrawQuote, setWithdrawQuote] = useState<SavingsWithdrawQuote | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ mode: 'add' | 'withdraw'; fiatAmount: string } | null>(null);

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

  /** Price the amount as it is typed, in whichever direction the sheet is in. */
  useEffect(() => {
    const amount = Number(amountFiat);
    if (!mode || !Number.isFinite(amount) || amount <= 0) return;

    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;

      const run =
        mode === 'add' ? quoteSavingsDeposit(amountFiat) : quoteSavingsWithdraw(amountFiat);

      run
        .then((next) => {
          if (!active) return;
          if (mode === 'add') setDepositQuote(next as SavingsDepositQuote);
          else setWithdrawQuote(next as SavingsWithdrawQuote);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (!active) return;
          setDepositQuote(null);
          setWithdrawQuote(null);
          setError(message(caught));
        });
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [amountFiat, mode]);

  const reset = useCallback(() => {
    setMode(null);
    setAmountFiat('');
    setDepositQuote(null);
    setWithdrawQuote(null);
    setError(null);
  }, []);

  const submit = useCallback(() => {
    if (status === 'submitting' || !mode) return;

    setStatus('submitting');
    setError(null);

    void (async () => {
      try {
        const wallet = await getSigningWallet();

        if (mode === 'add') {
          // Re-quote at signing time: the floors the chain enforces must be current.
          const fresh = await quoteSavingsDeposit(amountFiat);
          if (!fresh.hasEnoughBalance) {
            setError('That is more than your available balance.');
            setStatus('idle');
            return;
          }

          const calls = buildDepositCalls({
            amountIn: fresh.amountIn,
            depositAmount: fresh.swapOut,
            minSwapOut: fresh.minSwapOut,
            minShares: fresh.minShares,
            // The quote chose this from the balances, so the batch spends what the
            // customer actually holds; pathUSD needs no swap leg at all.
            assetIn: fresh.assetIn,
            recipient: wallet.address as Address,
            vault: fresh.vault as Address,
            network,
          });

          const txHash = await sendTempoTransaction(
            buildTempoTransaction({ asset: fresh.assetIn, calls, network })
          );

          await recordSavingsDeposit({
            txHash,
            assetIn: fresh.assetIn,
            amountIn: fresh.amountIn,
            depositAmount: fresh.swapOut,
            minShares: fresh.minShares,
            walletAddress: wallet.address,
            quoteId: fresh.quoteId,
          });

          setDone({ mode: 'add', fiatAmount: fresh.fiatAmount });
        } else {
          const fresh = await quoteSavingsWithdraw(amountFiat);

          if (!fresh.canWithdraw) {
            setError('This vault cannot pay out immediately right now.');
            setStatus('idle');
            return;
          }

          const calls = buildWithdrawCalls({
            shares: fresh.shares,
            minAssets: fresh.minAssets,
            minSwapOut: fresh.minSwapOut,
            recipient: wallet.address as Address,
            vault: fresh.vault as Address,
            shareToken: fresh.shareToken as Address,
            network,
          });

          const txHash = await sendTempoTransaction(
            buildTempoTransaction({ asset: 'pathusd', calls, network })
          );

          await recordSavingsWithdrawal({
            txHash,
            shares: fresh.shares,
            minSwapOut: fresh.minSwapOut,
            walletAddress: wallet.address,
            quoteId: fresh.quoteId,
          });

          setDone({ mode: 'withdraw', fiatAmount: fresh.fiatAmount });
        }

        reset();
        setStatus('idle');
        load();
      } catch (caught: unknown) {
        setError(message(caught));
        setStatus('idle');
      }
    })();
  }, [amountFiat, getSigningWallet, load, mode, network, reset, sendTempoTransaction, status]);

  const quote = mode === 'add' ? depositQuote : mode === 'withdraw' ? withdrawQuote : null;
  const ready =
    mode === 'add'
      ? depositQuote !== null && depositQuote.hasEnoughBalance
      : withdrawQuote !== null && withdrawQuote.canWithdraw;

  return {
    summary,
    loading,
    mode,
    amountFiat,
    quote,
    status,
    error,
    done,
    canSubmit: status !== 'submitting' && ready,
    setMode,
    setAmount: setAmountFiat,
    submit,
    reset,
    dismiss: () => setDone(null),
  };
}
