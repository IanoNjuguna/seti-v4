'use client';

import { SignOutButton } from '@/components/auth/SignOutButton';
import { ProfileIdentity } from './ProfileIdentity';
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
 * The identity is the `h1` and the first pixel; the two shortcuts sit between it and
 * the list because they are the reasons someone opens this screen at all, and the
 * settings come last because a settings change is what you do when the first two
 * were not what you wanted. Sign out is the way out and closes the column.
 *
 * The account read lives in `useProfileIdentity`, which is only mounted once the
 * session has confirmed an account, so a visitor never fires a request for facts
 * they do not have (`ProfileSignedOut` gets the same place at the top).
 */
export function ProfileScreen() {
  const person = useProfileIdentity();

  return (
    <div className="flex flex-col gap-8">
      <ProfileIdentity name={person.name} handle={person.handle} initial={person.initial} />

      <ProfileShortcuts />

      <ProfileSettings name={person.name} handle={person.handle} businesses={person.businesses} />

      <SignOutButton />
    </div>
  );
}
