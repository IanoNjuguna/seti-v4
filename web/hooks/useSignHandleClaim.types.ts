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
   */
  status: EmbeddedWalletStatus;
  /** Sign the claim's typed data with the embedded wallet, or throw. */
  sign: (input: SignHandleClaimInput) => Promise<HandleClaimSignature>;
}
