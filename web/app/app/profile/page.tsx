'use client';

import { SignInCard } from '@/components/auth/SignInCard';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { RAIL_IDENTITY_COPY } from '@/components/app/RailIdentity.constants';
import { useRailIdentity } from '@/components/app/useRailIdentity';
import { ProfileHandlePanel } from '@/components/profile/ProfileHandlePanel';
import { ProfileIntentSwitch } from '@/components/profile/ProfileIntentSwitch';
import { ProfileLegalCard } from '@/components/profile/ProfileLegalCard';
import { ProfileNetworkSwitch } from '@/components/profile/ProfileNetworkSwitch';
import { PROFILE_INTENT_COPY } from '@/components/profile/ProfileIntent.constants';
import { PROFILE_NETWORK_COPY } from '@/components/profile/ProfileNetwork.constants';
import { PROFILE_PAGE_COPY } from '@/components/profile/ProfilePage.constants';
import { useProfileIntent } from '@/components/profile/useProfileIntent';
import { useProfileNetwork } from '@/components/profile/useProfileNetwork';
import { Badge, Skeleton, StateMessage, Text } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { NETWORK_NOTE } from '@/lib/network';

/**
 * Profile — `/app/profile`.
 *
 * The account's own facts, in the account's own voice. Every WORD on this surface
 * belongs to the page; the controls — the network switch, the mode switch, the
 * claim action, the legal links, the sign-out — stand on the canvas with no card
 * around them. The page is the one place the account is described, so a card that
 * carried its own heading and then sat under a page that said the same thing was
 * the surface telling one fact twice (which is a fact read zero times).
 *
 * Which is why there are no card components left here. The network control has no
 * `ProfileNetworkCard`, the mode has no `ProfileIntentCard`, and the account block
 * has no identity card: each was a `<Card>` whose prose was the page's, and a
 * wrapper with nothing in it but a sentence and a control is a box drawn around
 * the page's own words. The switches and the panels survive because they ARE the
 * controls; they lost only the wrapper.
 *
 * Two things the surface is careful about, and both are load-bearing:
 *
 *  - **The readiness sentence is the page's** (`liveReason`): the control shows a
 *    DISABLED Live, and the reason it cannot be chosen is said once, in words,
 *    under it — never only as a greyed-out button. The sentence's single source is
 *    the server's answer or, failing that, `PROFILE_NETWORK_COPY.liveNoteFallback`;
 *    nothing here hand-types a network note.
 *  - **The words the money is a sentence about** stay network-owned: `NETWORK_NOTE`
 *    is the app's one line for the network (the frame's strip renders the same
 *    string), so the page reads it rather than writing a second one.
 *
 * Gated like Home and Pay, and for a concrete reason: ungated, a signed-out
 * visitor gets the account block with a null user — "Unknown account" under a
 * "Privy session" badge, which reads as the sign-out having failed. The badge
 * describes the build's auth source, so it cannot say anything about whether a
 * session exists.
 */
export default function ProfilePage() {
  const session = useSession();

  if (session.status === 'loading') {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!session.isAuthenticated) {
    return (
      <SignInCard
        onSignIn={() => void session.signIn()}
        error={session.error}
        source={session.source}
        pending={session.signingIn}
      />
    );
  }

  return <ProfileScreen />;
}

/** The surface's own shape: who is signed in, the network, the mode, the legal links, the way out. */
function ProfileScreen() {
  const session = useSession();
  const { handle } = useRailIdentity();
  const network = useProfileNetwork();
  const intent = useProfileIntent();

  /** The server's readiness reason, or the shared fallback where it states none. */
  const liveReason = network.live.reason ?? PROFILE_NETWORK_COPY.liveNoteFallback;
  const depositAddress = network.depositAddress;

  return (
    <div className="flex flex-col gap-6">
      {/* Who is signed in — the HANDLE, not the email. */}
      <div>
        <Text variant="micro" as="p">
          {RAIL_IDENTITY_COPY.signedInAs}
        </Text>
        <Text variant="section" as="p" className="mt-1">
          {handle ? `@${handle.handle}` : PROFILE_PAGE_COPY.unknownAccount}
        </Text>
        {session.user?.phone ? (
          <Text variant="micro" as="p" className="mt-1">
            {session.user.phone}
          </Text>
        ) : null}
        <div className="mt-3">
          <Badge variant={session.source === 'privy' ? 'success' : 'neutral'}>
            {session.source === 'privy' ? PROFILE_PAGE_COPY.privyBadge : PROFILE_PAGE_COPY.devBadge}
          </Badge>
        </div>
      </div>

      {/* Practice ⇄ Live: the switch is the control, the words around it are the page's. */}
      <section className="flex flex-col gap-4">
        <div>
          <Text variant="card-title" as="p">
            {PROFILE_NETWORK_COPY.title}
          </Text>
          <Text variant="micro" as="p" className="mt-1 text-mute">
            {PROFILE_NETWORK_COPY.intro}
          </Text>
        </div>

        <ProfileNetworkSwitch
          network={network.network}
          switching={network.switching}
          live={network.live}
          onSwitch={(target) => void network.switchTo(target)}
        />

        <div className="flex flex-col gap-1">
          <Text variant="micro" as="p" color="secondary">
            {NETWORK_NOTE[network.network]}
          </Text>
          {network.live.ready ? null : (
            <Text variant="micro" as="p" color="secondary">
              {liveReason}
            </Text>
          )}
        </div>

        {network.error ? (
          <StateMessage variant="failure" title={PROFILE_NETWORK_COPY.errorTitle} body={network.error} />
        ) : null}

        {/* The Live side's deposit address. v1 has no on-ramp, so a live account starts empty. */}
        {network.network === 'mainnet' ? (
          depositAddress ? (
            <div className="space-y-1">
              <Text variant="micro" as="p">
                {PROFILE_NETWORK_COPY.depositTitle}
              </Text>
              <p className="break-all font-mono text-body-sm text-ink">{depositAddress}</p>
              <Text variant="micro" as="p" className="text-mute">
                {PROFILE_NETWORK_COPY.fundNote}
              </Text>
            </div>
          ) : (
            <div className="space-y-1">
              <Text variant="micro" as="p">
                {PROFILE_NETWORK_COPY.noDepositTitle}
              </Text>
              <Text variant="micro" as="p" className="text-mute">
                {PROFILE_NETWORK_COPY.noDepositBody}
              </Text>
            </div>
          )
        ) : null}
      </section>

      {/* The account's mode, and the name that mode uses. */}
      <section className="flex flex-col gap-4">
        <div>
          <Text variant="card-title" as="p">
            {PROFILE_INTENT_COPY.title}
          </Text>
          <Text variant="micro" as="p" className="mt-1">
            {PROFILE_INTENT_COPY.intro}
          </Text>
        </div>

        <ProfileIntentSwitch
          intent={intent.intent}
          switching={intent.switching}
          onSwitch={(mode) => void intent.switchTo(mode)}
        />

        {intent.error ? (
          <StateMessage variant="failure" title={PROFILE_INTENT_COPY.errorTitle} body={intent.error} />
        ) : null}

        <ProfileHandlePanel intent={intent.intent} handle={intent.handleFor(intent.intent)} />
      </section>

      {/* The legal links, at the page's own level. */}
      <div>
        <Text variant="card-title" as="h2">
          {PROFILE_PAGE_COPY.legalTitle}
        </Text>
        <ProfileLegalCard />
      </div>

      <SignOutButton />
    </div>
  );
}
