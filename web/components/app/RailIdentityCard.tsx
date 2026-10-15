'use client';

import Link from 'next/link';
import { CopyRow } from '@/components/copy/CopyRow';
import { RAIL_IDENTITY_COPY } from './RailIdentity.constants';
import { useRailIdentity } from './useRailIdentity';

/**
 * Who you are signed in as, at the foot of the rail — BY NAME, and only by name.
 *
 * The identity shown is the active mode's handle, rendered `@handle`, with that
 * handle's public link. The rail is chrome, so nothing here is a destination a
 * person shops in — the card exists because a link you cannot get to is a link you
 * do not have, which was the standing complaint about the merchant link living
 * only inside Profile.
 *
 * TWO copyable rows, not a caption plus one button: the name and the link are the
 * two things a person hands out, and each now has its own control on its own line
 * (`CopyRow`, the same row the Receive card uses). The rail's old control was a
 * bordered 48px button labelled "Copy link" UNDER the link, which made one value
 * look like the other's footnote and gave the name no control at all.
 *
 * The account's EMAIL is deliberately not shown. It was, under a "signed in as"
 * label, and it made the card two competing identities at once: an email that
 * identifies the login, and a handle that is how money actually reaches the person.
 * The handle is the one that is addressable — it is what a sender types and what
 * the link opens — so the card states that one and nothing else. The email is still
 * visible where it is a fact about the ACCOUNT rather than about the rail
 * (`ProfileCard`), which is where someone looks for it.
 *
 * The mode's handle is the one shown, not "any handle": the account may hold a
 * business name and a username at once, and the mode it is acting as is what the
 * rest of the app is showing. A mode with no name yet is not an error — it is the
 * second thing the card can say, and it says it with the same claim link Profile
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
  const { signedIn, handle, claim } = useRailIdentity();

  if (!signedIn) return null;

  return (
    <div className="mt-auto shrink-0 border-t border-hairline-dark px-4 pb-4 pt-4">
      <p className="text-caption font-semibold uppercase tracking-wider text-on-dark-mute">
        {RAIL_IDENTITY_COPY.signedInAs}
      </p>

      {handle ? (
        <div className="mt-3 flex flex-col gap-4">
          <CopyRow
            display={`@${handle.handle}`}
            value={handle.handle}
            label={RAIL_IDENTITY_COPY.copyHandle}
            failureText={RAIL_IDENTITY_COPY.copyFailed}
            copiedText={RAIL_IDENTITY_COPY.copied}
            surface="dark"
            emphasis
          />
          <CopyRow
            display={handle.caption}
            value={handle.link}
            label={RAIL_IDENTITY_COPY.copyLink}
            failureText={RAIL_IDENTITY_COPY.copyFailed}
            copiedText={RAIL_IDENTITY_COPY.copied}
            surface="dark"
            wrap
          />
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
