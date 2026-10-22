'use client';

import { SignOutButton } from '@/components/auth/SignOutButton';
import { ProfileIdentity } from './ProfileIdentity';
import { ProfileInviteRow } from './ProfileInviteRow';
import { ProfileSettings } from './ProfileSettings';
import { ProfileShortcuts } from './ProfileShortcuts';
import { useProfileIdentity } from './useProfileIdentity';

/**
 * Profile for a confirmed account, in the order a person reads it.
 *
 * THREE bands, and the order is the whole change: who you are, what you came here
 * to do, then the settings. The page used to open on the word "Profile" and go
 * straight into sections, so the customer was the one thing missing from their own
 * page.
 *
 * The identity is the `h1` and the first pixel; the shortcuts sit between it and the
 * list because they are the reasons someone opens this screen at all, and the
 * settings come last because a settings change is what you do when the first two
 * were not what you wanted. Sign out is the way out and closes the column.
 *
 * `ProfileInviteRow` is a CHILD of the shortcut nav rather than a band of its own
 * (#145): it is a destination like the other two, and passing it in keeps it in the
 * same list, so the three rows share one left edge and one hairline rhythm. It is
 * not a fourth entry in `PROFILE_SHORTCUTS`, because its row has states — no
 * username yet, or a link that opens — and a static `href` cannot carry them.
 *
 * The account read lives in `useProfileIdentity`, which is only mounted once the
 * session has confirmed an account, so a visitor never fires a request for facts
 * they do not have (`ProfileSignedOut` gets the same place at the top).
 */
export function ProfileScreen() {
  const person = useProfileIdentity();

  return (
    <div className="flex flex-col gap-8">
      <ProfileIdentity name={person.name} handle={person.handle} />

      <ProfileShortcuts>
        <ProfileInviteRow />
      </ProfileShortcuts>

      <ProfileSettings name={person.name} handle={person.handle} businesses={person.businesses} />

      <SignOutButton />
    </div>
  );
}
