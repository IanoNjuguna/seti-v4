'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ASSET_DECIMALS, PRIMARY_ASSET, type SupportedAsset } from '@/lib/chain';
import { useAppNetwork } from '@/components/app/useAppNetwork';
import { buildTokenSelector } from '@/components/token-selector/token-selector.model';
import { useSession } from '@/lib/auth';
import {
  ApiError,
  previewSend,
  recordSend,
  resolveHandle,
  refusalMessage,
  type HandleIdentity,
  type SendPreview,
} from '@/lib/api';
import { classifyPaymentError } from '@/lib/pay/classify-payment-error';
import { coveringSendAsset } from '@/lib/pay/covering-asset';
import { COVERAGE_REFUSAL, pinAsset } from '@/lib/pay/quote-asset';
import { resolvedAsset } from '@/lib/pay/resolved-asset';
import { signSend } from '@/lib/pay/sign-transfer';
import { looksLikeAddress, validateAmount, validateRecipient } from '@/lib/pay/validate-transfer';
import { quoteArrived } from '@/lib/feedback';
import { useEmbeddedWallet } from '@/hooks/useEmbeddedWallet';
import { useSpendAssetRows } from '@/hooks/useSpendAssetRows';
import { useTempoSender } from '@/hooks/useTempoSender';
import type { ResolvedRecipient, SendPanelState, UseSendPanelReturn } from './SendPanel.types';

/**
 * How many decimals an amount field may carry.
 *
 * Every supported asset is 6dp and the asset itself is not known until the quote
 * answers, so the field is validated against the primary asset's precision — the
 * same 6 either way. The figure that gets SIGNED comes from the preview, never
 * from this constant.
 */
const AMOUNT_DECIMALS = ASSET_DECIMALS[PRIMARY_ASSET];

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
  asset: null,
  resolution: null,
  preview: null,
  coverOffer: null,
  recipientError: null,
  amountError: null,
  formError: null,
  formErrorCode: null,
  sent: null,
};

/** The server's machine-readable cause, when it sent one. Null for anything else. */
function codeOf(error: unknown): string | null {
  return error instanceof ApiError ? (error.code ?? null) : null;
}

function toErrorMessage(error: unknown, fallback: string): string {
  // An `ApiError` is mapped from its code to our own copy; anything else (a wallet
  // SDK error, a TypeError) falls back to the caller's line for this step rather
  // than showing a vendor's phrasing — see `lib/api/refusal.ts`.
  if (error instanceof ApiError) return refusalMessage(error, 'send');
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
 * 5. **Which token pays is the customer's to choose (#232).** `asset` is a PIN: absent
 *    until they pick a balance, then carried on the debounced quote, on the one that
 *    is signed, and on the re-quote after an expired price — so the amount priced,
 *    the fee line and the recorded asset are all for the token they picked. A pin
 *    that cannot cover is refused by the server (#223) before any signature, never
 *    quietly swapped, and then one more question is asked with no pin so the refusal
 *    can offer the balance that CAN pay. This is the same rule the pay flow follows,
 *    through the same components and the same helpers.
 *
 * `initialRecipient` is how `seti.live/u/<handle>`'s Send action lands with the
 * person already chosen (`/app/send?to=<handle>`): it is the same string a typed
 * handle would be, handed to the same resolver.
 */
export function useSendPanel(initialRecipient = ''): UseSendPanelReturn {
  const [state, setState] = useState<SendPanelState>({ ...INITIAL, recipient: initialRecipient });
  /**
   * The account whose balances can pay. Read here rather than handed in, because
   * this hook is only ever mounted behind `SendPanel`'s session gate and the balance
   * rows below are the same read home drew a screen ago.
   */
  const session = useSession();
  const userId = session.user?.id ?? null;
  /**
   * The network the ACCOUNT is acting on — the chain this send will be signed on.
   * Read here (a hook can read it, a plain module cannot) and handed to `signSend`,
   * which resolves the chain id and the token contract from it.
   */
  const { network: appNetwork } = useAppNetwork();

  /**
   * Whether a quote has already landed in this flow, so the arrival pulse fires once
   * rather than on every re-price. A ref, not state: it must not cause a render, and
   * it is reset only where the figure is cleared.
   */
  const quoted = useRef(false);
  /** The balances the selector draws: one read, from the account's own home payload. */
  const spendRows = useSpendAssetRows(userId ?? undefined);
  const { address, status } = useEmbeddedWallet();
  const { sendTempoTransaction } = useTempoSender();

  const patch = useCallback(
    (partial: Partial<SendPanelState>) => setState((prev) => ({ ...prev, ...partial })),
    []
  );

  // Editing a field clears that field's error, so a message cannot outlive the
  // value it was about — or be read as a comment on what the user just typed.
  const setRecipient = useCallback(
    (recipient: string) =>
      patch({ recipient, recipientError: null, formError: null, formErrorCode: null, coverOffer: null }),
    [patch]
  );
  const setAmountKes = useCallback(
    (amountFiat: string) =>
      patch({ amountFiat, amountError: null, formError: null, formErrorCode: null, coverOffer: null }),
    [patch]
  );

  /**
   * Which balance pays (#232).
   *
   * The price is DROPPED rather than kept: the fee is charged in the spent token, so
   * the figures for the previous one are figures for a transfer nobody is about to
   * sign. Clearing it puts the fee line back into its pricing shape, which makes the
   * change read as repricing rather than as a jump — and the quote that lands is
   * pinned to the token just chosen.
   *
   * The refusal and its offer clear with it: both were about the balance the
   * customer is no longer spending from.
   */
  const setAsset = useCallback(
    (asset: string | null) => {
      patch({
        // The label comes from a balance row, so it is guarded the same way a quote's
        // own answer is: an asset this build has no contract for must fail loudly
        // here rather than be pinned and signed.
        asset: asset === null ? null : resolvedAsset(asset),
        preview: null,
        recipientError: null,
        amountError: null,
        formError: null,
        formErrorCode: null,
        coverOffer: null,
      });
    },
    [patch]
  );

  /**
   * Which single token COULD cover this send, asked of the server after a refusal.
   *
   * Only ever called for a PINNED quote that was refused: an unpinned refusal is the
   * money being spread, and there is no token to offer. See `coveringSendAsset` — the
   * unpinned quote is the server's own answer to "which one, then".
   */
  const offerFor = useCallback(
    async (
      pinned: SupportedAsset | null,
      amountFiat: string,
      recipient: string
    ): Promise<SupportedAsset | null> => {
      if (!pinned) return null;
      const alternative = await coveringSendAsset({ amountFiat, recipient });
      return alternative !== null && alternative !== pinned ? alternative : null;
    },
    []
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
   *
   * The quote carries the customer's pin (#232), so the figure on screen is the price
   * of the token they chose. Unpinned, it carries nothing and the server picks the row
   * that covers — which is what the selector then reads as its own answer.
   */
  useEffect(() => {
    const amount = state.amountFiat;
    if (!state.recipient.trim() || !amount) return;
    if (!validateAmount(amount, AMOUNT_DECIMALS).ok) return;

    // The quote is for the ADDRESS, whether it was typed or resolved from a
    // username. A username that has not resolved yet quotes nothing.
    const { address: destination } = destinationFor(state.recipient, address, resolved);
    if (!destination) return;

    /** The customer's own token choice, captured with the send it was made for. */
    const pinned = state.asset;
    let active = true;

    const timer = setTimeout(() => {
      previewSend({ amountFiat: amount, recipient: destination, ...pinAsset(pinned) })
        .then(({ preview }) => {
          if (!active) return;
          // The quote landing is the moment the figure stops moving and becomes what
          // the customer is agreeing to; a pulse marks it. Only on arrival, never on
          // a refresh — a buzz per keystroke would be noise.
          if (!quoted.current) {
            quoted.current = true;
            quoteArrived();
          }
          patch({ preview, formError: null, formErrorCode: null, coverOffer: null });
        })
        .catch((error: unknown) => {
          if (!active) return;
          // A failed quote clears the figure, so the next one that lands is an
          // arrival again and may pulse.
          quoted.current = false;
          patch({
            preview: null,
            formError: toErrorMessage(error, 'Could not price this send.'),
            formErrorCode: codeOf(error),
            coverOffer: null,
          });

          /**
           * #223's refusal, made actionable (#232): the pinned balance is short and
           * the money exists elsewhere, so ask the server which ONE token covers it.
           * It refuses again when nothing does, and then there is no offer to make.
           */
          if (codeOf(error) !== COVERAGE_REFUSAL) return;
          void offerFor(pinned, amount, destination).then((alternative) => {
            if (active) patch({ coverOffer: alternative });
          });
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state.recipient, state.amountFiat, state.asset, address, resolved, patch, offerFor]);

  const submit = useCallback(() => {
    const value = validateAmount(state.amountFiat, AMOUNT_DECIMALS);
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
    /**
     * The name this recipient was found by, when they were found by one.
     *
     * `appliedTo` is the same guard the form uses to apply a resolution: it answers
     * only when the resolution belongs to what is currently typed, so a name from a
     * previous lookup can never be written onto this transfer's row. An address-only
     * send declares nothing, and the row then offers no "pay them again" — which is
     * correct, because an address cannot be resolved back to a name (#119).
     */
    const payee = appliedTo(state.recipient, state.resolution);
    /** The customer's token choice, captured before anything is awaited (#232). */
    const pinned = state.asset;

    void (async () => {
      patch({
        step: 'previewing',
        recipientError: null,
        amountError: null,
        formError: null,
        formErrorCode: null,
        coverOffer: null,
      });

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
        // Fresh, authoritative quote — the displayed one may be seconds old, and it
        // is pinned to the balance the customer chose, exactly like the display.
        ({ preview } = await previewSend({ amountFiat, recipient, ...pinAsset(pinned) }));
        patch({ preview });
      } catch (error) {
        patch({
          step: 'idle',
          preview: null,
          formError: toErrorMessage(error, 'Could not price this send. Try again.'),
          formErrorCode: codeOf(error),
        });

        /**
         * The refusal the customer can act on (#232): the balance they picked is short
         * while another covers. The offer is the server's own answer to the same
         * question asked without a pin, and it is what the selector draws beside
         * #223's sentence. Nothing is signed on this path — the throw above is where
         * it stopped.
         */
        if (codeOf(error) === COVERAGE_REFUSAL) {
          patch({ coverOffer: await offerFor(pinned, amountFiat, recipient) });
        }
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
        const { txHash } = await signSend({
          preview,
          // The asset THIS quote priced — the customer's pin when they made one, the
          // row the server chose when they did not. Both legs (principal and fee) ride
          // in it, so the whole batch is one token.
          asset: resolvedAsset(preview.asset),
          sendTempoTransaction,
          network: appNetwork,
        });

        patch({ step: 'recording', sent: null });

        const record = (quoteId: string) =>
          recordSend({
            amount: preview.amount,
            asset: resolvedAsset(preview.asset),
            recipient: preview.recipient,
            recipientHandle: payee?.handle,
            txHash,
            walletAddress: address,
            quoteId,
          });

        try {
          await record(preview.quoteId);
        } catch (error) {
          // The quote aged out between the preview and the record. Re-quote once.
          if (error instanceof ApiError && error.code === 'quote-expired') {
            // The same pin as the figure that was signed: a re-quote in a different
            // token would be a different transfer (#232).
            const { preview: fresh } = await previewSend({
              amountFiat,
              recipient,
              ...pinAsset(pinned),
            });
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
            // The receipt names what left the wallet, so it reads the same quote
            // the transfer was signed with. The server's total, never a sum done
            // here: principal + fee + gas is the quote's claim, not this file's.
            totalFiat: preview.totalFiat,
            networkFeeFiat: preview.networkFeeFiat,
            gasEstimated: preview.networkFeeSource === 'estimate',
            fiatCurrency: preview.fiatCurrency,
            recipient: preview.recipient,
          },
        });
      } catch (error) {
        const { message } = classifyPaymentError(error);
        patch({
          step: 'idle',
          formError: message.replace('{ASSET}', ASSET_LABEL),
          formErrorCode: codeOf(error),
        });
      }
    })();
  }, [
    state.recipient,
    state.amountFiat,
    state.asset,
    state.resolution,
    address,
    resolved,
    sendTempoTransaction,
    appNetwork,
    patch,
    offerFor,
  ]);

  const reset = useCallback(() => setState(INITIAL), []);

  const amountIsQuotable =
    state.recipient !== '' && state.amountFiat !== '' && validateAmount(state.amountFiat, AMOUNT_DECIMALS).ok;

  /**
   * The selector's whole state, derived: the balances, the token the quote named,
   * the customer's pin, and #223's refusal when the pin is short while another
   * balance covers. The same derivation the pay step uses, so the two flows cannot
   * answer "which token" differently.
   */
  const tokenSelector = buildTokenSelector({
    rows: spendRows.rows,
    currency: spendRows.currency,
    loading: spendRows.loading,
    unavailable: spendRows.unavailable,
    priced: state.preview?.asset ?? null,
    pinned: state.asset,
    offer: state.coverOffer,
  });

  return {
    ...state,
    resolved,
    walletStatus: status,
    isBusy: state.step !== 'idle',
    previewLoading: amountIsQuotable && !state.preview,
    tokenSelector,
    setRecipient,
    setAmountKes,
    setAsset,
    submit,
    reset,
  };
}
