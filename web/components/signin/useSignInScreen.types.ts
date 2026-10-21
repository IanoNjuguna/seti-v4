import type { SignInStage } from './SignInScreen.types';

/**
 * The sign-in page's state, as its components read it.
 *
 * `accepted` is the consent gate and it is the page's, not a session flag: sign-in
 * here CREATES the account, so the terms are accepted before the request that can
 * create one, and the version displayed is carried into both calls. Signing in
 * cannot be started without it — the button is disabled, and the handler refuses.
 *
 * `verifying` is the page's OWN flag, not a session status: the session has no
 * "checking the code" state (it stays `sent` while the code is consumed), so the
 * pending affordance on the code button is driven from the promise the page was
 * handed. `sending` is the session's, because mailing a new code really is a
 * `sending` attempt.
 */
export interface UseSignInScreenReturn {
  stage: SignInStage;
  address: string;
  code: string;
  error: string | null;
  /** The consent gate. False on every visit until the person ticks the box. */
  accepted: boolean;
  /** A code is being mailed (or re-mailed). */
  sending: boolean;
  /** The submitted code is being checked. */
  verifying: boolean;
  /** True only on the `dev` source, and only once there is an address to echo. */
  previewAvailable: boolean;
  onAddressChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onAcceptChange: (accepted: boolean) => void;
  onSubmitAddress: (event: React.FormEvent<HTMLFormElement>) => void;
  onSubmitCode: (event: React.FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
  onUseAnotherAddress: () => void;
  onPreviewSent: () => void;
}
