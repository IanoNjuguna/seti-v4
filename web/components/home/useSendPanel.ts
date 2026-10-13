'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ASSET_DECIMALS, type SupportedAsset } from '@/lib/chain';
import { ApiError, previewSend, recordSend, type SendPreview } from '@/lib/api';
import { classifyPaymentError } from '@/lib/pay/classify-payment-error';
import { signSend } from '@/lib/pay/sign-transfer';
import { validateAmount, validateRecipient } from '@/lib/pay/validate-transfer';
import { quoteArrived } from '@/lib/feedback';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import type { SendPanelState, UseSendPanelReturn } from './SendPanel.types';

/** Both assets are in v1 scope; pathUSD is the one the testnet credits and the
 * faucet mints, so it is the default here too (see `usePayMerchant`). */
const ASSET: SupportedAsset = 'pathusd';
/** A label, not a token name: the customer is sending dollars — which stablecoin
 * backs it is an implementation detail they should never have to reason about. */
const ASSET_LABEL = 'USD';

/** How long to wait after the last keystroke before quoting the fee. */
const PREVIEW_DEBOUNCE_MS = 400;

const INITIAL: SendPanelState = {
  step: 'idle',
  recipient: '',
  amountFiat: '',
  preview: null,
  recipientError: null,
  amountError: null,
  formError: null,
  sent: null,
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * A send to a person: quote it, sign both legs, have the server verify them.
 *
 * The shape mirrors `usePayMerchant` deliberately, because a send is a payment
 * with a different payee:
 *
 * 1. **The fee is quoted BEFORE the customer commits**, on a debounce, so nobody
 *    signs a 2% charge they never saw. A fresh quote is fetched again inside
 *    `submit()` — the displayed one may be seconds old, and these are the figures
 *    that get signed and then reconciled against the chain.
 * 2. **The amounts come from the quote, never from the fields.** `preview.amount`
 *    is the principal leg and `preview.feeInAsset` is the fee leg; the client
 *    computes neither. Reading state after an `await` is the stale-closure bug
 *    that underpaid every merchant on the pay path.
 * 3. **Nothing is written until the chain agrees.** `recordSend` re-reads both
 *    legs from the receipt and refuses if either is missing, so the row in
 *    Activity is evidence rather than a claim.
 */
export function useSendPanel(): UseSendPanelReturn {
  const [state, setState] = useState(INITIAL);

  /**
   * Whether a quote has already landed in this flow, so the arrival pulse fires once
   * rather than on every re-price. A ref, not state: it must not cause a render, and
   * it is reset only where the figure is cleared.
   */
  const quoted = useRef(false);
  const { address, status } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();

  const patch = useCallback(
    (partial: Partial<SendPanelState>) => setState((prev) => ({ ...prev, ...partial })),
    []
  );

  // Editing a field clears that field's error, so a message cannot outlive the
  // value it was about — or be read as a comment on what the user just typed.
  const setRecipient = useCallback(
    (recipient: string) => patch({ recipient, recipientError: null, formError: null }),
    [patch]
  );
  const setAmountKes = useCallback(
    (amountFiat: string) => patch({ amountFiat, amountError: null, formError: null }),
    [patch]
  );

  /**
   * Quote the fee while the recipient and amount are being typed.
   *
   * The 400ms timer is also what keeps this from firing a request per keystroke;
   * `active` stops a slow response writing to state after either field changed
   * again. State is written only in the timer's callbacks, never in the effect
   * body — `react-hooks/set-state-in-effect` is an error in this package, and it
   * is right: a synchronous setState here cascades a render.
   */
  useEffect(() => {
    const amount = state.amountFiat;
    if (!state.recipient || !amount) return;
    if (validateRecipient(state.recipient, address).ok === false) return;
    if (!validateAmount(amount, ASSET_DECIMALS[ASSET]).ok) return;

    const recipient = state.recipient;
    let active = true;

    const timer = setTimeout(() => {
      previewSend({ amountFiat: amount, asset: ASSET, recipient })
        .then(({ preview }) => {
          if (!active) return;
          // The quote landing is the moment the figure stops moving and becomes what
          // the customer is agreeing to; a pulse marks it. Only on arrival, never on
          // a refresh — a buzz per keystroke would be noise.
          if (!quoted.current) {
            quoted.current = true;
            quoteArrived();
          }
          patch({ preview, formError: null });
        })
        .catch((error: unknown) => {
          if (!active) return;
          // A failed quote clears the figure, so the next one that lands is an
          // arrival again and may pulse.
          quoted.current = false;
          patch({ preview: null, formError: toErrorMessage(error, 'Could not price this send.') });
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state.recipient, state.amountFiat, address, patch]);

  const submit = useCallback(() => {
    const to = validateRecipient(state.recipient, address);
    const value = validateAmount(state.amountFiat, ASSET_DECIMALS[ASSET]);

    if (!to.ok || !value.ok) {
      patch({
        recipientError: to.ok ? null : to.error,
        amountError: value.ok ? null : value.error,
      });
      return;
    }

    const recipient = to.address;
    const amountFiat = state.amountFiat;

    void (async () => {
      patch({ step: 'previewing', recipientError: null, amountError: null, formError: null });

      let preview: SendPreview;
      try {
        // Fresh, authoritative quote — the displayed one may be seconds old.
        ({ preview } = await previewSend({ amountFiat, asset: ASSET, recipient }));
        patch({ preview });
      } catch (error) {
        patch({
          step: 'idle',
          preview: null,
          formError: toErrorMessage(error, 'Could not price this send. Try again.'),
        });
        return;
      }

      if (!preview.hasEnoughBalance) {
        patch({
          step: 'idle',
          formError: `Not enough ${ASSET_LABEL} to cover this send and its fee.`,
        });
        return;
      }

      try {
        patch({ step: 'signing' });
        // One Tempo transaction, two calls: principal to the recipient, fee to
        // the treasury. Atomic, so the fee cannot go missing.
        const { txHash } = await signSend({ preview, asset: ASSET, sendTempoTransaction });

        patch({ step: 'recording', sent: null });

        /**
         * Record the signed transfer with the quoteId of the figure that was
         * signed. The server writes every fiat figure from the rate inside that
         * token — not from a freshly-read live rate — so the number the customer
         * was shown is the number recorded. A read does not consume the quote, so
         * the retry below is safe.
         */
        const record = (quoteId: string) =>
          recordSend({
            // Mode-dependent, and getting it backwards fails loudly rather than
            // quietly: `recordSend` verifies the RECIPIENT leg against this figure
            // and the fee leg against the treasury, so the principal is what it
            // asks for — not the gross.
            amount: preview.amount,
            asset: ASSET,
            recipient: preview.recipient,
            txHash,
            quoteId,
          });

        try {
          await record(preview.quoteId);
        } catch (error) {
          // The quote aged out between the preview and the record. Re-quote once.
          if (error instanceof ApiError && error.code === 'quote-expired') {
            const { preview: fresh } = await previewSend({ amountFiat, asset: ASSET, recipient });
            patch({ preview: fresh });

            if (fresh.totalFiat !== preview.totalFiat) {
              // The figure moved. Never record a number the customer never saw:
              // show the new one and let them confirm again. The signed transfer
              // already moved the old figure on-chain; the ledger must not be
              // written at a different one.
              patch({
                step: 'idle',
                formError:
                  `The rate changed while you were confirming. This send now totals ` +
                  `${fresh.fiatCurrency} ${fresh.totalFiat}. Review it before sending again.`,
              });
              return;
            }

            // Same figure: the frozen promise holds. Retry with the fresh token.
            await record(fresh.quoteId);
          } else {
            throw error;
          }
        }

        patch({
          step: 'idle',
          sent: {
            txHash,
            amountFiat: preview.fiatAmount,
            feeFiat: preview.feeFiat,
            fiatCurrency: preview.fiatCurrency,
            recipient: preview.recipient,
          },
        });
      } catch (error) {
        const { message } = classifyPaymentError(error);
        patch({ step: 'idle', formError: message.replace('{ASSET}', ASSET_LABEL) });
      }
    })();
  }, [state.recipient, state.amountFiat, address, sendTempoTransaction, patch]);

  const reset = useCallback(() => setState(INITIAL), []);

  const amountIsQuotable =
    state.recipient !== '' && state.amountFiat !== '' && validateAmount(state.amountFiat, ASSET_DECIMALS[ASSET]).ok;

  return {
    ...state,
    walletStatus: status,
    isBusy: state.step !== 'idle',
    previewLoading: amountIsQuotable && !state.preview,
    setRecipient,
    setAmountKes,
    submit,
    reset,
  };
}
