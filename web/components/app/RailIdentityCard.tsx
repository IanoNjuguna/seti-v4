'use client';

import Link from 'next/link';
import { RAIL_IDENTITY_COPY } from './RailIdentity.constants';
import { CopyLinkButton } from './CopyLinkButton';
import { useRailIdentity } from './useRailIdentity';

/**
 * Who you are signed in as, at the foot of the rail.
 *
 * One thing in the rail's empty lower half, and only one: the account, the active
 * mode's handle, and that handle's public link with a control to copy it. The
 * rail is chrome, so nothing here is a destination a person shops in — the card
 * exists because a link you cannot get to is a link you do not have, which was
 * the standing complaint about the merchant link living only inside Profile.
 *
 * The mode's handle is the one shown, not "any handle": the account may hold a
 * business name and a username at once, and the mode it is acting as is what the
 * rest of the app is showing. A mode with no name yet is not an error — it is the
 * third thing the card can say, and it says it with the same claim link Profile
 * offers.
 *
 * Nothing at all when signed out: the rail is drawn for a first-time visitor by
 * the gate's own rule, and that visitor has no identity to be shown. The gap is
 * simply canvas again, exactly as it was before this card existed.
 *
 * `mt-auto` is the whole layout: the card takes the space the destinations leave
 * rather than the rail stretching to reach it.
 */
export function RailIdentityCard() {
  const { signedIn, signedInAs, handle, claim } = useRailIdentity();

  if (!signedIn) return null;

  return (
    <div className="mt-auto shrink-0 border-t border-hairline-dark px-4 pb-4 pt-4">
      <p className="text-caption font-semibold uppercase tracking-wider text-on-dark-mute">
        {RAIL_IDENTITY_COPY.signedInAs}
      </p>
      {signedInAs ? (
        <p className="mt-1 truncate text-body-sm text-on-dark" title={signedInAs}>
          {signedInAs}
        </p>
      ) : null}

      {handle ? (
        <div className="mt-3">
          <p className="font-mono text-body-md-bold text-on-dark">@{handle.handle}</p>
          <CopyLinkButton link={handle.link} caption={handle.caption} />
        </div>
      ) : null}

      {claim ? (
        <div className="mt-3">
          <p className="text-body-sm text-on-dark-mute">{claim.title}</p>
          <Link
            href={claim.href}
            className="mt-2 inline-flex min-touch items-center rounded-sm text-body-sm font-semibold text-on-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {claim.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
