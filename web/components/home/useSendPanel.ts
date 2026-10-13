'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ASSET_DECIMALS, PRIMARY_ASSET, type SupportedAsset } from '@/lib/chain';
import {
  ApiError,
  previewSend,
  recordSend,
  resolveHandle,
  type HandleIdentity,
  type SendPreview,
} from '@/lib/api';
import { classifyPaymentError } from '@/lib/pay/classify-payment-error';
import { signSend } from '@/lib/pay/sign-transfer';
import { looksLikeAddress, validateAmount, validateRecipient } from '@/lib/pay/validate-transfer';
import { quoteArrived } from '@/lib/feedback';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useTempoSender } from '@/hooks/useTempoSender';
import type { ResolvedRecipient, SendPanelState, UseSendPanelReturn } from './SendPanel.types';

/** The asset the money path signs, from the ONE setting. OUSD is the decided money
 * path; `PRIMARY_ASSET` is read in `lib/chain` and consumed here rather than
 * repeated, so the app cannot sign one token while a label names another. */
const ASSET: SupportedAsset = PRIMARY_ASSET;
/** A label, not a token name: the customer is sending dollars — which stablecoin
 * backs it is an implementation detail they should never have to reason about. */
const ASSET_LABEL = 'USD';

/** How long to wait after the last keystroke before quoting the fee. */
const PREVIEW_DEBOUNCE_MS = 400;
/** How long to wait before asking the server who a handled recipient is. */
const RESOLVE_DEBOUNCE_MS = 350;

const INITIAL: SendPanelState = {
  step: 'idle',
  recipient: '',
  amountFiat: '',
  resolution: null,
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

/** The resolved identity, only when it is the one for what is currently typed. */
function appliedTo(recipient: string, resolved: ResolvedRecipient | null): HandleIdentity | null {
  return resolved && resolved.query === recipient.trim() ? resolved.identity : null;
}

/**
 * The address this send will actually sign, or the reason it cannot.
 *
 * THE WHOLE POINT of username sends: the recipient field may hold an address OR a
 * username. A typed address is validated and signed directly; a username is
 * resolved by the SERVER to a name AND an address, and it is the ADDRESS that is
 * signed — the username is only how the customer found it. This function is the
 * single place that decision is made, so a name can never silently become an
 * address without the resolution having produced the address the form displays.
 */
function destinationFor(
  recipient: string,
  selfAddress: string | null | undefined,
  resolved: HandleIdentity | null
): { address: string | null; error: string | null } {
  const value = recipient.trim();

  if (!value) {
    return { address: null, error: 'Enter the address or username you are sending to.' };
  }

  if (looksLikeAddress(value)) {
    const checked = validateRecipient(value, (selfAddress ?? undefined) as `0x${string}` | undefined);
    return checked.ok ? { address: checked.address, error: null } : { address: null, error: checked.error };
  }

  if (!resolved) {
    return { address: null, error: 'Could not find that username yet. Check the spelling, or paste an address.' };
  }

  if (!resolved.address) {
    return { address: null, error: `${resolved.name} has no address yet, so they cannot receive money.` };
  }

  if (selfAddress && resolved.address.toLowerCase() === selfAddress.toLowerCase()) {
    return {
      address: null,
      error: 'That is this account’s own handle. Nothing would move, and the network fee would still be spent.',
    };
  }

  return { address: resolved.address, error: null };
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
 *    computes neither.
 * 3. **Nothing is written until the chain agrees.** `recordSend` re-reads both
 *    legs from the receipt and refuses if either is missing, so the row in
 *    Activity is evidence rather than a claim.
 * 4. **A recipient may be a username.** It is resolved by the server to a name and
 *    an address, both are shown, and the ADDRESS is what is signed.
 *
 * `initialRecipient` is how `seti.live/u/<handle>`'s Send action lands with the
 * person already chosen (`/app/send?to=<handle>`): it is the same string a typed
 * handle would be, handed to the same resolver.
 */
export function useSendPanel(initialRecipient = ''): UseSendPanelReturn {
  const [state, setState] = useState<SendPanelState>({ ...INITIAL, recipient: initialRecipient });

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
   * Resolve a handled recipient to a NAME and an ADDRESS, before anything is signed.
   *
   * A typed `0x…` address needs no resolution and is left alone. Anything else is
   * sent to the server's ONE resolver, and the answer is stored WITH the string it
   * was asked about — so a slow response for a username the customer has since
   * edited is dropped rather than shown as a confident identity for the wrong
   * person. State is written only in the timer's callbacks.
   */
  useEffect(() => {
    const value = state.recipient.trim();
    if (!value || looksLikeAddress(value)) return;

    let active = true;

    const timer = setTimeout(() => {
      resolveHandle(value)
        .then(({ handle }) => {
          if (!active) return;
          patch({ resolution: { query: value, identity: handle }, formError: null });
        })
        .catch((error: unknown) => {
          if (!active) return;
          patch({
            resolution: null,
            formError: toErrorMessage(error, 'Could not find that username. Check the spelling.'),
          });
        });
    }, RESOLVE_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state.recipient, patch]);

  const resolved = appliedTo(state.recipient, state.resolution);

  /**
   * Quote the fee while the recipient and amount are being typed.
   *
   * The 400ms timer is also what keeps this from firing a request per keystroke;
   * `active` stops a slow response writing to state after either field changed
   * again. State is written only in the timer's callbacks, never in the effect
   * body — `react-hooks/set-state-in-effect` is an error in this package.
   */
  useEffect(() => {
    const amount = state.amountFiat;
    if (!state.recipient.trim() || !amount) return;
    if (!validateAmount(amount, ASSET_DECIMALS[ASSET]).ok) return;

    // The quote is for the ADDRESS, whether it was typed or resolved from a
    // username. A username that has not resolved yet quotes nothing.
    const { address: destination } = destinationFor(state.recipient, address, resolved);
    if (!destination) return;

    let active = true;

    const timer = setTimeout(() => {
      previewSend({ amountFiat: amount, asset: ASSET, recipient: destination })
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
  }, [state.recipient, state.amountFiat, address, resolved, patch]);

  const submit = useCallback(() => {
    const value = validateAmount(state.amountFiat, ASSET_DECIMALS[ASSET]);
    const destination = destinationFor(state.recipient, address, resolved);

    if (!destination.address || !value.ok) {
      patch({
        recipientError: destination.error,
        amountError: value.ok ? null : value.error,
      });
      return;
    }

    const recipient = destination.address;
    const amountFiat = state.amountFiat;

    void (async () => {
      patch({ step: 'previewing', recipientError: null, amountError: null, formError: null });

      // The wallet that will sign has to be known BEFORE anything is signed: its
      // address is what the server binds the recorded transfer to, and a record
      // call that cannot declare one is refused.
      if (!address) {
        patch({
          step: 'idle',
          formError: 'No wallet is available to sign with. Sign in again to send.',
        });
        return;
      }

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

        const record = (quoteId: string) =>
          recordSend({
            amount: preview.amount,
            asset: ASSET,
            recipient: preview.recipient,
            txHash,
            walletAddress: address,
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
              // The figure moved. Never record a number the customer never saw.
              patch({
                step: 'idle',
                formError:
                  `The rate changed while you were confirming. This send now totals ` +
                  `${fresh.fiatCurrency} ${fresh.totalFiat}. Review it before sending again.`,
              });
              return;
            }

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
  }, [state.recipient, state.amountFiat, address, resolved, sendTempoTransaction, patch]);

  const reset = useCallback(() => setState(INITIAL), []);

  const amountIsQuotable =
    state.recipient !== '' && state.amountFiat !== '' && validateAmount(state.amountFiat, ASSET_DECIMALS[ASSET]).ok;

  return {
    ...state,
    resolved,
    walletStatus: status,
    isBusy: state.step !== 'idle',
    previewLoading: amountIsQuotable && !state.preview,
    setRecipient,
    setAmountKes,
    submit,
    reset,
  };
}
