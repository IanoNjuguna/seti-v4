import type { HandleIdentity, HandleKind, HandleStatusPreview } from '@/lib/api';
import type { EmbeddedWalletStatus } from './useEmbeddedWallet.types';

/**
 * Steps a claim moves through.
 *
 * `signing` and `submitting` are separate because they fail differently and the
 * person is told which one they are in: a wallet prompt that was dismissed is not
 * the same as a backend refusal, and conflating them sends people hunting for the
 * wrong problem.
 */
export type ClaimStep = 'idle' | 'signing' | 'submitting' | 'done' | 'error';

export interface MerchantClaimState {
  step: ClaimStep;
  /**
   * The profile mode the handle is claimed as. A merchant page claims
   * `business`; the same hook claims `person` for a username, with the signed
   * `purpose` derived from it.
   */
  kind: HandleKind;
  /** What the person typed — the un-normalised name. */
  name: string;
  /** The handle once the claim lands. */
  claimed: HandleIdentity | null;
  error: string | null;
  /** The backend's machine-readable refusal code, when it refused. */
  errorCode: string | null;
  /**
   * The server's correlation id for a refusal, when it sent one.
   *
   * Carried on the CLAIM state (not only on the `ApiError`) because the claim
   * form prints it: a refused claim shows the specific reason and the reference
   * that finds the log line for it. Null when the failure never reached the server
   * (a wallet prompt the person dismissed, an offline request).
   */
  errorRequestId: string | null;
}

export interface UseMerchantClaimReturn extends MerchantClaimState {
  setKind: (kind: HandleKind) => void;
  setName: (name: string) => void;
  /**
   * Sign and submit the claim.
   *
   * `kind` overrides the state's current kind, and exists because onboarding picks
   * the intent on the same step that signs: React state is not updated
   * synchronously, so a `setKind(...)` immediately followed by `claim()` would sign
   * for the PREVIOUS kind and the backend would (correctly) refuse it as a
   * purpose mismatch. Passing the kind makes the purpose signed explicit at the
   * call site rather than a race with a re-render.
   */
  claim: (kind?: HandleKind) => Promise<void>;
  reset: () => void;
  /** True while the wallet prompt or the request is in flight. */
  isBusy: boolean;
  /**
   * The handle the current name will get — the web's own `merchantHandle`, the
   * same string the backend stores. Recomputed on every keystroke, so the link
   * the person will print is visible before they sign.
   */
  handle: string;
  /**
   * The backend's verdict for THIS handle, or null when it does not apply yet.
   * Only ever the preview whose handle matches the one being shown — a preview
   * for a name the person has since changed is dropped rather than displayed.
   */
  preview: HandleStatusPreview | null;
  /** True while a preview for the current handle is in flight. */
  previewLoading: boolean;
  /**
   * Whether anything on this device can sign: `loading`, `ready` or `missing`.
   *
   * Read by the surfaces that ASK for a signature, so an option that cannot
   * complete is never offered. The claim itself refuses before signing when this is
   * not `ready`, which covers every caller including the ones that forgot to check.
   */
  walletStatus: EmbeddedWalletStatus;
}
