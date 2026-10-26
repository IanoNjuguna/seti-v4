import type { HandleKind } from '@/lib/api';
import type { HandleClaimSignature } from '@/lib/pay/sign-handle-claim.types';
import type { EmbeddedWalletStatus } from './useEmbeddedWallet.types';

/** What a claim signs: the name as typed, and the kind that decides its purpose. */
export interface SignHandleClaimInput {
  kind: HandleKind;
  name: string;
}

export interface SignHandleClaimValue {
  /**
   * Whether anything on this device can sign.
   *
   * Exposed because the surface that asks for the signature has to know WHEN NOT
   * TO ASK: an option that cannot complete is a control that lies, and a person who
   * taps it learns nothing except that the app is broken.
   *
   * This is `status` for the SENTENCES — `loading` is a moment, `missing` is a dead
   * end — and {@link canSign} is the guard. They are separate answers: `status` is
   * `ready` for an address that came from the account, whose key may be on another
   * device, so gating the signature on `ready` offered a tap that could not finish
   * (#233).
   */
  status: EmbeddedWalletStatus;
  /**
   * Whether this device holds a key it can sign with right now.
   *
   * The claim's pre-signature guard reads THIS, never `status`. Read by
   * `useMerchantClaim.claim` before the wallet is touched, and by the intent step
   * through `useOnboarding`, so an option is never offered on a device where the tap
   * would fail.
   */
  canSign: boolean;
  /** Sign the claim's typed data with the embedded wallet, or throw. */
  sign: (input: SignHandleClaimInput) => Promise<HandleClaimSignature>;
}
