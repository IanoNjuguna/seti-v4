'use client';

import { StateMessage } from '@/components/ui';
import { SIGN_IN_CARD_COPY } from './SignInCard.constants';
import { SignInPrompt } from './SignInPrompt';

export interface SignInCardProps {
  /**
   * Why the last restore or sign-in attempt failed, when it did. Never a gate: the
   * session still resolves to `anonymous`, which this card already knows how to
   * render.
   */
  error: string | null;
}

/**
 * The app's signed-out state for a surface that is a page of its own.
 *
 * It makes the same ask the compact `SignInPrompt` makes — what signing in is for,
 * and one link to `/signin` — with the app's own standard words, plus the reason a
 * restore or a previous attempt failed when there is one.
 *
 * ## It no longer renders a sign-in flow, and that is the point
 *
 * This card used to own the terms checkbox, the Privy modal button and the dev-mode
 * shortcut, which made an app page a second front door. Worse, a modal-started
 * sign-in cannot carry the Terms version the page displayed, so the account it
 * created recorded no acceptance — the `acceptedVersion: null` this work exists to
 * remove. The acceptance has to be taken where the terms are shown, so this points
 * at the one page that shows them and starts nothing itself.
 */
export function SignInCard({ error }: SignInCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <SignInPrompt title={SIGN_IN_CARD_COPY.title} body={SIGN_IN_CARD_COPY.body} />

      {error ? (
        <StateMessage variant="failure" title={SIGN_IN_CARD_COPY.errorTitle} body={error} />
      ) : null}
    </div>
  );
}
