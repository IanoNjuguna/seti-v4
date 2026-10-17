'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  previewPayment,
  recordPayment,
  resolveHandle,
  refusalMessage,
  type PaymentPreview,
  type RefusalContext,
  type SupportedAsset,
} from '@/lib/api';
import { classifyPaymentError } from '@/lib/pay/classify-payment-error';
import { signPayment } from '@/lib/pay/sign-payment';
import { ASSET_DECIMALS } from '@/lib/chain';
import { quoteArrived } from '@/lib/feedback';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import type { PayState, UsePayMerchantReturn } from './usePayMerchant.types';

/**
 * The asset the server resolved for a quote.
 *
 * The client no longer chooses one. A customer whose money arrived as USDT0 has a
 * zero OUSD balance, so signing OUSD regardless refused a payment they could
 * afford — the bug a bridged deposit exposed. The server picks from what they
 * hold (`pickSpendAsset`) and this reads its answer, so the principal leg, the fee
 * leg and the recorded label are all the same token.
 *
 * The cast is guarded rather than asserted: an unrecognised label means this build
 * and the backend disagree about the asset set, which must fail loudly instead of
 * signing a transfer against a contract this build has no address for.
 */
function resolvedAsset(value: string): SupportedAsset {
  if (!(value in ASSET_DECIMALS)) {
    throw new Error(
      `The quote named an asset this build does not support (${value}). ` +
        'Update the app before paying.'
    );
  }
  return value as SupportedAsset;
}
/** Human-facing label only. Users are paying in dollars — the token behind it is
 * an implementation detail they should never have to reason about. */
const ASSET_LABEL = 'USD';

/** How long to wait after the last keystroke before quoting the fee. */
const PREVIEW_DEBOUNCE_MS = 400;

const INITIAL: PayState = {
  step: 'idle',
  merchant: null,
  amount: '',
  preview: null,
  txHash: null,
  error: null,
  errorKind: null,
};

/**
 * The sentence for a failed step.
 *
 * An `ApiError` always wins, because its CODE says more than any generic line —
 * and its `message` is already our own copy. Anything else (a wallet SDK error, a
 * TypeError) falls back to the caller's line for this step rather than surfacing a
 * vendor's phrasing to a customer.
 */
function toErrorMessage(
  error: unknown,
  fallback: string,
  context: RefusalContext = 'payment'
): string {
  if (error instanceof ApiError) return refusalMessage(error, context);
  return fallback;
}

/**
 * Ported from `mobile/src/hooks/usePayMerchant.ts`, with three deliberate
 * differences.
 *
 * 1. **The fee is quoted BEFORE the customer commits.** Mobile fetches the
 *    preview inside `pay()`, so the customer taps Pay and only then learns what
 *    the fee is. That is the wrong way round for a fee the customer funds, so
 *    this hook also quotes on a debounce as the amount is typed. The `pay()` path
 *    still fetches its own fresh preview — the debounced one is display-only.
 * 2. **Nothing is read from captured state after an `await`.** Mobile's version
 *    read `state.preview` after awaiting, which is the previous render's value;
 *    on a first payment that is `null`, and the fallback sent the *principal*
 *    instead of the gross, underpaying the merchant on every payment. Every
 *    figure below comes from a local variable or the fresh response.
 * 3. **An `initialPayload` is resolved on mount.** This is how a public page's
 *    Pay action (`/app/pay?handle=<handle>`) lands with the merchant already
 *    chosen: the value is the same string a pasted code would be, handed to the
 *    same `resolveHandle` the manual entry uses.
 */
export function usePayMerchant(userId?: string, initialPayload?: string): UsePayMerchantReturn {
  const [state, setState] = useState<PayState>(INITIAL);

  /** See useSendPanel: the arrival pulse fires once per flow, on the first quote. */
  const quoted = useRef(false);
  const { getSigningWallet } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();
  /**
   * The network the ACCOUNT is acting on — the chain this payment is signed on.
   * Read here (a hook can read it, a plain module cannot) and handed to
   * `signPayment`, which resolves the chain id and the token contract from it.
   */
  const { network } = useAppNetwork();

  const setPartial = useCallback((partial: Partial<PayState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const setAmount = useCallback(
    (amount: string) => {
      setPartial({ amount, error: null, errorKind: null });
    },
    [setPartial]
  );

  /**
   * Quote the fee while the amount is being typed.
   *
   * The 400ms timer is also what keeps this from firing a request per keystroke;
   * `active` stops a slow response writing to state after the merchant or amount
   * changed again. State is written only in the timer's callbacks, never in the
   * effect body — `react-hooks/set-state-in-effect` is an error in this package
   * and it is right: a synchronous setState here cascades a render.
   */
  useEffect(() => {
    if (!userId || !state.merchant || !state.merchant.merchantId || !state.amount) return;
    if (!Number.isFinite(Number(state.amount)) || Number(state.amount) <= 0) return;

    const merchant = state.merchant;
    const merchantId = merchant.merchantId as string;
    const amount = state.amount;
    let active = true;

    const timer = setTimeout(() => {
      previewPayment({ userId, amountFiat: amount, merchantId })
        .then(({ preview }) => {
          if (!active) return;
          // The arrival pulse, same moment as the send panel: the figure has landed
          // and this is what the customer is about to approve. Once per flow.
          if (!quoted.current) {
            quoted.current = true;
            quoteArrived();
          }
          setPartial({ preview, error: null, errorKind: null });
        })
        .catch((error: unknown) => {
          if (!active) return;
          // The figure is cleared, so the next quote that lands is an arrival again.
          quoted.current = false;
          setPartial({
            preview: null,
            error: toErrorMessage(error, 'Could not price this payment. Try again.'),
            errorKind: 'unknown',
          });
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [userId, state.merchant, state.amount, setPartial]);

  const resolve = useCallback(
    async (qrPayload: string) => {
      setPartial({ step: 'resolving', error: null, errorKind: null, preview: null, merchant: null, txHash: null });
      try {
        const { handle, suggestedAmount } = await resolveHandle(qrPayload);
        setPartial({ merchant: handle, amount: suggestedAmount ?? '', step: 'idle' });
      } catch (error) {
        // Merchant resolution is not a payment, so it keeps the generic message;
        // only the payment path classifies causes.
        setPartial({
          step: 'error',
          error: toErrorMessage(error, 'Could not resolve that code. Try again.'),
          errorKind: 'unknown',
        });
      }
    },
    [setPartial]
  );

  /**
   * Resolve a merchant handed in by the URL — the public `seti.live/m/<handle>`
   * page's Pay action sends `/app/pay?handle=<handle>`.
   *
   * Guarded on `userId` because `/merchants/resolve` needs a token: a signed-out
   * visitor sees the sign-in card, and the `userId` arriving after sign-in
   * re-runs this. State is written only in the promise callbacks —
   * `react-hooks/set-state-in-effect` is an error in this package, and the
   * `resolve` callback cannot be reused here precisely because it sets state
   * synchronously at its start.
   */
  useEffect(() => {
    if (!userId || !initialPayload) return;

    let active = true;

    resolveHandle(initialPayload)
      .then(({ handle, suggestedAmount }) => {
        if (!active) return;
        setPartial({ merchant: handle, amount: suggestedAmount ?? '', step: 'idle' });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPartial({
          step: 'error',
          error: toErrorMessage(error, 'Could not resolve that code. Try again.', 'lookup'),
          errorKind: 'unknown',
        });
      });

    return () => {
      active = false;
    };
  }, [userId, initialPayload, setPartial]);

  const pay = useCallback(async () => {
    const { merchant, amount } = state;

    if (!userId) {
      setPartial({ step: 'error', error: 'You must be signed in to make a payment.', errorKind: 'unknown' });
      return;
    }
    if (!merchant) {
      setPartial({ step: 'error', error: 'Enter a merchant name first.', errorKind: 'unknown' });
      return;
    }
    if (!amount || Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
      setPartial({ step: 'error', error: 'Enter a valid amount.', errorKind: 'unknown' });
      return;
    }
    if (!merchant.merchantId) {
      // A person's handle has an address but no business profile; there is
      // nothing here to price as a merchant payment. Send to it instead.
      setPartial({
        step: 'error',
        error: 'That is a person\u2019s handle, not a merchant \u2014 send to it from Send.',
        errorKind: 'unknown',
      });
      return;
    }
    if (!merchant.address) {
      setPartial({ step: 'error', error: 'This merchant cannot receive payments yet.', errorKind: 'unknown' });
      return;
    }

    const merchantId = merchant.merchantId;

    setPartial({ step: 'previewing', error: null, errorKind: null });

    let preview: PaymentPreview;
    try {
      // Fresh, authoritative quote. The displayed one may be seconds old, and
      // these figures are what gets signed and then reconciled against the chain.
      ({ preview } = await previewPayment({
        userId,
        amountFiat: amount,
        merchantId,
      }));
      setPartial({ preview });
    } catch (error) {
      setPartial({
        step: 'error',
        error: toErrorMessage(error, 'Could not price this payment. Try again.'),
        errorKind: 'unknown',
      });
      return;
    }

    if (!preview.hasEnoughBalance) {
      setPartial({
        step: 'error',
        error: `Not enough ${ASSET_LABEL} to cover this payment.`,
        errorKind: 'insufficient-funds',
      });
      return;
    }

    try {
      setPartial({ step: 'signing' });
      // The wallet is resolved here, not passed in: it only exists once the
      // embedded wallet does, and asking for it is what surfaces "sign in first".
      const { provider, address } = await getSigningWallet();
      // Resolved ONCE, from the fresh preview, and used for both the signature
      // and the record: the fee leg rides in the same asset as the principal.
      const asset = resolvedAsset(preview.asset);

      const { txHash } = await signPayment({
        preview,
        merchant,
        asset,
        provider,
        // In `batch` mode the payment is signed as ONE Tempo transaction with two
        // calls — the principal leg and the fee leg — through the Privy Tempo
        // hook, because an EIP-1193 provider cannot carry `calls`.
        sendTempoTransaction,
        from: address,
        // The ACCOUNT's network, not the deployment's: this is the chain the
        // signature is for and the chain the token contract is read from.
        network,
      });

      setPartial({ step: 'recording', txHash });

      /**
       * Record the signed payment with the quoteId of the figure that was signed.
       * The server writes every fiat figure from that frozen rate; the token is
       * not consumed by a read, so the retry below is safe.
       */
      const record = (quoteId: string) =>
        recordPayment({
          userId,
          // Mode-dependent, and getting it backwards fails loudly rather than
          // quietly: in `batch` the backend reconciles the RECIPIENT leg against
          // this figure, which is the principal; in `inside-transfer` the single
          // leg to the recipient IS the gross — principal + fee, with no gas figure
          // in it, because gas is not transferred to anyone.
          amount: preview.feeRoutingMode === 'batch' ? preview.amount : preview.grossAsset,
          asset,
          merchantId,
          txHash,
          description: `Payment to ${merchant.name}`,
          // The wallet that just signed. The backend checks it belongs to the
          // account AND that the chain recorded it as this transaction's sender,
          // then binds the row to it — so this is which of the account's embedded
          // wallets the payment is attributed to.
          walletAddress: address,
          quoteId,
        });

      try {
        await record(preview.quoteId);
      } catch (error) {
        // The quote aged out between the preview and the record. Re-quote once.
        if (error instanceof ApiError && error.code === 'quote-expired') {
          const { preview: fresh } = await previewPayment({
            userId,
            amountFiat: amount,
            merchantId,
          });
          setPartial({ preview: fresh });

          if (fresh.totalFiat !== preview.totalFiat) {
            // The figure moved. Never record a number the customer never saw:
            // show the new one and let them confirm again. The signed transfer
            // already moved the old figure on-chain; the ledger must not be
            // written at a different one.
            setPartial({
              step: 'error',
              error:
                `The rate changed while you were confirming. This payment now totals ` +
                `${fresh.fiatCurrency} ${fresh.totalFiat}. Review it before paying again.`,
              errorKind: 'unknown',
            });
            return;
          }

          // Same figure: the frozen promise holds. Retry with the fresh token.
          await record(fresh.quoteId);
        } else {
          throw error;
        }
      }

      setPartial({ step: 'done' });
    } catch (error) {
      const { kind, message } = classifyPaymentError(error);
      setPartial({
        step: kind === 'insufficient-gas' ? 'insufficient-gas' : 'error',
        // {ASSET} is substituted with the asset actually being spent, so the
        // message names a token the customer recognises.
        error: message.replace('{ASSET}', ASSET_LABEL),
        errorKind: kind,
      });
    }
  }, [state, userId, setPartial, getSigningWallet, sendTempoTransaction, network]);

  const reset = useCallback(() => setState(INITIAL), []);

  const amountIsPayable =
    Boolean(state.merchant) && state.amount !== '' && Number(state.amount) > 0;
  const previewLoading =
    Boolean(userId) && amountIsPayable && !state.preview && state.step === 'idle';
  const isBusy =
    state.step !== 'idle' &&
    state.step !== 'error' &&
    state.step !== 'insufficient-gas' &&
    state.step !== 'done';

  return { ...state, setAmount, resolve, pay, reset, previewLoading, isBusy };
}
