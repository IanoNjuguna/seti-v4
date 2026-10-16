'use client';

import { SignOutButton } from '@/components/auth/SignOutButton';
import { CHAIN_NAME } from '@/lib/chain';
import { ProfileLegalSection } from './ProfileLegalSection';
import { ProfileModeSection } from './ProfileModeSection';
import { ProfileNetworkSection } from './ProfileNetworkSection';
import { useProfileIntent } from './useProfileIntent';
import { useProfileNetwork } from './useProfileNetwork';

/**
 * Profile for a confirmed account — the page's shape, as rows.
 *
 * Four rows on the canvas, in the order a person deals with them: which network the
 * account is on, how it uses Seti and what it is called, the documents, and the way
 * out. Every row is `ProfileSection`, so they share one left edge and one hairline
 * rhythm and none of them is a card.
 *
 * The two account-scoped reads live here rather than in the rows: the rows are views,
 * and this is the component that is rendered only once the session has confirmed an
 * account, so a visitor never fires a request for facts they do not have.
 *
 * The identity line is deliberately NOT here. The rail's identity card already states
 * who you are signed in as (`RAIL_IDENTITY_COPY.signedInAs` and the `@handle`), so a
 * second copy at the top of this page would be one fact said twice on one screen.
 *
 * The whole signed-out shape is the page's, not this component's: `ProfileSignedOut`
 * renders the same rows with one sentence where each fact would be.
 */
export function ProfileScreen() {
  const network = useProfileNetwork();
  const intent = useProfileIntent();

  return (
    <div className="flex flex-col gap-6">
      <ProfileNetworkSection
        network={network.network}
        value={CHAIN_NAME}
        depositAddress={network.depositAddress}
        error={network.error}
      />

      <ProfileModeSection
        intent={intent.intent}
        switching={intent.switching}
        handle={intent.handleFor(intent.intent)}
        error={intent.error}
        onSwitch={(mode) => void intent.switchTo(mode)}
      />

      <ProfileLegalSection />

      <div className="border-t border-hairline-light pt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
