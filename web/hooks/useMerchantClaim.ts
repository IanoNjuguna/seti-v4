'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { claimHandle } from '@/lib/api/handles';
import { fetchHandleStatus } from '@/lib/api/handles';
import { merchantHandle } from '@/lib/merchant-link';
import { signHandleClaim } from '@/lib/pay/sign-handle-claim';
import { useEmbeddedWallet } from './useEmbeddedWallet';
import type {
  MerchantClaimState,
  UseMerchantClaimReturn,
} from './useMerchantClaim.types';
import type { HandleKind, HandleStatusPreview } from '@/lib/api';

const INITIAL: MerchantClaimState = {
  step: 'idle',
  kind: 'business',
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
 * Claim a handle with the embedded wallet — a username or a business name.
 *
 * Two steps that must not be collapsed: the wallet signs the typed data, then
 * the SIGNED MESSAGE AND SIGNATURE are sent to the backend, which verifies them.
 * The client never decides whether the claim is valid — it cannot, because it
 * does not hold the namespace — and the address the backend checks ownership
 * against is the one it recovers from the signature, not one this code sent.
 *
 * The signed message carries a `purpose` derived from `kind`, so a signature the
 * app makes to claim a username cannot be replayed by the server as a business
 * claim, and the reverse. That map lives in `sign-handle-claim.ts`.
 *
 * Nothing is read from captured state after an `await`: the name and kind are
 * taken into locals before the first await, so a re-render mid-flight cannot
 * change what is being signed.
 */
export function useMerchantClaim(initialKind: HandleKind = 'business'): UseMerchantClaimReturn {
  const [state, setState] = useState<MerchantClaimState>({ ...INITIAL, kind: initialKind });
  const [preview, setPreview] = useState<HandleStatusPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const { getSigningWallet } = useEmbeddedWallet();

  const setPartial = useCallback((partial: Partial<MerchantClaimState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const setKind = useCallback(
    (kind: HandleKind) => {
      setPartial({ kind, error: null, errorCode: null });
    },
    [setPartial]
  );

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
      fetchHandleStatus(name)
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

  const claim = useCallback(async (kindOverride?: HandleKind) => {
    const name = state.name.trim();
    // The override wins over the state's kind: onboarding chooses the intent on the
    // step that signs, and a state update would not have landed yet. The purpose
    // signed and the `kind` sent are both taken from THIS value, so they can never
    // disagree with each other.
    const kind = kindOverride ?? state.kind;

    if (!name) {
      setPartial({
        step: 'error',
        error: kind === 'person' ? 'Enter the username you want.' : 'Enter the business name you want to claim.',
        errorCode: 'invalid-handle-name',
      });
      return;
    }

    setPartial({ step: 'signing', claimed: null, error: null, errorCode: null });

    try {
      // The wallet only exists once the embedded wallet does; asking for it is
      // what surfaces "sign in first".
      const { provider, address } = await getSigningWallet();
      const { message, signature } = await signHandleClaim({ provider, address, kind, name });

      setPartial({ step: 'submitting' });
      const claimed = await claimHandle({ kind, ...message, signature });

      setPartial({ step: 'done', claimed });
    } catch (error) {
      const { message, code } = toError(error);
      setPartial({ step: 'error', error: message, errorCode: code });
    }
  }, [state.name, state.kind, getSigningWallet, setPartial]);

  const reset = useCallback(() => {
    setState({ ...INITIAL, kind: initialKind });
    setPreview(null);
  }, [initialKind]);

  // The handle shown must be the one the typed name yields, and the preview only
  // applies when it is about THAT handle — a stale preview for a name the person
  // has since changed is dropped rather than displayed.
  const handle = merchantHandle(state.name);
  const appliedPreview = preview && preview.handle === handle ? preview : null;
  const previewLoading = state.name.trim().length > 0 && appliedPreview === null && !previewFailed;

  return {
    ...state,
    setKind,
    setName,
    claim,
    reset,
    isBusy: state.step === 'signing' || state.step === 'submitting',
    handle,
    preview: appliedPreview,
    previewLoading,
  };
}
