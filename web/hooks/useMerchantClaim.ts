'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { claimMerchantName } from '@/lib/api/merchant-claim';
import { fetchMerchantHandle } from '@/lib/api/merchant-handle';
import { merchantHandle } from '@/lib/merchant-link';
import { signMerchantClaim } from '@/lib/pay/sign-merchant-claim';
import { useEmbeddedWallet } from './useEmbeddedWallet';
import type {
  MerchantClaimState,
  UseMerchantClaimReturn,
} from './useMerchantClaim.types';
import type { MerchantHandlePreview } from '@/lib/api/merchant-handle.types';

const INITIAL: MerchantClaimState = {
  step: 'idle',
  name: '',
  claimed: null,
  error: null,
  errorCode: null,
};

/** How long to wait after the last keystroke before asking about the handle. */
const HANDLE_PREVIEW_DEBOUNCE_MS = 350;

function toError(error: unknown): { message: string; code: string | null } {
  if (error instanceof ApiError) return { message: error.message, code: error.code ?? null };
  if (error instanceof Error && error.message) return { message: error.message, code: null };
  return { message: 'Could not claim that name. Try again.', code: null };
}

/**
 * Claim a business name with the embedded wallet.
 *
 * Two steps that must not be collapsed: the wallet signs the typed data, then
 * the SIGNED MESSAGE AND SIGNATURE are sent to the backend, which verifies them.
 * The client never decides whether the claim is valid — it cannot, because it
 * does not hold the registry — and the address the backend checks ownership
 * against is the one it recovers from the signature, not one this code sent.
 *
 * Nothing is read from captured state after an `await`: the name is taken into a
 * local before the first await, so a re-render mid-flight cannot change what is
 * being signed.
 *
 * The handle is previewed as the name is typed (see the effect), using the
 * backend's own rule so a link that is already taken is discovered while editing
 * the name rather than when a customer scans a printed sticker.
 */
export function useMerchantClaim(): UseMerchantClaimReturn {
  const [state, setState] = useState(INITIAL);
  const [preview, setPreview] = useState<MerchantHandlePreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const { getSigningWallet } = useEmbeddedWallet();

  const setPartial = useCallback((partial: Partial<MerchantClaimState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const setName = useCallback(
    (name: string) => {
      setPartial({ name, error: null, errorCode: null });
    },
    [setPartial]
  );

  /**
   * Preview the handle for the name being typed.
   *
   * The handle itself is derived locally and updates on every keystroke; the
   * "is it taken?" answer is the backend's, so it is debounced. State is written
   * only inside the timer's promise callbacks, never in the effect body —
   * `react-hooks/set-state-in-effect` is an error in this package, and a
   * synchronous setState here would cascade a render.
   */
  useEffect(() => {
    const name = state.name.trim();
    if (!name) return;

    let active = true;

    const timer = setTimeout(() => {
      fetchMerchantHandle(name)
        .then((status) => {
          if (!active) return;
          setPreview(status);
          setPreviewFailed(false);
        })
        .catch(() => {
          if (!active) return;
          setPreviewFailed(true);
        });
    }, HANDLE_PREVIEW_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state.name]);

  const claim = useCallback(async () => {
    const name = state.name.trim();

    if (!name) {
      setPartial({
        step: 'error',
        error: 'Enter the business name you want to claim.',
        errorCode: 'invalid-merchant-name',
      });
      return;
    }

    setPartial({ step: 'signing', claimed: null, error: null, errorCode: null });

    try {
      // The wallet only exists once the embedded wallet does; asking for it is
      // what surfaces "sign in first".
      const { provider, address } = await getSigningWallet();
      const { message, signature } = await signMerchantClaim({ provider, address, name });

      setPartial({ step: 'submitting' });
      const claimed = await claimMerchantName({ ...message, signature });

      setPartial({ step: 'done', claimed });
    } catch (error) {
      const { message, code } = toError(error);
      setPartial({ step: 'error', error: message, errorCode: code });
    }
  }, [state.name, getSigningWallet, setPartial]);

  const reset = useCallback(() => {
    setState(INITIAL);
    setPreview(null);
  }, []);

  // The handle shown must be the one the typed name yields, and the preview only
  // applies when it is about THAT handle — a stale preview for a name the person
  // has since changed is dropped rather than displayed.
  const handle = merchantHandle(state.name);
  const appliedPreview = preview && preview.handle === handle ? preview : null;
  const previewLoading = state.name.trim().length > 0 && appliedPreview === null && !previewFailed;

  return {
    ...state,
    setName,
    claim,
    reset,
    isBusy: state.step === 'signing' || state.step === 'submitting',
    handle,
    preview: appliedPreview,
    previewLoading,
  };
}
