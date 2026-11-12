'use client';

import type { ReactNode } from 'react';
import { SignInEntryForm } from './SignInEntryForm';
import { SignInHandoff } from './SignInHandoff';
import { SignInPanel } from './SignInPanel';
import { SignInSentPanel } from './SignInSentPanel';
import { SignInSkeleton } from './SignInSkeleton';
import { SIGN_IN_COPY, SIGN_IN_SENT_COPY } from './SignInScreen.constants';
import { useSignInScreen } from './useSignInScreen';
import { useSignedInRedirect } from './useSignedInRedirect';
import type { UseSignInScreenReturn } from './useSignInScreen.types';

/**
 * The sign-in page's surfaces, in one place.
 *
 * Everything below is a branch on `stage`; the logic behind it is `useSignInScreen`
 * and the rule that decides the stage is `sign-in-stage.ts`.
 *
 * `restoring` is not a screen a person drives — the session is still working out
 * whether anyone is signed in, so the page renders through it rather than blanking
 * and shares the app's one line for it.
 *
 * `signed-in` is not a screen at all, and it is rendered OUTSIDE the panel:
 * `SignInHandoff` takes the whole viewport, because the app is about to take it
 * and the front door's centred 384px column is the shape of a form, not of an
 * arrival.
 */
export function SignInScreen() {
  const screen = useSignInScreen();
  useSignedInRedirect(screen.stage === 'signed-in');

  if (screen.stage === 'signed-in') return <SignInHandoff />;

  /*
   * The heading is the panel's, and the STAGE supplies the sentence (#567). One title for both
   * stages would have to be the route's name — `Sign in` — which is the heading that was deleted
   * for saying nothing the field did not. The entry stage asks the question its field answers; the
   * code stage gives the instruction its six cells answer; the loading stage asks nothing.
   */
  const title =
    screen.stage === 'entry'
      ? SIGN_IN_COPY.pageTitle
      : screen.stage === 'sent'
        ? SIGN_IN_SENT_COPY.title
        : undefined;

  return (
    <SignInPanel title={title} showMark={screen.stage !== 'restoring'}>
      {body(screen)}
    </SignInPanel>
  );
}

/** A named function rather than a nested ternary in JSX, so the branches read. */
function body(screen: UseSignInScreenReturn): ReactNode {
  switch (screen.stage) {
    case 'entry':
      return (
        <SignInEntryForm
          address={screen.address}
          error={screen.error}
          sending={screen.sending}
          accepted={screen.accepted}
          previewAvailable={screen.previewAvailable}
          onAddressChange={screen.onAddressChange}
          onAcceptChange={screen.onAcceptChange}
          onSubmit={screen.onSubmitAddress}
          onPreviewSent={screen.onPreviewSent}
        />
      );
    case 'sent':
      return (
        <SignInSentPanel
          address={screen.address}
          code={screen.code}
          error={screen.error}
          resending={screen.sending}
          verifying={screen.verifying}
          onCodeChange={screen.onCodeChange}
          onCodeComplete={screen.onCodeComplete}
          onSubmit={screen.onSubmitCode}
          onResend={screen.onResend}
          onUseAnotherAddress={screen.onUseAnotherAddress}
        />
      );
    case 'restoring':
      // The page assembling itself, in the shape it will have: a lone sentence on a
      // black field reads as a broken page rather than a loading one.
      return <SignInSkeleton />;
    default:
      // `signed-in` is the handoff, rendered above rather than in the panel.
      return null;
  }
}
