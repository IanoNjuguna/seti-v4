import type { FormEvent, ReactNode } from 'react';
import type { AuthSource, AuthStatus, SignInStatus } from '@/lib/auth';

/**
 * Which of the page's four surfaces is on screen.
 *
 * Four, not two. `restoring` and `signed-in` are real states the page draws (the
 * session resolves through them), and the two the person drives are `entry` —
 * the email field — and `sent` — collect the emailed code. Signing up and
 * signing in are the same action here (the account is created on first sign-in),
 * so there is no separate "sign up" stage.
 */
export type SignInStage = 'restoring' | 'entry' | 'sent' | 'signed-in';

/**
 * Everything the stage is decided from.
 *
 * `status` and `signInStatus` are the session's; the three flags are this page's
 * own memory of what the person has done, because the session deliberately
 * cannot answer "which screen is this person on" — a mailed code leaves the
 * session `anonymous`, and a rejected code leaves it `anonymous` too.
 */
export interface SignInStageInput {
  status: AuthStatus;
  signInStatus: SignInStatus;
  source: AuthSource;
  /** The person has moved past the address step (submitted a code, or re-sent). */
  pastFirstSend: boolean;
  /** Chosen "use a different email": the address step is what they want back. */
  dismissedSent: boolean;
  /** The dev-source preview of the sent screen. Never set on a Privy build. */
  previewSent: boolean;
}

export interface SignInPanelProps {
  children: ReactNode;
}

export interface SignInEntryFormProps {
  address: string;
  error: string | null;
  sending: boolean;
  /** The consent gate: the submit button is disabled until this is true. */
  accepted: boolean;
  previewAvailable: boolean;
  onAddressChange: (value: string) => void;
  onAcceptChange: (accepted: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPreviewSent: () => void;
}

export interface SignInSentPanelProps {
  address: string;
  code: string;
  error: string | null;
  /** A new code is being mailed (`resending`) versus the typed code being checked. */
  resending: boolean;
  /**
   * The submitted code is being checked. Distinct from `resending` because the
   * two waits are different waits on the same screen, and the button that is
   * actually in flight has to say so: without this the code button was dead for
   * the length of the verify request, which is a control that refuses silently.
   */
  verifying: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
  onUseAnotherAddress: () => void;
}

export interface SignInFailureProps {
  message: string;
}

export interface SignInTextButtonProps {
  children: ReactNode;
  onClick: () => void;
  /** Set while the action it names is already in flight, never for an empty field. */
  disabled?: boolean;
}

export interface SignInDevPreviewProps {
  onPreviewSent: () => void;
}
