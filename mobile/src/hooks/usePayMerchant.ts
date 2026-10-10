import { useCallback, useState } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import {
  createWalletClient,
  custom,
  parseUnits,
  erc20Abi,
  type Address,
} from 'viem';
import {
  resolveMerchant,
  previewPayment,
  recordPayment,
  type PaymentPreview,
  type Merchant,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { buildFeeBatchCalls } from '@/lib/fee-batch';
import {
  tempoChain,
  getTokenContract,
  assetDecimals,
  type SupportedAsset,
} from '@/lib/chain';

type PayStep =
  | 'idle'
  | 'resolving'
  | 'previewing'
  | 'signing'
  | 'recording'
  | 'done'
  | 'error'
  | 'insufficient-gas';

/**
 * Why a payment failed, when the cause is actionable.
 *
 * Gas is paid in the same stablecoin the customer is spending (OUSD or pathUSD),
 * so the payment balance and the gas balance move together — but they are not
 * the same thing. A customer can hold 100 and still be unable to pay if the
 * network fee cannot be met from what is left after the transfer. Reporting that
 * as a generic failure makes a precondition look like a bug.
 */
type PayErrorKind = 'insufficient-gas' | 'insufficient-funds' | 'rejected' | 'unknown';

interface PayState {
  step: PayStep;
  merchant: Merchant | null;
  amount: string;
  preview: PaymentPreview | null;
  txHash: string | null;
  error: string | null;
  /** Machine-readable cause, so the UI can react without parsing copy. */
  errorKind: PayErrorKind | null;
}

interface UsePayMerchantReturn extends PayState {
  setAmount: (amount: string) => void;
  resolve: (qrPayload: string) => Promise<void>;
  pay: () => Promise<void>;
  reset: () => void;
}

/**
 * Classifies a payment failure so the UI can distinguish an actionable
 * precondition from a genuine fault.
 *
 * The gas case matters most: on Tempo the network fee is paid in the same
 * stablecoin being spent, so a wallet can hold enough for the payment and still
 * fail once the fee is deducted from what remains. Without this, that reads as
 * an unexplained error.
 *
 * Copy follows DESIGN.md's register — calm, direct, no exclamation marks.
 */
function classifyPaymentError(error: unknown): { kind: PayErrorKind; message: string } {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const text = raw.toLowerCase();

  // Node/wallet-level balance and fee failures. Matched before the generic
  // "insufficient funds" case because a missing fee balance is the more specific
  // and more actionable diagnosis.
  const gasMarkers = [
    'insufficient funds for gas',
    'insufficient gas',
    'gas required exceeds',
    'max fee per gas',
    'intrinsic gas too low',
    'could not satisfy max cost',
    'fee token',
  ];
  if (gasMarkers.some((m) => text.includes(m))) {
    return {
      kind: 'insufficient-gas',
      message: 'Not enough {ASSET} left to cover the network fee. Add a little, then try again.',
    };
  }

  if (text.includes('insufficient funds') || text.includes('exceeds balance')) {
    return {
      kind: 'insufficient-funds',
      message: 'Not enough {ASSET} to cover this payment.',
    };
  }

  // User declined in the wallet UI, or the wallet reported a rejection.
  if (
    text.includes('rejected') ||
    text.includes('denied') ||
    text.includes('user cancelled') ||
    text.includes('user canceled')
  ) {
    return { kind: 'rejected', message: 'Payment cancelled.' };
  }

  return {
    kind: 'unknown',
    message: error instanceof Error && error.message ? error.message : 'Payment failed. Please try again.',
  };
}

export function usePayMerchant(userId?: string): UsePayMerchantReturn {
  const { user } = useAuth();
  const effectiveUserId = userId ?? user?.id;

  const { wallets } = useEmbeddedEthereumWallet();

  const [state, setState] = useState<PayState>({
    step: 'idle',
    merchant: null,
    amount: '',
    preview: null,
    txHash: null,
    error: null,
    errorKind: null,
  });

  const setPartial = useCallback((partial: Partial<PayState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  /**
   * Records a payment failure, mapping the cause onto a distinct step so the UI
   * can present it differently and the copy can name the real fix.
   */
  const setPaymentError = useCallback(
    (error: unknown, assetLabel: string) => {
      const { kind, message } = classifyPaymentError(error);
      setState((prev) => ({
        ...prev,
        step: kind === 'insufficient-gas' ? 'insufficient-gas' : 'error',
        // {ASSET} is substituted with the asset actually being spent, so the
        // message names a token the customer recognises.
        error: message.replace('{ASSET}', assetLabel),
        errorKind: kind,
      }));
    },
    []
  );

  const setAmount = useCallback(
    (amount: string) => {
      setPartial({ amount, preview: null, error: null, errorKind: null });
    },
    [setPartial]
  );

  const resolve = useCallback(
    async (qrPayload: string) => {
      setPartial({ step: 'resolving', error: null, preview: null, merchant: null });
      try {
        const { merchant, suggestedAmount } = await resolveMerchant(qrPayload);
        setPartial({
          merchant,
          amount: suggestedAmount ?? '',
          step: 'idle',
        });
      } catch (error) {
        // Merchant resolution is not a payment, so it keeps the generic
        // message; only the payment path classifies causes.
        setPartial({
          step: 'error',
          error:
            error instanceof Error && error.message
              ? error.message
              : 'Could not resolve that code. Try again.',
          errorKind: 'unknown',
        });
      }
    },
    [setPartial]
  );

  const fetchPreview = useCallback(
    async (merchant: Merchant, amount: string, asset: SupportedAsset) => {
      if (!effectiveUserId) {
        throw new Error('You must be signed in to make a payment.');
      }
      const { preview } = await previewPayment({
        userId: effectiveUserId,
        // `amount` comes from a field labelled KES, so it goes over the wire as
        // KES. The server converts it to the asset and returns the gross to sign.
        amountKes: amount,
        asset,
        merchantId: merchant.id,
      });
      return preview;
    },
    [effectiveUserId]
  );

  const pay = useCallback(async () => {
    const { merchant, amount } = state;
    const asset: SupportedAsset = 'ousd';
    // Human-facing label for copy. DESIGN.md prefers naming the token the
    // customer recognises over an internal symbol.
    const assetLabel = 'OUSD';

    if (!effectiveUserId) {
      setPartial({ step: 'error', error: 'You must be signed in to make a payment.', errorKind: 'unknown' });
      return;
    }
    if (!merchant) {
      setPartial({ step: 'error', error: 'Scan or enter a merchant first', errorKind: 'unknown' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setPartial({ step: 'error', error: 'Enter a valid amount', errorKind: 'unknown' });
      return;
    }
    if (!merchant.payoutAddress) {
      setPartial({ step: 'error', error: 'Merchant cannot receive payments yet', errorKind: 'unknown' });
      return;
    }

    const wallet = wallets[0];
    if (!wallet) {
      setPartial({ step: 'error', error: 'No embedded wallet found', errorKind: 'unknown' });
      return;
    }

    setPartial({ step: 'previewing', error: null, errorKind: null });

    try {
      const preview = await fetchPreview(merchant, amount, asset);
      setPartial({ preview });

      if (!preview.hasEnoughBalance) {
        setPartial({
          step: 'error',
          error: `Not enough ${assetLabel} to cover this payment.`,
          errorKind: 'insufficient-funds',
        });
        return;
      }

      setPartial({ step: 'signing' });

      const provider = await wallet.getProvider();
      const walletClient = createWalletClient({
        chain: tempoChain,
        transport: custom(provider),
      });

      const contract = getTokenContract(asset);
      const decimals = assetDecimals[asset];

      // Use the preview fetched a moment ago, NOT `state.preview`.
      //
      // `state` is the closure captured when this callback was created, so
      // `state.preview` is whatever the PREVIOUS render held — it is null on
      // the first payment and stale on any subsequent one. Reading it here
      // silently sent the PRINCIPAL instead of the gross, so the merchant was
      // underpaid by the fee on every payment, and the backend then rejected
      // the payment as an amount mismatch against the chain.
      const grossAmount = preview.total;
      const value = parseUnits(grossAmount, decimals);

      const batchCalls =
        preview.feeRoutingMode === 'batch'
          ? buildFeeBatchCalls({
              tokenContract: contract as Address,
              merchantAddress: merchant.payoutAddress as Address,
              principalAmount: preview.amount,
              feeAmount: preview.feeInAsset,
              decimals,
            })
          : null;

      let txHash: string;

      if (batchCalls) {
        // Atomic batch: principal to the merchant, fee to the treasury.
        // `wallet_sendCalls` returns one hash for the whole batch, which is what
        // the backend reconciles against — it requires BOTH Transfer logs in
        // that single receipt.
        const accounts = (await provider.request({
          method: 'eth_requestAccounts',
        })) as string[];

        txHash = (await provider.request({
          method: 'wallet_sendCalls',
          params: [
            {
              from: accounts[0] as Address,
              chainId: `0x${tempoChain.id.toString(16)}`,
              calls: batchCalls,
            },
          ],
        } as never)) as string;
      } else {
        // `inside-transfer`: one transfer of the gross. The merchant receives
        // principal + fee, so Seti collects nothing on this path — it is the
        // historical behaviour and the default until batching is proven.
        txHash = await walletClient.writeContract({
          address: contract,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [merchant.payoutAddress as Address, value],
          account: wallet.address as Address,
        });
      }

      setPartial({ step: 'recording', txHash });

      await recordPayment({
        userId: effectiveUserId,
        // In `batch` mode the backend verifies the MERCHANT leg against this
        // figure, and the merchant leg is the principal — so send the
        // principal. Sending the gross here would be compared against the
        // principal on-chain and rejected as a mismatch.
        //
        // In `inside-transfer` mode the single merchant leg IS the gross, so
        // the gross is what the backend expects there.
        amount: batchCalls ? preview.amount : grossAmount,
        asset,
        merchantId: merchant.id,
        txHash,
        description: `Payment to ${merchant.name}`,
      });

      setPartial({ step: 'done' });
    } catch (error) {
      // Anything thrown here is a wallet/network failure rather than a
      // validation one, so it goes through the classifier. This is where an
      // insufficient-fee-balance surfaces as its own state.
      setPaymentError(error, assetLabel);
    }
  }, [state, wallets, effectiveUserId, fetchPreview, setPartial, setPaymentError]);

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      merchant: null,
      amount: '',
      preview: null,
      txHash: null,
      error: null,
      errorKind: null,
    });
  }, []);

  return {
    ...state,
    setAmount,
    resolve,
    pay,
    reset,
  };
}
