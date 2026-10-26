'use client';

import { useCallback, useState } from 'react';
import { ApiError, refusalMessage } from '@/lib/api';
import {
  CONVERT_AMOUNT_MAX,
  fetchConvertQuote,
  recordConvert,
  type ConvertQuote,
} from '@/lib/api/convert';
import { classifyPaymentError, type PayErrorKind } from '@/lib/pay/classify-payment-error';
import { buildSwapCall } from '@/lib/pay/build-swap';
import { buildTempoTransaction } from '@/lib/pay/build-transfer';
import { SWAP_COPY } from '@/lib/pay/convert-swap.constants';
import { resolvedAsset } from '@/lib/pay/resolved-asset';
import { parseUnits } from 'viem';
import { ASSET_DECIMALS } from '@/lib/chain';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import type { ConvertSwapState, UseConvertSwapReturn } from './useConvertSwap.types';

const INITIAL: ConvertSwapState = { step: 'idle', quote: null, txHash: null, error: null };

/**
 * How many times the write-up is retried while the receipt is not on the node yet.
 *
 * Three attempts two seconds apart: a Tempo block is well under a second, and the quote
 * the retry re-presents is valid for a minute. The alternative is telling a customer their
 * swap failed while it is mined and on chain, which is the worst sentence in a money app.
 */
const RECORD_ATTEMPTS = 3;
const RECORD_RETRY_MS = 2000;

/** The sentence for a wallet-side failure, keyed on the classifier's cause. */
function walletSentence(kind: PayErrorKind): string {
  switch (kind) {
    case 'rejected':
      return SWAP_COPY.cancelled;
    case 'insufficient-gas':
      return SWAP_COPY.insufficientGas;
    case 'insufficient-funds':
      return SWAP_COPY.insufficientFunds;
    default:
      return SWAP_COPY.failed;
  }
}

/** The sentence for a refused quote: the server's code, in our words. */
function quoteSentence(error: unknown): string {
  return error instanceof ApiError ? refusalMessage(error, 'payment') : SWAP_COPY.notPriced;
}

/**
 * Sign a swap through Privy's Tempo hook, then record it through the verified path.
 *
 * ## Why the Tempo hook and not a provider
 *
 * A swap is calldata to the DEX precompile, so in principle it could ride an EIP-1193
 * `eth_sendTransaction`. It does not: this app signs Tempo transactions through
 * `useSendTransaction` from `@privy-io/react-auth/tempo` (`useTempoSender`), which is
 * the only path proven to carry Tempo's envelope, and #216 is what a provider-based
 * signing path cost the claim the last time one was left in place. `check:convert-swap`
 * asserts that no `getEthereumProvider` and no `eth_signTypedData_v4` exists anywhere on
 * this path, by reading the sources.
 *
 * ## Why the quote is fetched again HERE
 *
 * Two reasons, and neither is caution. The quote id is a rate promise with a short TTL,
 * and the record path refuses an expired one AFTER the money moved. And the figures that
 * get signed must be the server's latest, not a render's captured state: `amountIn` and
 * `minAmountOut` come from the fresh quote, never from props.
 *
 * ## Why an expired record is not retried
 *
 * The payment path re-quotes and retries, because a payment's ledger figure is the
 * transfer's own. A convert's fiat figure is derived from the rate on the row, and
 * re-quoting after the swap is mined would write the ledger at a rate the customer was
 * never shown. So the failure is reported as what it is — money moved, the record did
 * not — with the hash, rather than papered over with a second rate.
 */
export function useConvertSwap(input: { onSwapped?: () => void } = {}): UseConvertSwapReturn {
  const [state, setState] = useState<ConvertSwapState>(INITIAL);
  const { getSigningWallet } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();
  const { network } = useAppNetwork();
  const { onSwapped } = input;

  const setPartial = useCallback((partial: Partial<ConvertSwapState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  const confirm = useCallback(
    async (shown: ConvertQuote) => {
      setPartial({ step: 'quoting', quote: shown, error: null, txHash: null });

      let fresh: ConvertQuote;
      try {
        fresh = await fetchConvertQuote({
          assetIn: shown.assetIn,
          assetOut: shown.assetOut,
          amountIn: CONVERT_AMOUNT_MAX,
        });
      } catch (error) {
        setPartial({ step: 'error', error: quoteSentence(error) });
        return;
      }

      // Re-quote, never quietly re-rate: a book that now pays less than the figure on
      // screen gets the customer's eyes on the new number before anything is signed.
      if (
        parseUnits(fresh.minAmountOut, ASSET_DECIMALS[resolvedAsset(fresh.assetOut)]) <
        parseUnits(shown.minAmountOut, ASSET_DECIMALS[resolvedAsset(shown.assetOut)])
      ) {
        setPartial({ step: 'idle', quote: fresh, error: SWAP_COPY.moved });
        return;
      }

      let txHash: string;
      let walletAddress: string;
      try {
        setPartial({ step: 'signing', quote: fresh });
        const { address } = await getSigningWallet();
        walletAddress = address;

        const assetIn = resolvedAsset(fresh.assetIn);
        const assetOut = resolvedAsset(fresh.assetOut);

        txHash = await sendTempoTransaction(
          buildTempoTransaction({
            // The fee token is the INPUT token: the quote was priced against a balance
            // that includes the gas this swap costs, which is what `max` deducted.
            asset: assetIn,
            calls: [
              buildSwapCall({
                assetIn,
                assetOut,
                amountIn: fresh.amountIn,
                minAmountOut: fresh.minAmountOut,
                network,
              }),
            ],
            network,
          })
        );

        setPartial({ step: 'recording', txHash });
      } catch (error) {
        // Nothing was signed, so nothing moved — and the sentence says so.
        const { kind } = classifyPaymentError(error);
        setPartial({ step: 'error', error: walletSentence(kind) });
        return;
      }

      try {
        // Both legs are verified off the receipt before a row may exist. The quote id
        // is the frozen rate; the figures are the ones that were signed.
        //
        // The receipt is read immediately after the broadcast, and a node that has not
        // indexed the transaction yet answers `receipt-unavailable` — which for THIS path
        // would read as "the swap failed" while the money is on chain. So the write-up is
        // retried a couple of times before that is believed: a quote is not consumed by a
        // read, and the promise it carries outlives a few seconds of block time.
        for (let attempt = 1; ; attempt += 1) {
          try {
            await recordConvert({
              assetIn: fresh.assetIn,
              assetOut: fresh.assetOut,
              amountIn: fresh.amountIn,
              minAmountOut: fresh.minAmountOut,
              txHash,
              walletAddress,
              quoteId: fresh.quoteId,
            });
            break;
          } catch (error) {
            const notYet =
              error instanceof ApiError && error.code === 'receipt-unavailable';
            if (!notYet || attempt >= RECORD_ATTEMPTS) throw error;
            await new Promise((resolve) => setTimeout(resolve, RECORD_RETRY_MS));
          }
        }
      } catch {
        setPartial({ step: 'error', txHash, error: SWAP_COPY.recordFailed });
        return;
      }

      setPartial({ step: 'done', quote: fresh, error: null, txHash });
      onSwapped?.();
    },
    [getSigningWallet, sendTempoTransaction, network, setPartial, onSwapped]
  );

  const busy =
    state.step === 'quoting' || state.step === 'signing' || state.step === 'recording';

  return { ...state, busy, confirm, reset };
}
