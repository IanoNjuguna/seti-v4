import Link from 'next/link';
import { Text } from '@/components/ui';
import { SIGN_IN_PATH } from '@/lib/routes';
import { RAIL_IDENTITY_COPY } from './RailIdentity.constants';
import type { RailIdentitySignedOutProps } from './RailIdentitySignedOut.types';

/**
 * The identity card with nobody in it — the rail's sign-in affordance.
 *
 * Signed out, the card says what is missing rather than who you are, and offers
 * exactly ONE control: a link to the page that signs people in. That is a
 * deliberate correction. This card used to render `SignInPrompt`, which hands
 * over to the FULL `SignInCard` on any Privy-configured build — and a full sign-in
 * page (title, sentence, terms checkbox, email button) inside the rail's ~200px
 * column wrapped one word per line and duplicated the sign-in page at the same
 * time.
 *
 * The link goes to `/signin` (`SIGN_IN_PATH`), the product's front door: the full
 * sign-in surface belongs on a page that has room for it, with the terms control
 * and the email step on it, not inside the app's own chrome — a bank does not put
 * its front door inside a room. The rail states the fact and points there.
 *
 * The one-line form is also why the body sentence is gone: at this width a
 * paragraph is not a shorter paragraph, it is a column of single words.
 *
 * `restoring` gets the shared "one moment" line instead: the app is still finding
 * out whether anyone is signed in, and telling a signed-in customer to sign in —
 * even for a frame — is the one thing this card must not do.
 */

export function RailIdentitySignedOut({ view }: RailIdentitySignedOutProps) {
  return (
    <div className="mt-auto shrink-0 border-t border-hairline-dark px-4 pb-4 pt-4">
      {view === 'restoring' ? (
        /**
         * A bar, not the sentence. The card is chrome and chrome should not talk:
         * the same words were already printed twice inside the page, and a visitor
         * reads the rail's bottom edge as an object rather than a status line.
         *
         * The box is the link's own line box: `micro` is `text-body-sm` (14px at
         * 1.43), so the signed-out card's paragraph is 20px tall. Drawing this at
         * `h-4` would have moved the rail's bottom edge by 4px the moment the link
         * arrived, which is the jump this change exists to remove.
         */
        <div aria-hidden className="flex h-5 items-center">
          <span className="block h-3 w-24 rounded-sm bg-hairline-dark" />
        </div>
      ) : (
        <Text variant="micro" as="p" color="inverse-muted">
          <Link href={SIGN_IN_PATH} className="underline underline-offset-4">
            {RAIL_IDENTITY_COPY.signedOutTitle}
          </Link>
        </Text>
      )}
    </div>
  );
}
